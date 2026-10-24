import os
import json
import boto3
from botocore.exceptions import ClientError

R2_ACCOUNT_ID = "2d6acff91f3e0f2f9d416e51f12ca41e"
R2_ACCESS_KEY = "ce2389fb251811c26346decdd9745dfb"
R2_SECRET_KEY = "9f74f0255877524c142e7f4f8a00fee08e0ca9720258ecc6c8afd5dea450b4f7"
R2_BUCKET = "newwinbirds-cache"

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    region_name="auto",
)

def upload_folder(local_dir, r2_prefix):
    if not os.path.exists(local_dir):
        print(f"跳過：{local_dir} 不存在")
        return
    count = 0
    for filename in os.listdir(local_dir):
        if not filename.endswith(".json"):
            continue
        local_path = os.path.join(local_dir, filename)
        r2_key = f"{r2_prefix}/{filename}"
        try:
            with open(local_path, "rb") as f:
                s3.put_object(
                    Bucket=R2_BUCKET,
                    Key=r2_key,
                    Body=f.read(),
                    ContentType="application/json",
                )
            count += 1
            if count % 50 == 0:
                print(f"已上傳 {count} 個檔案...")
        except Exception as e:
            print(f"失敗 {filename}: {e}")
    print(f"{r2_prefix} 完成，共 {count} 個檔案")

if __name__ == "__main__":
    print("開始上傳快取到 R2...")
    upload_folder("api_cache", "api")
    upload_folder("day_cache", "day")
    upload_folder("rate_cache", "rate")
    
    # 上傳 dates_cache（如果有）
    if os.path.exists("dates_cache.json"):
        with open("dates_cache.json", "rb") as f:
            s3.put_object(
                Bucket=R2_BUCKET,
                Key="dates_cache.json",
                Body=f.read(),
                ContentType="application/json",
            )
        print("dates_cache.json 已上傳")
    
    print("全部上傳完成")