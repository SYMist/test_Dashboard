import csv
import json
import re
from typing import Any, Dict, List, Optional

SRC = "response.json"
OUT = "user_inquiry_from_response.csv"

# Custom field IDs (as strings to match JSON)
CF_TYPE = "41988618714009"           # 문의 유형
CF_CATEGORY = "41988850452761"       # 카테고리
CF_RESERVATION_CODE = "41989351980441"  # 예약코드
CF_LOCALE_PRODUCT = "41989966629273"    # 언어/상품코드 URL 등

HEADERS = [
    "상품 코드",
    "언어",
    "카테고리",
    "문의 유형",
    "문의 내용",
    "요청 ID",
    "예약코드",
]


def extract_locale(value: str) -> str:
    if not isinstance(value, str):
        return ""
    # Prefer locale as a path segment like /en, /zh-HK, /ko-KR etc.
    m = re.search(r"/(?:([a-z]{2}(?:-[A-Z]{2})?))(?:/|$)", value)
    if m:
        return m.group(1)
    # Fallback: find locale-like token anywhere
    m = re.search(r"\b([a-z]{2}(?:-[A-Z]{2})?)\b", value)
    return m.group(1) if m else ""


def extract_product_code(value: str) -> str:
    if not isinstance(value, str):
        return ""
    # Prefer last numeric path segment (e.g., .../spot/14426)
    m = re.search(r"/(\d+)(?:/)?$", value)
    if m:
        return m.group(1)[-5:]
    # Otherwise, take last run of digits in the string
    m = re.findall(r"(\d+)", value)
    if m:
        return m[-1][-5:]
    return ""


def clean_scalar(v: Any) -> str:
    """Map placeholder/none-like values to blank; keep others as-is."""
    if v is None:
        return ""
    s = str(v).strip()
    if s == "":
        return ""
    placeholders = {"無", "무", "없음", "None", "none", "NULL", "null", "Undefined", "undefined", "N/A", "n/a"}
    return "" if s in placeholders else s


def main() -> int:
    with open(SRC, "r", encoding="utf-8") as f:
        data = json.load(f)

    items: List[Dict[str, Any]] = data.get("value", [])

    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEADERS)
        w.writeheader()

        for it in items:
            if not isinstance(it, dict):
                continue
            custom_fields = it.get("custom_fields", [])
            cf_map = {str(cf.get("id")): cf.get("value") for cf in custom_fields if isinstance(cf, dict)}

            # Clean placeholder-like empties to blanks
            locale_product_val = clean_scalar(cf_map.get(CF_LOCALE_PRODUCT, ""))
            category_val = clean_scalar(cf_map.get(CF_CATEGORY, ""))
            type_val = clean_scalar(cf_map.get(CF_TYPE, ""))
            reservation_code_val = clean_scalar(cf_map.get(CF_RESERVATION_CODE, ""))
            row = {
                "상품 코드": extract_product_code(locale_product_val),
                "언어": extract_locale(locale_product_val),
                "카테고리": category_val or "",
                "문의 유형": type_val or "",
                "문의 내용": it.get("ticket_summary", ""),
                "요청 ID": it.get("id", ""),
                "예약코드": reservation_code_val or "",
            }
            w.writerow(row)

    print(f"Wrote {len(items)} rows -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
