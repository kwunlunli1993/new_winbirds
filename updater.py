import os
import sys
import time
import requests
import base64
import json
import hashlib
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

# 強制即時輸出，避免 Logs 睇唔到
sys.stdout.reconfigure(line_buffering=True)

# 從環境變數讀取
USER_ID = int(os.environ.get("USER_ID", 619))
USER_TOKEN = os.environ.get("USER_TOKEN", "")

R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY", "")
R2_SECRET_KEY = os.environ.get("R2_SECRET_KEY", "")
R2_BUCKET = os.environ.get("R2_BUCKET", "newwinbirds-cache")
R2_ENDPOINT = os.environ.get("R2_ENDPOINT", f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com")

s3 = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    region_name="auto",
)

def make_machine_header():
    now = datetime.now().strftime("%Y%m%d%H%M%S")
    to_encrypt = f"win-bird-web|1|{now}"
    encrypted = "".join(chr(ord(c) ^ ord('K')) for c in to_encrypt)
    return base64.b64encode(encrypted.encode('utf-8')).decode('utf-8')

def call_winbird(endpoint, body="{}", force_live=True):
    url = f"https://app.winbird.cc:16891{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Machine": make_machine_header(),
        "Authorization": f"user|{USER_ID}|{USER_TOKEN}"
    }
    try:
        resp = requests.post(url, headers=headers, data=body, timeout=30)
        data = resp.json()
        # 存入 R2 cache
        raw = f"{endpoint}|{body}"
        key = f"api/{hashlib.md5(raw.encode()).hexdigest()}.json"
        s3.put_object(
            Bucket=R2_BUCKET,
            Key=key,
            Body=json.dumps(data, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json",
        )
        print(f"Cached {endpoint} -> {key}", flush=True)
        return data
    except Exception as e:
        print(f"Error calling {endpoint}: {e}", flush=True)
        return {}

def update_today():
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"[{datetime.now()}] Updating today: {today}", flush=True)

    body = {"date": f"{today}T00:00:00+08:00"}
    
    # 強制刷新今天的資料
    call_winbird("/api/race/getRaces", json.dumps(body), force_live=True)

    print(f"[{datetime.now()}] Done updating {today}", flush=True)

if __name__ == "__main__":
    print("Updater started. Will update every 5 minutes.", flush=True)
    while True:
        try:
            update_today()
        except Exception as e:
            print(f"Update error: {e}", flush=True)
        time.sleep(300)  # 5 分鐘