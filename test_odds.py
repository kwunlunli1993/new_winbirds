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

body = {"date": "2026-10-21T00:00:00+08:00"}
r = requests.post("https://app.winbird.cc:16891/api/race/getRaces", headers=headers, data=json.dumps(body))
race = r.json()["races"][0]

r2 = requests.post("https://app.winbird.cc:16891/api/race/getRaceAllOdds", headers=headers, data=json.dumps(race))
odds = r2.json().get("odds", [])

# 印出所有不重複的 oddsType
types = set()
for o in odds:
    types.add(o.get("oddsType", ""))

print("所有 oddsType：")
for t in sorted(types):
    print(" -", t)