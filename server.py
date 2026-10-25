from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import base64
from datetime import datetime, timedelta
from collections import defaultdict
import json
import os
import hashlib
import time
from itertools import combinations
import boto3
from botocore.exceptions import ClientError
import threading

app = Flask(__name__)
CORS(app)

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

ALL_TAGS = [
    "A類馬", "B類馬", "C類馬", "D類馬", "E類馬",
    "鬼鼠馬", "賺住贏", "欣欣杯",
    "指數哥", "隔夜哥", "孖寶哥", "三橙俠", "古惑飛",
    "近3指數90", "近3跌30"
]

PERIODS = {
    "2526": ("2025-09-01", "2026-07-31", "2025-2026馬季"),
    "2609now": ("2026-09-01", "2026-12-31", "2026年9月至今"),
    "2509now": ("2025-09-01", "2026-12-31", "2025年9月至今"),
}

def r2_load(key):
    try:
        obj = s3.get_object(Bucket=R2_BUCKET, Key=key)
        return json.loads(obj["Body"].read().decode("utf-8"))
    except:
        return None

def r2_save(key, data):
    try:
        s3.put_object(
            Bucket=R2_BUCKET,
            Key=key,
            Body=json.dumps(data, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json",
        )
    except Exception as e:
        print(f"R2 save error {key}: {e}")

def get_cache_key(endpoint, body):
    raw = f"{endpoint}|{body}"
    return hashlib.md5(raw.encode()).hexdigest()

def load_from_cache(key):
    return r2_load(f"api/{key}.json")

def save_to_cache(key, data):
    r2_save(f"api/{key}.json", data)

def load_day_cache(date):
    return r2_load(f"day/{date}.json")

def save_day_cache(date, data):
    r2_save(f"day/{date}.json", data)

def load_dates_cache():
    return r2_load("dates_cache.json")

def save_dates_cache(dates):
    r2_save("dates_cache.json", dates)

def make_machine_header():
    now = datetime.now().strftime("%Y%m%d%H%M%S")
    to_encrypt = f"win-bird-web|1|{now}"
    encrypted = "".join(chr(ord(c) ^ ord('K')) for c in to_encrypt)
    return base64.b64encode(encrypted.encode('utf-8')).decode('utf-8')

def is_today(date_str):
    try:
        target = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        return target == datetime.now().date()
    except:
        return False

def call_winbird(endpoint, body="{}", force_live=False):
    cache_key = get_cache_key(endpoint, body)

    if force_live:
        url = f"https://app.winbird.cc:16891{endpoint}"
        headers = {
            "Content-Type": "application/json",
            "Machine": make_machine_header(),
            "Authorization": f"user|{USER_ID}|{USER_TOKEN}"
        }
        try:
            resp = requests.post(url, headers=headers, data=body, timeout=25)
            data = resp.json()
            save_to_cache(cache_key, data)
            return data
        except:
            cached = load_from_cache(cache_key)
            return cached if cached is not None else {}

    cached = load_from_cache(cache_key)
    if cached is not None:
        return cached

    url = f"https://app.winbird.cc:16891{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Machine": make_machine_header(),
        "Authorization": f"user|{USER_ID}|{USER_TOKEN}"
    }
    try:
        resp = requests.post(url, headers=headers, data=body, timeout=25)
        data = resp.json()
        save_to_cache(cache_key, data)
        return data
    except:
        return {}

def get_pre_dbl(prev_race_id, force_live=False):
    body = {"raceId": prev_race_id, "oddsType": "dbl-p"}
    data = call_winbird("/api/race/getPeriodOdds", json.dumps(body), force_live=force_live)
    return data.get("period_odds", [])

def get_horse_history(horse, force_live=False):
    data = call_winbird("/api/race/getRaceHorseHistory", json.dumps(horse), force_live=force_live)
    return data.get("raceHorses", [])

def is_valid_horse(h):
    no = h.get("no", 0)
    if not no or no <= 0:
        return False
    place = h.get("result", {}).get("place", 0)
    if place < 0:
        return False
    return True

def analyze_race(race, prev_race_id=None, horses_from_abc=None, force_live=False):
    odds_data = call_winbird("/api/race/getRaceAllOdds", json.dumps(race), force_live=force_live)
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
        pre_odds = get_pre_dbl(prev_race_id, force_live=force_live)
        twin_list = []
        for o in pre_odds:
            if o.get("l24ho", 0) > 0 and o.get("t1ho", 0) > 0:
                no = int(o.get("target", 0))
                if no > 0:
                    ratio = (o.get("t1ho", 0) / o.get("l24ho", 1)) - 1
                    twin_list.append((no, ratio, win_br1.get(no, 999)))
        twin_list.sort(key=lambda x: (x[1], x[2]))
        results["孖寶哥"] = [x[0] for x in twin_list[:5]]

        time_fields = [
            "startOdds", "l13ho", "l14ho", "l15ho", "l16ho", "l17ho", "l18ho",
            "l19ho", "l20ho", "l21ho", "l22ho", "l23ho", "l24ho", "t2ho", "t1ho"
        ]
        for o in pre_odds:
            no = int(o.get("target", 0))
            if no <= 0:
                continue
            values = []
            for f in time_fields:
                v = o.get(f)
                if v and v > 0:
                    values.append(v)
            if len(values) < 2:
                continue
            orange = 0
            for i in range(1, len(values)):
                prev = values[i-1]
                curr = values[i]
                if prev > 0 and (curr - prev) / prev <= -0.30:
                    orange += 1
            if orange >= 3:
                results["三橙俠"].append(no)

    epla = [o for o in odds if o.get("oddsType") == "edata-pla"]
    for o in epla:
        no = int(o.get("target", 0))
        if no <= 0:
            continue
        br2 = o.get("t2ho", 0)
        br1 = o.get("t1ho", 0)
        point30 = o.get("t30mo", 0)
        if br2 >= 84 and br1 >= 84 and point30 >= 84:
            results["古惑飛"].append(no)

    if horses_from_abc:
        for h in horses_from_abc:
            if not is_valid_horse(h):
                continue
            no = h.get("no")
            histories = get_horse_history(h, force_live=force_live)
            past_races = [rh for rh in histories if rh.get("raceId") != race.get("ID")]
            past_races = past_races[:3]

            high_index = any(
                rh.get("result", {}).get("lastHighEWin", 0) >= 90
                for rh in past_races
            )
            if high_index:
                results["近3指數90"].append(no)

            big_drop = any(
                rh.get("result", {}).get("winDrop", 0) <= -30
                for rh in past_races
            )
            if big_drop:
                results["近3跌30"].append(no)

    return results, {}

def compute_day_internal(date, force_live=False):
    body = {"date": f"{date}T00:00:00+08:00"}
    races_data = call_winbird("/api/race/getRaces", json.dumps(body), force_live=force_live)
    races = races_data.get("races", [])

    if not races:
        return {"date": date, "races": [], "live": force_live}

    race_map = {r["no"]: r for r in races}
    abc = call_winbird("/api/race/getRaceABC2", json.dumps(races[0]), force_live=force_live)

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
                        display = TARGET_TAGS[name]
                        iu_by_race[race_no][display].append(no)

    result_races = []
    for race in races:
        race_no = race.get("no", "?")
        prev_id = None
        if int(race_no) > 1:
            prev = race_map.get(str(int(race_no) - 1))
            if prev:
                prev_id = prev["ID"]

        special, _ = analyze_race(race, prev_id, horses_by_race.get(race_no, []), force_live=force_live)

        tags = {}
        for tag_name, nos in iu_by_race.get(race_no, {}).items():
            horses = []
            for n in sorted(set([n for n in nos if n and n > 0])):
                horses.append({"no": n, "place": place_by_race[race_no].get(n, 0)})
            tags[tag_name] = horses

        for tag_name, nos in special.items():
            if nos:
                horses = []
                for n in sorted(set([n for n in nos if n and n > 0])):
                    horses.append({"no": n, "place": place_by_race[race_no].get(n, 0)})
                tags[tag_name] = horses

        result_races.append({"no": race_no, "tags": tags})

    return {"date": date, "races": result_races, "live": force_live}

def background_refresh(date):
    try:
        result = compute_day_internal(date, force_live=True)
        save_day_cache(date, result)
        print(f"Background refresh done: {date}")
    except Exception as e:
        print(f"Background refresh error: {e}")

@app.route('/api/day-tags')
def day_tags():
    date = request.args.get('date', '2026-10-21')

    cached_result = load_day_cache(date)
    if cached_result is not None:
        if is_today(date):
            threading.Thread(target=background_refresh, args=(date,), daemon=True).start()
        return jsonify(cached_result)

    live = is_today(date)
    result = compute_day_internal(date, force_live=live)
    save_day_cache(date, result)
    return jsonify(result)

@app.route('/api/race-dates')
def race_dates():
    cached = load_dates_cache()
    if cached is not None:
        return jsonify(cached)

    dates = set()
    try:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=R2_BUCKET, Prefix="api/"):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if not key.endswith(".json"):
                    continue
                data = r2_load(key)
                if data and "races" in data and isinstance(data["races"], list) and len(data["races"]) > 0:
                    first = data["races"][0]
                    date_str = first.get("date", "")[:10]
                    if date_str:
                        dates.add(date_str)
    except Exception as e:
        print("scan dates error:", e)

    result = {"dates": sorted(list(dates), reverse=True)}
    save_dates_cache(result)
    return jsonify(result)

@app.route('/api/tag-rates')
def tag_rates():
    period = request.args.get('period', '2509now')
    if period not in PERIODS:
        period = '2509now'

    start_str, end_str, label = PERIODS[period]
    cache_key = f"rate/rates_{period}.json"

    cached = r2_load(cache_key)
    if cached is not None:
        return jsonify(cached)

    start_date = datetime.strptime(start_str, "%Y-%m-%d")
    end_date = datetime.strptime(end_str, "%Y-%m-%d")

    stats = defaultdict(lambda: {"total": 0, "win": 0, "top3": 0})

    dates = []
    try:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=R2_BUCKET, Prefix="api/"):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if not key.endswith(".json"):
                    continue
                data = r2_load(key)
                if data and "races" in data and isinstance(data["races"], list) and len(data["races"]) > 0:
                    first_race = data["races"][0]
                    date_str = first_race.get("date", "")[:10]
                    if date_str:
                        race_date = datetime.strptime(date_str, "%Y-%m-%d")
                        if start_date <= race_date <= end_date:
                            dates.append(date_str)
    except:
        pass

    dates = sorted(set(dates))

    for date_str in dates:
        body = {"date": f"{date_str}T00:00:00+08:00"}
        races_data = call_winbird("/api/race/getRaces", json.dumps(body), force_live=False)
        races = races_data.get("races", [])
        if not races:
            continue

        race_map = {r["no"]: r for r in races}
        abc = call_winbird("/api/race/getRaceABC2", json.dumps(races[0]), force_live=False)

        horses_by_race = defaultdict(list)
        iu_by_race = defaultdict(lambda: defaultdict(list))
        for r in abc.get("races", []):
            race_no = r.get("no", "?")
            for h in r.get("horses", []):
                if is_valid_horse(h):
                    horses_by_race[race_no].append(h)
                    for tag in h.get("tags", []):
                        name = tag.get("name", "")
                        if name in TARGET_TAGS:
                            display = TARGET_TAGS[name]
                            iu_by_race[race_no][display].append(h.get("no"))

        for race in races:
            race_no = race.get("no", "?")
            prev_id = None
            if int(race_no) > 1:
                prev = race_map.get(str(int(race_no) - 1))
                if prev:
                    prev_id = prev["ID"]

            special, _ = analyze_race(race, prev_id, horses_by_race.get(race_no, []), force_live=False)

            all_tags_this_race = {}
            for tag_name, nos in iu_by_race.get(race_no, {}).items():
                all_tags_this_race[tag_name] = set([n for n in nos if n and n > 0])
            for tag_name, nos in special.items():
                if nos:
                    all_tags_this_race[tag_name] = set([n for n in nos if n and n > 0])

            for r in abc.get("races", []):
                if r.get("no") != race_no:
                    continue
                for h in r.get("horses", []):
                    if not is_valid_horse(h):
                        continue
                    no = h.get("no")
                    place = h.get("result", {}).get("place", 0)
                    if place <= 0:
                        continue

                    for tag_name, nos in all_tags_this_race.items():
                        if no in nos:
                            stats[tag_name]["total"] += 1
                            if place == 1:
                                stats[tag_name]["win"] += 1
                            if place <= 3:
                                stats[tag_name]["top3"] += 1

    result = {}
    for tag in ALL_TAGS:
        s = stats.get(tag, {"total": 0, "win": 0, "top3": 0})
        total = s["total"]
        if total > 0:
            result[tag] = {
                "total": total,
                "win": s["win"],
                "top3": s["top3"],
                "winRate": round(s["win"] / total * 100, 1),
                "top3Rate": round(s["top3"] / total * 100, 1)
            }
        else:
            result[tag] = {
                "total": 0,
                "win": 0,
                "top3": 0,
                "winRate": 0,
                "top3Rate": 0
            }

    output = {
        "period": period,
        "label": label,
        "start": start_str,
        "end": end_str,
        "stats": result
    }

    r2_save(cache_key, output)
    return jsonify(output)

@app.route('/api/all-combo-rates')
def all_combo_rates():
    period = request.args.get('period', '2509now')
    if period not in PERIODS:
        period = '2509now'

    start_str, end_str, label = PERIODS[period]
    cache_key = f"rate/all_combos_{period}.json"

    cached = r2_load(cache_key)
    if cached is not None:
        return jsonify(cached)

    start_date = datetime.strptime(start_str, "%Y-%m-%d")
    end_date = datetime.strptime(end_str, "%Y-%m-%d")

    pair_stats = defaultdict(lambda: {"total": 0, "win": 0, "top3": 0})

    dates = []
    try:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=R2_BUCKET, Prefix="api/"):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if not key.endswith(".json"):
                    continue
                data = r2_load(key)
                if data and "races" in data and isinstance(data["races"], list) and len(data["races"]) > 0:
                    first_race = data["races"][0]
                    date_str = first_race.get("date", "")[:10]
                    if date_str:
                        race_date = datetime.strptime(date_str, "%Y-%m-%d")
                        if start_date <= race_date <= end_date:
                            dates.append(date_str)
    except:
        pass

    dates = sorted(set(dates))

    for date_str in dates:
        body = {"date": f"{date_str}T00:00:00+08:00"}
        races_data = call_winbird("/api/race/getRaces", json.dumps(body), force_live=False)
        races = races_data.get("races", [])
        if not races:
            continue

        race_map = {r["no"]: r for r in races}
        abc = call_winbird("/api/race/getRaceABC2", json.dumps(races[0]), force_live=False)

        horses_by_race = defaultdict(list)
        iu_by_race = defaultdict(lambda: defaultdict(list))
        for r in abc.get("races", []):
            race_no = r.get("no", "?")
            for h in r.get("horses", []):
                if is_valid_horse(h):
                    horses_by_race[race_no].append(h)
                    for tag in h.get("tags", []):
                        name = tag.get("name", "")
                        if name in TARGET_TAGS:
                            display = TARGET_TAGS[name]
                            iu_by_race[race_no][display].append(h.get("no"))

        for race in races:
            race_no = race.get("no", "?")
            prev_id = None
            if int(race_no) > 1:
                prev = race_map.get(str(int(race_no) - 1))
                if prev:
                    prev_id = prev["ID"]

            special, _ = analyze_race(race, prev_id, horses_by_race.get(race_no, []), force_live=False)

            all_tags_this_race = {}
            for tag_name, nos in iu_by_race.get(race_no, {}).items():
                all_tags_this_race[tag_name] = set([n for n in nos if n and n > 0])
            for tag_name, nos in special.items():
                if nos:
                    all_tags_this_race[tag_name] = set([n for n in nos if n and n > 0])

            horse_tags = defaultdict(set)
            for tag_name, nos in all_tags_this_race.items():
                for no in nos:
                    horse_tags[no].add(tag_name)

            for r in abc.get("races", []):
                if r.get("no") != race_no:
                    continue
                for h in r.get("horses", []):
                    if not is_valid_horse(h):
                        continue
                    no = h.get("no")
                    place = h.get("result", {}).get("place", 0)
                    if place <= 0:
                        continue

                    tags_on_horse = list(horse_tags.get(no, set()))
                    for t1, t2 in combinations(sorted(tags_on_horse), 2):
                        key = f"{t1}|{t2}"
                        pair_stats[key]["total"] += 1
                        if place == 1:
                            pair_stats[key]["win"] += 1
                        if place <= 3:
                            pair_stats[key]["top3"] += 1

    combos = []
    for key, s in pair_stats.items():
        t1, t2 = key.split("|")
        total = s["total"]
        combos.append({
            "tag1": t1,
            "tag2": t2,
            "total": total,
            "win": s["win"],
            "top3": s["top3"],
            "winRate": round(s["win"] / total * 100, 1) if total > 0 else 0,
            "top3Rate": round(s["top3"] / total * 100, 1) if total > 0 else 0
        })

    combos.sort(key=lambda x: -x["winRate"])

    output = {
        "period": period,
        "label": label,
        "start": start_str,
        "end": end_str,
        "combos": combos
    }

    r2_save(cache_key, output)
    return jsonify(output)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)