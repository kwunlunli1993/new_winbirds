import os
import json
import hashlib
import requests
import base64
from datetime import datetime
from collections import defaultdict
import boto3
from botocore.exceptions import ClientError

USER_ID = 619
USER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJRCI6NjE5LCJUeXBlIjoidXNlciJ9.rlJvhOIXu77DOucjNZAOFhR90vg29itBz4u7sZFJ8LE"

R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "2d6acff91f3e0f2f9d416e51f12ca41e")
R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY", "ce2389fb251811c26346decdd9745dfb")
R2_SECRET_KEY = os.environ.get("R2_SECRET_KEY", "9f74f0255877524c142e7f4f8a00fee08e0ca9720258ecc6c8afd5dea450b4f7")
R2_BUCKET = os.environ.get("R2_BUCKET", "newwinbirds-cache")

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    region_name="auto",
)

TARGET_TAGS = {
    "樂樂": "A類馬",
    "龍心": "B類馬",
    "絕心": "C類馬",
    "2熱神技": "D類馬",
    "速正": "E類馬",
    "小屁股": "鬼鼠馬",
    "賺住贏": "賺住贏",
    "欣欣杯": "欣欣杯",
}

def r2_load(key):
    try:
        obj = s3.get_object(Bucket=R2_BUCKET, Key=key)
        return json.loads(obj["Body"].read().decode("utf-8"))
    except:
        return None

def r2_save(key, data):
    s3.put_object(
        Bucket=R2_BUCKET,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False).encode("utf-8"),
        ContentType="application/json",
    )

def make_machine_header():
    now = datetime.now().strftime("%Y%m%d%H%M%S")
    to_encrypt = f"win-bird-web|1|{now}"
    encrypted = "".join(chr(ord(c) ^ ord('K')) for c in to_encrypt)
    return base64.b64encode(encrypted.encode('utf-8')).decode('utf-8')

def get_cache_key(endpoint, body):
    raw = f"{endpoint}|{body}"
    return hashlib.md5(raw.encode()).hexdigest()

def call_winbird(endpoint, body="{}", force_live=False):
    cache_key = get_cache_key(endpoint, body)
    cached = r2_load(f"api/{cache_key}.json")
    if cached is not None and not force_live:
        return cached

    url = f"https://app.winbird.cc:16891{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Machine": make_machine_header(),
        "Authorization": f"user|{USER_ID}|{USER_TOKEN}"
    }
    try:
        resp = requests.post(url, headers=headers, data=body, timeout=30)
        data = resp.json()
        r2_save(f"api/{cache_key}.json", data)
        return data
    except Exception as e:
        print(f"Error {endpoint}: {e}")
        return {}

def is_valid_horse(h):
    no = h.get("no", 0)
    if not no or no <= 0:
        return False
    place = h.get("result", {}).get("place", 0)
    if place < 0:
        return False
    return True

def get_pre_dbl(prev_race_id):
    body = {"raceId": prev_race_id, "oddsType": "dbl-p"}
    data = call_winbird("/api/race/getPeriodOdds", json.dumps(body))
    return data.get("period_odds", [])

def get_horse_history(horse):
    data = call_winbird("/api/race/getRaceHorseHistory", json.dumps(horse))
    return data.get("raceHorses", [])

def analyze_race(race, prev_race_id=None, horses_from_abc=None):
    odds_data = call_winbird("/api/race/getRaceAllOdds", json.dumps(race))
    odds = odds_data.get("odds", [])

    win_br1 = {}
    for o in odds:
        if o.get("oddsType") == "win":
            win_br1[int(o.get("target", 0))] = o.get("t1ho", 999)

    results = {
        "指數哥": [],
        "隔夜哥": [],
        "孖寶哥": [],
        "三橙俠": [],
        "古惑飛": [],
        "近3指數90": [],
        "近3跌30": [],
    }

    ewin_list = []
    for o in odds:
        if o.get("oddsType") == "edata-win" and o.get("t1ho", 0) > 0:
            no = int(o.get("target", 0))
            if no > 0:
                ewin_list.append((no, o.get("t1ho", 0), win_br1.get(no, 999)))
    ewin_list.sort(key=lambda x: (-x[1], x[2]))
    results["指數哥"] = [x[0] for x in ewin_list[:5]]

    overnight_list = []
    for o in odds:
        if o.get("oddsType") == "win" and o.get("l24ho", 0) > 0 and o.get("t1ho", 0) > 0:
            no = int(o.get("target", 0))
            if no > 0:
                ratio = (o.get("t1ho", 0) / o.get("l24ho", 1)) - 1
                overnight_list.append((no, ratio, win_br1.get(no, 999)))
    overnight_list.sort(key=lambda x: (x[1], x[2]))
    results["隔夜哥"] = [x[0] for x in overnight_list[:5]]

    race_no = str(race.get("no", ""))
    if race_no == "1":
        twin_list = []
        for o in odds:
            if o.get("oddsType") == "dbl" and o.get("l24ho", 0) > 0 and o.get("t1ho", 0) > 0:
                no = int(o.get("target", 0))
                if no > 0:
                    ratio = (o.get("t1ho", 0) / o.get("l24ho", 1)) - 1
                    twin_list.append((no, ratio, win_br1.get(no, 999)))
        twin_list.sort(key=lambda x: (x[1], x[2]))
        results["孖寶哥"] = [x[0] for x in twin_list[:5]]
    elif prev_race_id:
        pre_odds = get_pre_dbl(prev_race_id)
        twin_list = []
        for o in pre_odds:
            if o.get("l24ho", 0) > 0 and o.get("t1ho", 0) > 0:
                no = int(o.get("target", 0))
                if no > 0:
                    ratio = (o.get("t1ho", 0) / o.get("l24ho", 1)) - 1
                    twin_list.append((no, ratio, win_br1.get(no, 999)))
        twin_list.sort(key=lambda x: (x[1], x[2]))
        results["孖寶哥"] = [x[0] for x in twin_list[:5]]

        time_fields = ["startOdds", "l13ho", "l14ho", "l15ho", "l16ho", "l17ho", "l18ho",
                       "l19ho", "l20ho", "l21ho", "l22ho", "l23ho", "l24ho", "t2ho", "t1ho"]
        for o in pre_odds:
            no = int(o.get("target", 0))
            if no <= 0:
                continue
            values = [o.get(f) for f in time_fields if o.get(f) and o.get(f) > 0]
            if len(values) < 2:
                continue
            orange = sum(1 for i in range(1, len(values)) if values[i-1] > 0 and (values[i] - values[i-1]) / values[i-1] <= -0.30)
            if orange >= 3:
                results["三橙俠"].append(no)

    epla = [o for o in odds if o.get("oddsType") == "edata-pla"]
    for o in epla:
        no = int(o.get("target", 0))
        if no <= 0:
            continue
        if o.get("t2ho", 0) >= 84 and o.get("t1ho", 0) >= 84 and o.get("t30mo", 0) >= 84:
            results["古惑飛"].append(no)

    if horses_from_abc:
        for h in horses_from_abc:
            if not is_valid_horse(h):
                continue
            no = h.get("no")
            histories = get_horse_history(h)
            past_races = [rh for rh in histories if rh.get("raceId") != race.get("ID")][:3]

            if any(rh.get("result", {}).get("lastHighEWin", 0) >= 90 for rh in past_races):
                results["近3指數90"].append(no)
            if any(rh.get("result", {}).get("winDrop", 0) <= -30 for rh in past_races):
                results["近3跌30"].append(no)

    return results

def compute_day(date_str):
    print(f"計算 {date_str} ...", flush=True)
    
    body = {"date": f"{date_str}T00:00:00+08:00"}
    races_data = call_winbird("/api/race/getRaces", json.dumps(body))
    races = races_data.get("races", [])

    if not races:
        result = {"date": date_str, "races": [], "live": False}
        r2_save(f"day/{date_str}.json", result)
        print(f"  → 無賽事")
        return

    race_map = {r["no"]: r for r in races}
    abc = call_winbird("/api/race/getRaceABC2", json.dumps(races[0]))

    place_by_race = defaultdict(dict)
    horses_by_race = defaultdict(list)
    iu_by_race = defaultdict(lambda: defaultdict(list))

    for r in abc.get("races", []):
        race_no = r.get("no", "?")
        for h in r.get("horses", []):
            if is_valid_horse(h):
                horses_by_race[race_no].append(h)
                no = h.get("no")
                place = h.get("result", {}).get("place", 0)
                place_by_race[race_no][no] = place
                for tag in h.get("tags", []):
                    name = tag.get("name", "")
                    if name in TARGET_TAGS:
                        iu_by_race[race_no][TARGET_TAGS[name]].append(no)

    result_races = []
    for race in races:
        race_no = race.get("no", "?")
        prev_id = None
        if int(race_no) > 1:
            prev = race_map.get(str(int(race_no) - 1))
            if prev:
                prev_id = prev["ID"]

        special = analyze_race(race, prev_id, horses_by_race.get(race_no, []))

        tags = {}
        for tag_name, nos in iu_by_race.get(race_no, {}).items():
            horses = [{"no": n, "place": place_by_race[race_no].get(n, 0)} for n in sorted(set(nos)) if n and n > 0]
            tags[tag_name] = horses

        for tag_name, nos in special.items():
            if nos:
                horses = [{"no": n, "place": place_by_race[race_no].get(n, 0)} for n in sorted(set(nos)) if n and n > 0]
                tags[tag_name] = horses

        result_races.append({"no": race_no, "tags": tags})

    result = {"date": date_str, "races": result_races, "live": False}
    r2_save(f"day/{date_str}.json", result)
    print(f"  → 完成，{len(result_races)} 場")

def main():
    print("掃描已有日期...", flush=True)
    
    dates = set()
    count = 0
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=R2_BUCKET, Prefix="api/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith(".json"):
                continue
            count += 1
            if count % 100 == 0:
                print(f"  已掃描 {count} 個檔案，找到 {len(dates)} 個日期...", flush=True)
            data = r2_load(key)
            if data and "races" in data and isinstance(data["races"], list) and len(data["races"]) > 0:
                date_str = data["races"][0].get("date", "")[:10]
                if date_str:
                    dates.add(date_str)

    dates = sorted(dates)
    print(f"找到 {len(dates)} 個日期", flush=True)

    print("檢查已有 day 快取...", flush=True)
    existing = set()
    for page in paginator.paginate(Bucket=R2_BUCKET, Prefix="day/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".json"):
                existing.add(key.replace("day/", "").replace(".json", ""))

    todo = [d for d in dates if d not in existing]
    print(f"需要計算：{len(todo)} 個日期", flush=True)

    for i, d in enumerate(todo):
        print(f"[{i+1}/{len(todo)}] ", end="", flush=True)
        try:
            compute_day(d)
        except Exception as e:
            print(f"  錯誤：{e}")

    print("全部完成！")

if __name__ == "__main__":
    main()