import requests
import time
from datetime import datetime, timedelta

base_url = "http://127.0.0.1:5000"

# 先取得已快取的賽馬日
print("正在取得已快取的賽馬日...")
r = requests.get(f"{base_url}/api/race-dates")
cached_dates = set(r.json().get("dates", []))
print(f"已快取 {len(cached_dates)} 個賽馬日")

# 要讀取的範圍
start = datetime(2025, 9, 1)
end = datetime(2026, 9, 1)

current = start
to_fetch = []

# 先掃描哪些天有賽事
print("正在掃描哪些天有賽事...")
while current <= end:
    date_str = current.strftime("%Y-%m-%d")
    if date_str in cached_dates:
        print(f"  {date_str} 已快取，跳過")
    else:
        try:
            r = requests.get(f"{base_url}/api/day-tags?date={date_str}", timeout=60)
            data = r.json()
            if data.get("races") and len(data["races"]) > 0:
                to_fetch.append(date_str)
                print(f"  {date_str} 有賽事")
            else:
                print(f"  {date_str} 無賽事")
        except Exception as e:
            print(f"  {date_str} 錯誤: {e}")
    current += timedelta(days=1)
    time.sleep(0.2)

print(f"\n需要讀取的賽馬日：{len(to_fetch)} 天")
print(to_fetch)

# 讀取完整資料
for i, date_str in enumerate(to_fetch):
    print(f"[{i+1}/{len(to_fetch)}] 讀取 {date_str} ...")
    try:
        r = requests.get(f"{base_url}/api/day-tags?date={date_str}", timeout=180)
        races = len(r.json().get("races", []))
        print(f"  完成，{races} 場")
    except Exception as e:
        print(f"  錯誤: {e}")
    time.sleep(0.5)

print("\n全部完成！")