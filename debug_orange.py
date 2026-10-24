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
race2 = [x for x in races if x["no"] == "2"][0]
r2 = requests.post("https://app.winbird.cc:16891/api/race/getRaceAllOdds", headers=headers, data=json.dumps(race2))
odds = r2.json().get("odds", [])
dblp = [o for o in odds if o.get("oddsType") == "dbl-p"]

time_fields = ["startOdds", "l13ho", "l14ho", "l15ho", "l16ho", "l17ho", "l18ho", "l19ho", "l20ho", "l21ho", "l22ho", "l23ho", "l24ho", "t2ho", "t1ho"]

for o in dblp:
    if o.get("target") in ["6", "7"]:
        print(f"=== 馬號 {o['target']} ===")
        values = []
        for f in time_fields:
            v = o.get(f)
            if v and v > 0:
                values.append((f, v))
        print(values)
        orange = 0
        for i in range(1, len(values)):
            prev = values[i-1][1]
            curr = values[i][1]
            drop = (curr / prev - 1) * 100
            if drop <= -20:
                orange += 1
                print(f"  橙燈: {values[i-1][0]} {prev} -> {values[i][0]} {curr} ({drop:.1f}%)")
        print(f"總橙燈: {orange}")
        print()