from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import base64
from datetime import datetime, timedelta
from collections import defaultdict
import json
import os
import hashlib
import boto3
import threading
import time

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
    "2526": ("2025-09-01", "2026-08-31", "2025-2026馬季"),
    "2609now": ("2026-09-01", "2026-12-31", "2026年9月至今"),
    "2509now": ("2025-09-01", "2026-12-31", "2025年9月至今"),
}

update_progress = {
    "running": False,
    "percent": 0,
    "message": "",
    "current_period": "",
}

def set_progress(percent, message="", period=""):
    update_progress["percent"] = percent
    update_progress["message"] = message
    update_progress["current_period"] = period

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
        print(f"Saved {key}")
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
    try:
        touch_date_index(date, data)
    except Exception as e:
        print("date index update error:", e)

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

def today_str():
    return datetime.now().date().strftime("%Y-%m-%d")

def day_has_result(day):
    for race in (day or {}).get("races") or []:
        for horses in (race.get("tags") or {}).values():
            for h in horses or []:
                if isinstance(h, dict) and int(h.get("place") or 0) > 0:
                    return True
    return False

def include_in_date_list(date_str, data):
    if not data or not data.get("races"):
        return False
    today = today_str()
    if date_str > today:
        return True
    if day_has_result(data):
        return True
    return date_str == today

def is_today_or_future(date_str):
    try:
        target = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        return target >= datetime.now().date()
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

def analyze_race(race, prev_race_id=None, horses_from_abc=None, force_live=False, history_live=False):
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
                prev = values[i - 1]
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
            histories = get_horse_history(h, force_live=history_live)
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

def compute_day_internal(date, force_live=False, history_live=False):
    body = {"date": f"{date}T00:00:00+08:00"}
    races_data = call_winbird("/api/race/getRaces", json.dumps(body), force_live=force_live)
    races = races_data.get("races", [])

    if not races:
        return {"date": date, "races": [], "live": force_live, "matched": False}

    matched = any(str(r.get("date", ""))[:10] == date for r in races)
    if not matched:
        print(f"Skip date mismatch: {date}")
        return {"date": date, "races": [], "live": force_live, "matched": False}

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
        if str(race_no).isdigit() and int(race_no) > 1:
            prev = race_map.get(str(int(race_no) - 1))
            if prev:
                prev_id = prev["ID"]

        special, _ = analyze_race(race, prev_id, horses_by_race.get(race_no, []), force_live=force_live, history_live=history_live)

        tags = {}
        for tag_name, nos in iu_by_race.get(race_no, {}).items():
            horses = []
            for n in sorted(set([n for n in nos if n and n > 0])):
                horses.append({"no": n, "place": place_by_race[race_no].get(n, 0)})
            if horses:
                tags[tag_name] = horses

        for tag_name, nos in special.items():
            horses = []
            for n in sorted(set([n for n in nos if n and n > 0])):
                horses.append({"no": n, "place": place_by_race[race_no].get(n, 0)})
            if horses:
                tags[tag_name] = horses

        result_races.append({"no": race_no, "tags": tags})

    return {"date": date, "races": result_races, "live": force_live, "matched": True}

def content_signature(data):
    parts = []
    for race in (data or {}).get("races") or []:
        items = []
        for tag, horses in (race.get("tags") or {}).items():
            for h in horses or []:
                if isinstance(h, dict):
                    items.append(f"{tag}:{h.get('no')}:{h.get('place')}")
        items.sort()
        parts.append(str(race.get("no")) + "|" + ",".join(items))
    return "\n".join(parts)

def places_signature(day):
    parts = []
    for race in (day or {}).get("races") or []:
        items = []
        for horses in (race.get("tags") or {}).values():
            for h in horses or []:
                if isinstance(h, dict) and int(h.get("place") or 0) > 0:
                    items.append(f"{h.get('no')}:{h.get('place')}")
        items.sort()
        parts.append(str(race.get("no")) + "|" + ",".join(items))
    return "\n".join(parts)

refresh_lock = threading.Lock()
rates_followup = {"again": False}

def queue_rates_update(date, prev, result):
    """名次檔已經儲低。勝率喺後面計，唔好擋住顏色。"""
    if not day_has_result(result):
        return
    if places_signature(prev) == places_signature(result):
        return
    if update_progress["running"]:
        rates_followup["again"] = True
        print(f"colors saved, rates will rerun: {date}")
        return
    print(f"colors saved, calculating rates: {date}")
    threading.Thread(target=run_rates_then_followup, daemon=True).start()

def run_rates_then_followup():
    while True:
        rates_followup["again"] = False
        update_all_rates()
        if not rates_followup["again"]:
            break

def refresh_one_day(date):
    """只更新一個日期。賠率會重新讀，馬匹歷史用快取。唔掃其他日子。"""
    if not refresh_lock.acquire(blocking=False):
        print(f"refresh skipped, busy: {date}")
        return
    try:
        prev = load_day_cache(date)
        result = compute_day_internal(date, force_live=True, history_live=False)
        if not (result.get("matched") and result.get("races")):
            print(f"not a race day: {date}")
            return
        save_day_cache(date, result)
        print(f"refreshed {date}")
        queue_rates_update(date, prev, result)
    except Exception as e:
        print(f"refresh error {date}: {e}")
    finally:
        refresh_lock.release()

def background_refresh(date):
    refresh_one_day(date)

def discover_new_race_days():
    find_next_race_day()

def find_next_race_day(max_days=10):
    """由今日開始，找到下一個真正賽馬日就停。日期對唔上就唔儲。"""
    if not refresh_lock.acquire(blocking=False):
        print("refresh skipped, busy")
        return None
    try:
        start = datetime.now().date()
        for i in range(0, max_days + 1):
            d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
            prev = load_day_cache(d)
            result = compute_day_internal(d, force_live=True, history_live=False)
            if not (result.get("matched") and result.get("races")):
                print(f"not a race day: {d}")
                continue
            save_day_cache(d, result)
            print(f"next race day: {d}")
            queue_rates_update(d, prev, result)
            return d
        print("no race day in the next window")
        return None
    except Exception as e:
        print("find next error:", e)
        return None
    finally:
        refresh_lock.release()

def background_jobs():
    time.sleep(30)
    while True:
        try:
            find_next_race_day()
        except Exception as e:
            print("scheduled refresh error:", e)
        time.sleep(300)


threading.Thread(target=background_jobs, daemon=True).start()

def update_all_rates():
    try:
        update_progress["running"] = True
        set_progress(5, "正在掃描日子...")
        print("Updating rates...")

        found = []
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=R2_BUCKET, Prefix="day/"):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.endswith(".json"):
                    date_str = key.replace("day/", "").replace(".json", "")
                    if len(date_str) == 10:
                        data = r2_load(key)
                        if include_in_date_list(date_str, data) and day_has_result(data):
                            found.append((date_str, content_signature(data)))

        kept = {}
        for date_str, sig in found:
            if sig not in kept or date_str < kept[sig]:
                kept[sig] = date_str
        sorted_dates = sorted(kept.values(), reverse=True)
        set_progress(15, f"找到 {len(sorted_dates)} 個賽馬日")

        total_periods = len(PERIODS)
        for idx, (period, (start_str, end_str, label)) in enumerate(PERIODS.items()):
            base = 20 + int(70 * idx / max(total_periods, 1))
            set_progress(base, f"正在計算 {label}", period)
            print(f"Calculating {period}...")

            stats = {tag: {"total": 0, "win": 0, "top3": 0, "winRate": 0, "top3Rate": 0} for tag in ALL_TAGS}
            for date in sorted_dates:
                if not (start_str <= date <= end_str):
                    continue
                day = load_day_cache(date)
                if not day or not day.get("races"):
                    continue
                for race in day["races"]:
                    for tag, horses in race.get("tags", {}).items():
                        if tag not in stats:
                            continue
                        for h in horses:
                            if not isinstance(h, dict):
                                continue
                            place = h.get("place", 0) or 0
                            stats[tag]["total"] += 1
                            if place == 1:
                                stats[tag]["win"] += 1
                            if 1 <= place <= 3:
                                stats[tag]["top3"] += 1
            for tag in stats:
                t = stats[tag]["total"]
                if t > 0:
                    stats[tag]["winRate"] = round(stats[tag]["win"] / t * 100, 1)
                    stats[tag]["top3Rate"] = round(stats[tag]["top3"] / t * 100, 1)
            r2_save(f"rate/rates_{period}.json", {
                "period": period, "label": label, "start": start_str, "end": end_str, "stats": stats
            })

            set_progress(base + 10, f"正在計算 {label} 組合", period)
            combos = defaultdict(lambda: {"total": 0, "win": 0, "top3": 0})
            for date in sorted_dates:
                if not (start_str <= date <= end_str):
                    continue
                day = load_day_cache(date)
                if not day or not day.get("races"):
                    continue
                for race in day["races"]:
                    horse_tags = defaultdict(list)
                    horse_place = {}
                    for tag, horses in race.get("tags", {}).items():
                        for h in horses:
                            if not isinstance(h, dict):
                                continue
                            no = h.get("no")
                            if no and no > 0:
                                horse_tags[no].append(tag)
                                horse_place[no] = h.get("place", 0) or 0
                    for no, tags in horse_tags.items():
                        unique_tags = list(set(tags))
                        if len(unique_tags) >= 2:
                            key = tuple(sorted(unique_tags))
                            combos[key]["total"] += 1
                            place = horse_place.get(no, 0)
                            if place == 1:
                                combos[key]["win"] += 1
                            if 1 <= place <= 3:
                                combos[key]["top3"] += 1
            result_combos = []
            for tags, s in combos.items():
                if s["total"] >= 1:
                    result_combos.append({
                        "tags": list(tags),
                        "total": s["total"],
                        "win": s["win"],
                        "top3": s["top3"],
                        "winRate": round(s["win"] / s["total"] * 100, 1) if s["total"] > 0 else 0,
                        "top3Rate": round(s["top3"] / s["total"] * 100, 1) if s["total"] > 0 else 0,
                    })
            result_combos.sort(key=lambda x: -x["winRate"])
            print(f"{period} combos count: {len(result_combos)}")
            r2_save(f"rate/all_combos_{period}.json", {
                "period": period, "label": label, "start": start_str, "end": end_str, "combos": result_combos
            })

        set_progress(100, "完成")
        print("Rates update done")
    except Exception as e:
        set_progress(0, f"錯誤: {e}")
        print("update rates error:", e)
    finally:
        update_progress["running"] = False

def pairs_from_combos(raw):
    if raw and raw[0].get("tag1") and raw[0].get("tag2"):
        return raw
    pair = defaultdict(lambda: {"total": 0, "win": 0, "top3": 0})
    for c in raw or []:
        tags = sorted(set(t for t in c.get("tags", []) if t))
        if len(tags) < 2:
            continue
        for i in range(len(tags)):
            for j in range(i + 1, len(tags)):
                key = (tags[i], tags[j])
                pair[key]["total"] += c.get("total", 0)
                pair[key]["win"] += c.get("win", 0)
                pair[key]["top3"] += c.get("top3", 0)
    combos = []
    for (a, b), s in pair.items():
        t = s["total"]
        if t <= 0:
            continue
        combos.append({
            "tag1": a,
            "tag2": b,
            "total": t,
            "win": s["win"],
            "top3": s["top3"],
            "winRate": round(s["win"] / t * 100, 1),
            "top3Rate": round(s["top3"] / t * 100, 1),
        })
    combos.sort(key=lambda x: (-x["winRate"], -x["total"]))
    return combos

@app.route('/api/day-tags')
def day_tags():
    date = request.args.get('date', '2026-10-21')
    cached_result = load_day_cache(date)
    if cached_result is not None and cached_result.get("races"):
        if is_today_or_future(date):
            threading.Thread(target=background_refresh, args=(date,), daemon=True).start()
        return jsonify(cached_result)

    live = is_today_or_future(date)
    result = compute_day_internal(date, force_live=live)
    if result.get("matched") and result.get("races"):
        save_day_cache(date, result)
    return jsonify(result)

DATE_INDEX_KEY = "meta/race-dates.json"
_dates_mem = {"dates": None, "at": 0}
date_index_lock = threading.Lock()

def dates_from_items(items):
    kept = {}
    for date_str, sig in items:
        if sig not in kept or date_str < kept[sig]:
            kept[sig] = date_str
    return sorted(kept.values(), reverse=True)

def list_day_filenames():
    dates = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=R2_BUCKET, Prefix="day/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith(".json"):
                continue
            date_str = key.replace("day/", "").replace(".json", "")
            if len(date_str) == 10 and date_str.count("-") == 2:
                dates.append(date_str)
    return sorted(set(dates), reverse=True)

def save_date_index(items):
    by_date = {}
    for date_str, sig in items:
        by_date[date_str] = sig
    dates = dates_from_items(list(by_date.items()))
    r2_save(DATE_INDEX_KEY, {
        "items": [{"date": d, "sig": s} for d, s in sorted(by_date.items())],
        "dates": dates,
    })
    _dates_mem["dates"] = dates
    _dates_mem["at"] = time.time()
    return dates

def rebuild_date_index():
    if not date_index_lock.acquire(blocking=False):
        print("date index rebuild skipped, busy")
        return
    try:
        print("rebuilding date index...")
        found = []
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=R2_BUCKET, Prefix="day/"):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if not key.endswith(".json"):
                    continue
                date_str = key.replace("day/", "").replace(".json", "")
                if len(date_str) == 10 and date_str.count("-") == 2:
                    data = r2_load(key)
                    if include_in_date_list(date_str, data):
                        found.append((date_str, content_signature(data)))
        dates = save_date_index(found)
        print(f"date index ready: {len(dates)}")
    except Exception as e:
        print("rebuild date index error:", e)
    finally:
        date_index_lock.release()

def touch_date_index(date, data):
    with date_index_lock:
        cached = r2_load(DATE_INDEX_KEY)
        if not cached or "items" not in cached:
            return
        items = [(x["date"], x.get("sig", "")) for x in cached["items"] if x.get("date") and x["date"] != date]
        if include_in_date_list(date, data):
            items.append((date, content_signature(data)))
        save_date_index(items)

@app.route('/api/race-dates')
def race_dates():
    if _dates_mem["dates"] is not None and time.time() - _dates_mem["at"] < 300:
        return jsonify({"dates": _dates_mem["dates"]})
    cached = r2_load(DATE_INDEX_KEY)
    if cached and cached.get("dates"):
        _dates_mem["dates"] = cached["dates"]
        _dates_mem["at"] = time.time()
        return jsonify({"dates": cached["dates"]})
    threading.Thread(target=rebuild_date_index, daemon=True).start()
    return jsonify({"dates": list_day_filenames()})

@app.route('/api/tag-rates')
def tag_rates():
    period = request.args.get('period', '2509now')
    if period not in PERIODS:
        period = '2509now'
    cached = r2_load(f"rate/rates_{period}.json")
    if cached is not None:
        return jsonify(cached)
    start_str, end_str, label = PERIODS[period]
    return jsonify({
        "period": period,
        "label": label,
        "start": start_str,
        "end": end_str,
        "stats": {tag: {"total": 0, "win": 0, "top3": 0, "winRate": 0, "top3Rate": 0} for tag in ALL_TAGS}
    })

@app.route('/api/all-combo-rates')
def all_combo_rates():
    period = request.args.get('period', '2509now')
    if period not in PERIODS:
        period = '2509now'
    start_str, end_str, label = PERIODS[period]
    cached = r2_load(f"rate/all_combos_{period}.json")
    if not cached or not cached.get("combos"):
        return jsonify({
            "period": period,
            "label": label,
            "start": start_str,
            "end": end_str,
            "combos": []
        })
    return jsonify({
        "period": cached.get("period", period),
        "label": cached.get("label", label),
        "start": cached.get("start", start_str),
        "end": cached.get("end", end_str),
        "combos": pairs_from_combos(cached["combos"]),
    })

@app.route('/api/update-progress')
def get_update_progress():
    return jsonify(update_progress)

@app.route('/api/update-rates')
def manual_update_rates():
    if update_progress["running"]:
        return jsonify({"status": "already running", "progress": update_progress})
    threading.Thread(target=run_rates_then_followup, daemon=True).start()
    return jsonify({"status": "automatic; started one now"})

@app.route('/api/discover-dates')
def manual_discover():
    threading.Thread(target=discover_new_race_days, daemon=True).start()
    return jsonify({"status": "automatic every 5 minutes; started one now"})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)