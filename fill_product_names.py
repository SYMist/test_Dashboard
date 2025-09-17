import csv
import hashlib
import os
import sys
from typing import List


NAMES: List[str] = [
    "숨은 보석 제주 일주 투어",
    "트렌디 크로아티아 스카이다이빙 체험",
    "미식형 타이베이 초호화 리조트",
    "센과 치히로 도쿄 온천 데이패스",
    "파리 감성 세느강 유람선",
    "스위스 인터라켄 패러글라이딩",
    "푸켓 선셋 요트 크루즈",
    "발리 우붓 요가 리트릿",
    "하와이 오아후 서핑 레슨",
    "로마 바티칸 프라이빗 투어",
    "이스탄불 보스포루스 나이트 크루즈",
    "마카오 하이라이트 시티투어",
    "싱가포르 마리나베이 샌즈 전망대",
    "홍콩 빅버스 시내 일주",
    "시드니 블루마운틴 국립공원",
    "뉴욕 브로드웨이 뮤지컬 패키지",
    "라스베이거스 그랜드캐니언 헬기",
    "하코네 로프웨이+해적선 1일권",
    "오사카 도톤보리 미식 투어",
    "교토 사찰 기모노 체험",
    "후쿠오카 야나가와 뱃놀이",
    "사이판 마나가하 섬 호핑",
    "괌 돌핀 와칭 스노클링",
    "타히티 보라보라 워터빌라",
    "몰디브 올인클루시브 리조트",
    "나미비아 사막 사파리",
    "케냐 마사이마라 열기구",
    "아이슬란드 오로라 체이싱",
    "노르웨이 피오르드 크루즈",
    "핀란드 산타 마을 체험",
    "바르셀로나 가우디 투어",
    "마드리드 태피오 마스터클래스",
    "리스본 트램28 시티패스",
    "프라하 성 야경 워킹투어",
    "빈 클래식 콘서트 나이트",
    "부다페스트 온천 스파 패스",
    "두바이 사막 사파리 프리미엄",
    "아부다비 그랜드모스크+루브르",
    "카이로 기자 피라미드 탐험",
    "요르단 페트라 고고학 투어",
    "쿠알라룸푸르 쌍둥이타워 전망대",
    "치앙마이 코끼리 보호구역",
    "라오스 방비엥 카약킹",
    "씨엠립 앙코르왓 일출 투어",
    "다낭 바나힐 골든브릿지",
    "나트랑 4섬 호핑투어",
    "호이안 랜턴 야경 포토",
    "하롱베이 럭셔리 크루즈",
    "상하이 디즈니 1일 패스",
]


def pick_name(product_code: str) -> str:
    if not product_code:
        return "익명 여행 상품"
    # Deterministic hash -> index
    h = hashlib.md5(product_code.encode("utf-8")).hexdigest()
    idx = int(h[:8], 16) % len(NAMES)
    return NAMES[idx]


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "user_inquiry_dummy_database.csv"
    if not os.path.exists(path):
        print(f"파일을 찾을 수 없습니다: {path}", file=sys.stderr)
        return 2

    # Read
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        rows = list(reader)
    if not rows:
        print("빈 CSV입니다.")
        return 0

    header = rows[0]
    norm = [h.replace("\u00A0", " ").strip() for h in header]

    try:
        idx_code = norm.index("상품 코드")
    except ValueError:
        print("'상품 코드' 열을 찾을 수 없습니다.", file=sys.stderr)
        return 1

    try:
        idx_name = norm.index("상품명")
        has_name = True
    except ValueError:
        has_name = False
        idx_name = idx_code + 1  # insert after product code

    # Insert column if missing
    if not has_name:
        header.insert(idx_name, "상품명")
        for i in range(1, len(rows)):
            row = rows[i]
            if len(row) < len(header):
                row.extend([""] * (len(header) - len(row)))
            row.insert(idx_name, "")

    # Build name map per product code
    name_map = {}
    for i in range(1, len(rows)):
        row = rows[i]
        # normalize row length
        if len(row) < len(header):
            row.extend([""] * (len(header) - len(row)))
        code = str(row[idx_code]).strip()
        if code not in name_map:
            name_map[code] = pick_name(code)
        row[idx_name] = name_map[code]

    # Write back (with BOM)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for i in range(1, len(rows)):
            writer.writerow(rows[i])
    os.replace(tmp, path)
    print(f"상품명 컬럼 업데이트 완료: {path} (총 {len(name_map)}개 상품)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

