import requests
import base64
import json
from datetime import datetime

USER_ID = 7
USER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJRCI6NywiVHlwZSI6InVzZXIifQ.1eTsRK7icCtc_uWeCPTKixuLwWYCbSO7r55D9KtV7fc"

def make_machine_header():
    now = datetime.now().strftime("%Y%m%d%H%M%S")
    to_encrypt = f"win-bird-web|1|{now}"
    encrypted = "".join(chr(ord(c) ^ ord('K')) for c in to_encrypt)
    return base64.b64encode(encrypted.encode()).decode()

headers = {
    "Content-Type": "application/json",
    "Machine": make_machine_header(),
    "Authorization": f"user|{USER_ID}|{USER_TOKEN}"
}

# 用日期取得賽事
body = {"date": "2026-10-21T00:00:00+08:00"}
r = requests.post("https://app.winbird.cc:16891/api/race/getRaces", headers=headers, data=json.dumps(body))
print("getRaces Status:", r.status_code)

data = r.json()
races = data.get("races", [])
print(f"找到 {len(races)} 場比賽")

if races:
    race = races[0]
    print("第一場 ID:", race["ID"], "場次:", race.get("no"))

    # 用這場去打 getRaceABC2
    r2 = requests.post("https://app.winbird.cc:16891/api/race/getRaceABC2", headers=headers, data=json.dumps(race))
    print("getRaceABC2 Status:", r2.status_code)

    abc_data = r2.json()
    if "races" in abc_data and abc_data["races"]:
        horses = abc_data["races"][0].get("horses", [])
        print(f"第一場有 {len(horses)} 隻馬")
        for h in horses[:5]:
            tags = [t.get("name") for t in h.get("tags", [])]
            print(f"  馬號 {h.get('no')}: {tags}")