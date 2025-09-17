import json
import csv
import sys
from typing import Any, Dict, List


def main() -> int:
    if len(sys.argv) not in (2, 3):
        print("Usage: python3 json_to_csv.py <input.json> [output.csv]", file=sys.stderr)
        return 2

    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) == 3 else "response_value.csv"

    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)

    items: List[Dict[str, Any]] = data.get("value", [])
    if not isinstance(items, list) or not items:
        print("No list data under key 'value'", file=sys.stderr)
        return 1

    # Preferred column order first, then any additional keys encountered
    preferred = [
        "id",
        "ticket_id",
        "priority",
        "channel",
        "assignee_id",
        "requester_id",
        "requester_email",
        "ticket_summary",
        "ticket_content",
        "custom_values_text",
        "tags",
        "custom_fields",
        "@search.score",
    ]

    seen = set(preferred)
    fieldnames: List[str] = list(preferred)
    for it in items:
        if isinstance(it, dict):
            for k in it.keys():
                if k not in seen:
                    seen.add(k)
                    fieldnames.append(k)

    def norm(v: Any) -> Any:
        if isinstance(v, (list, dict)):
            return json.dumps(v, ensure_ascii=False)
        return v

    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for it in items:
            if not isinstance(it, dict):
                continue
            row = {k: norm(it.get(k, "")) for k in fieldnames}
            writer.writerow(row)

    print(f"Wrote {len(items)} rows -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

