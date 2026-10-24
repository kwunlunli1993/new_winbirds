import requests, base64, json
from datetime import datetime

USER_ID = 619
USER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJRCI6NjE5LCJUeXBlIjoidXNlciJ9.rlJvhOIXu77DOucjNZAOFhR90vg29itBz4u7sZFJ8LE"

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
races = r.json()["races"]
print("場次數量:", len(races))
race1 = [x for x in races if str(x["no"]) == "1"][0]
print("第1場 ID:", race1["ID"])

# 嘗試不同請求格式
pre_req = {"raceId": race1["ID"], "oddsType": "dbl-p"}
print("請求:", pre_req)
r2 = requests.post("https://app.winbird.cc:16891/api/race/getPeriodOdds", headers=headers, data=json.dumps(pre_req))
print("Status:", r2.status_code)
print("回應:", r2.text[:500])