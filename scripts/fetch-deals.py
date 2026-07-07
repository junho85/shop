#!/usr/bin/env python3
"""쿠팡 파트너스 골드박스(오늘의 특가) 수집기.

골드박스 API를 호출해 data/deals.json 을 갱신한다.
주멍가게 "🔥 오늘의 핫딜" 섹션의 데이터 소스. (직접 써본 추천 상품과 분리)

자격증명 우선순위:
  1. 환경변수 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY  (GitHub Actions)
  2. ~/.claude/coupang-partners.env                    (로컬)

subId 는 항상 'shopshop' (주멍가게 채널 추적).
"""
import os, sys, time, hmac, hashlib, json, urllib.parse, urllib.request, urllib.error

API_HOST = "https://api-gateway.coupang.com"
GOLDBOX_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox"
ENV_FILE = os.path.expanduser("~/.claude/coupang-partners.env")
SUB_ID = "shopshop"
LIMIT = 16  # 섹션 카드 상한

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "deals.json")


def load_credentials():
    ak = os.environ.get("COUPANG_ACCESS_KEY")
    sk = os.environ.get("COUPANG_SECRET_KEY")
    if ak and sk:
        return ak, sk
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip()
                if k == "COUPANG_ACCESS_KEY" and not ak:
                    ak = v
                elif k == "COUPANG_SECRET_KEY" and not sk:
                    sk = v
    if not ak or not sk:
        sys.exit("자격증명 없음: COUPANG_ACCESS_KEY/COUPANG_SECRET_KEY 환경변수 또는 "
                 f"{ENV_FILE} 를 설정하세요.")
    return ak, sk


def authorization(method, path, query, access_key, secret_key):
    os.environ["TZ"] = "GMT+0"
    time.tzset()
    signed_date = time.strftime("%y%m%dT%H%M%SZ", time.gmtime())
    message = signed_date + method + path + query
    signature = hmac.new(secret_key.encode(), message.encode(), hashlib.sha256).hexdigest()
    return (f"CEA algorithm=HmacSHA256, access-key={access_key}, "
            f"signed-date={signed_date}, signature={signature}")


def fetch_goldbox():
    access_key, secret_key = load_credentials()
    query = urllib.parse.urlencode({"subId": SUB_ID})
    auth = authorization("GET", GOLDBOX_PATH, query, access_key, secret_key)
    url = API_HOST + GOLDBOX_PATH + "?" + query
    req = urllib.request.Request(url, method="GET", headers={
        "Authorization": auth,
        "Content-Type": "application/json;charset=UTF-8",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"API 오류 HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:500]}")


def main():
    result = fetch_goldbox()
    if str(result.get("rCode")) != "0":
        sys.exit(f"실패 rCode={result.get('rCode')} rMessage={result.get('rMessage')}")

    deals = []
    for it in result.get("data", []):
        img = it.get("productImage") or ""
        if img.startswith("//"):
            img = "https:" + img
        deals.append({
            "id": it.get("productId"),
            "name": it.get("productName"),
            "price": it.get("productPrice"),
            "image": img,
            "url": it.get("productUrl"),
            "category": it.get("categoryName") or "",
            "rank": it.get("rank"),
            "isRocket": bool(it.get("isRocket")),
            "isFreeShipping": bool(it.get("isFreeShipping")),
        })
    deals = sorted(deals, key=lambda d: d.get("rank") or 9999)[:LIMIT]

    payload = {
        "fetchedAt": time.strftime("%Y-%m-%d %H:%M", time.localtime()),
        "source": "coupang-goldbox",
        "deals": deals,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"OK {len(deals)}개 특가 저장 → {os.path.relpath(OUT)} (fetchedAt {payload['fetchedAt']})")


if __name__ == "__main__":
    main()
