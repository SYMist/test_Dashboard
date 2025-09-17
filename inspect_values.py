import json
import sys

SRC = "response.json"

TARGET_IDS = {
    "type": "41988618714009",        # 문의 유형
    "category": "41988850452761",    # 카테고리
    "reservation_code": "41989351980441",  # 예약코드
    "locale_product": "41989966629273",    # 언어/상품코드 혼합값
}

def main():
    with open(SRC, "r", encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("value", [])
    for i, it in enumerate(items[:5]):
        print(f"-- item {i} id={it.get('id')} summary={it.get('ticket_summary', '')[:40]!r}")
        cfs = it.get("custom_fields", [])
        if not isinstance(cfs, list):
            print("  custom_fields not list")
            continue
        bag = {str(cf.get("id")): cf.get("value") for cf in cfs if isinstance(cf, dict)}
        for key, cid in TARGET_IDS.items():
            print(f"  {key} ({cid}) -> {bag.get(cid)!r}")

if __name__ == "__main__":
    main()

