import requests
import base64
from datetime import datetime

# ========== 你的登入資料 ==========
USER_ID = 619
USER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJRCI6NjE5LCJUeXBlIjoidXNlciJ9.O7_JSUGH619OOEmsCvjbx2QO5LbL5P8mWK90OHqN948"
# ==================================

def make_machine_header():
    now = datetime.now().strftime("%Y%m%d%H%M%S")
    to_encrypt = f"win-bird-web|1|{now}"
    encrypted = ""
    for c in to_encrypt:
        encrypted += chr(ord(c) ^ ord('K'))
    return base64.b64encode(encrypted.encode('utf-8')).decode('utf-8')

def test_api():
    url = "https://app.winbird.cc:16891/api/race/getRaces"
    headers = {
        "Content-Type": "application/json",
        "Machine": make_machine_header(),
        "Authorization": f"user|{USER_ID}|{USER_TOKEN}"
    }
    body = "{}"  # 空的 body，先測試能不能通

    print("正在測試 API...")
    response = requests.post(url, headers=headers, data=body)
    print(f"狀態碼: {response.status_code}")
    print("回應內容:")
    print(response.text[:1000])  # 只顯示前 1000 字

if __name__ == "__main__":
    test_api()