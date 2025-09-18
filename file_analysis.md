# 파일 분석 결과

## 주요 사용 파일
사용자는 주로 `product_order_dummy_database.csv`와 `user_inquiry_dummy_database.csv` 파일을 사용합니다. `user_inquiry_from_response.csv`는 대시보드에서 조회는 되지만 잘 사용하지 않습니다.

## Python 스크립트

*   **`build_user_inquiry_csv.py`**: `response.json` 파일을 읽어 `user_inquiry_from_response.csv` 파일을 생성하는 스크립트입니다. JSON 데이터에서 '상품 코드', '언어', '카테고리' 등의 정보를 추출하고 정제하는 역할을 합니다.
*   **`inspect_values.py`**: `response.json` 파일의 내용을 검사하여 특정 ID에 해당하는 값들을 출력하는 스크립트입니다. 데이터 구조를 확인하거나 디버깅 용도로 사용되는 것으로 보입니다.
*   **`json_to_csv.py`**: JSON 파일을 CSV 파일로 변환하는 일반적인 유틸리티 스크립트입니다. `response.json`과 같이 'value' 키 아래에 데이터 리스트가 있는 구조의 JSON을 처리합니다.

## 데이터 파일

*   **`response.json`**: 사용자 문의 데이터가 들어있는 원본 JSON 파일입니다. 'value' 키 아래에 각 문의에 대한 상세 정보(티켓 ID, 요약, 사용자 정의 필드 등)가 리스트 형태로 저장되어 있습니다.
*   **`product_order_dummy_database.csv`**: 상품 주문 관련 더미 데이터가 포함된 CSV 파일입니다. "주문 ID", "상품 코드", "상품명" 등의 컬럼을 가집니다.
*   **`user_inquiry_dummy_database.csv`**: 사용자 문의 관련 더미 데이터가 포함된 CSV 파일입니다. "상품 코드", "상품명", "언어", "카테고리" 등의 컬럼을 가집니다.
*   **`user_inquiry_from_response.csv`**: `build_user_inquiry_csv.py` 스크립트를 통해 `response.json` 파일로부터 생성된 CSV 파일입니다. 정제된 사용자 문의 데이터가 들어있습니다.

## 대시보드 파일

*   `dashboard_product_counts_json.html`, `dashboard_product_counts.html`, `dashboard_product_counts.js`: 이 파일들은 상품 수와 관련된 데이터를 시각화하는 대시보드를 생성하는 데 사용되는 것으로 보입니다.

---

## 추가 분석 업데이트 (2025-09-17)

### 전체 흐름 요약
- 원천 데이터: `response.json` (`value` 키 아래 리스트 형태)
- 변환 A: `build_user_inquiry_csv.py` → `user_inquiry_from_response.csv` 생성
- 변환 B: `json_to_csv.py` → 범용 변환기로 `response_value.csv` 등 생성
- 시각화: `node dashboard_product_counts.js --csv <CSV>` → HTML 대시보드 (`dashboard_product_counts*.html`) 생성
- 샘플/테스트 데이터: `user_inquiry_dummy_database.csv`, `product_order_dummy_database.csv`

### 파일별 상세 분석

- `json_to_csv.py` (범용 JSON→CSV)
  - `response.json`처럼 `{"value": [...]}` 구조를 가정하고 `value` 리스트를 CSV로 직렬화.
  - 선호 컬럼 순서(preferred): `id, ticket_id, priority, channel, assignee_id, requester_id, requester_email, ticket_summary, ticket_content, custom_values_text, tags, custom_fields, @search.score` 후, 데이터에서 발견되는 추가 키를 동적으로 뒤에 붙임.
  - 리스트/딕셔너리 값은 `json.dumps(..., ensure_ascii=False)`로 문자열화하여 CSV에 저장.
  - 출력 인코딩은 `utf-8-sig`로 BOM을 포함해 엑셀 호환성 확보.
  - 에러/엣지케이스: `value`가 비어있거나 리스트가 아니면 종료 코드 1 반환 및 경고 출력.
  - 사용 예: `python3 json_to_csv.py response.json response_value.csv`

- `build_user_inquiry_csv.py` (업무 지향 JSON→CSV)
  - 목적: `response.json`에서 문의 분석에 필요한 최소 필드를 뽑아 `user_inquiry_from_response.csv` 생성.
  - 커스텀 필드 IDs: 유형(41988618714009), 카테고리(41988850452761), 예약코드(41989351980441), 언어/상품값(41989966629273)
  - `extract_locale`: URL/문자열에서 `en`, `zh-HK`, `ko-KR` 등 로케일 토큰 추출.
  - `extract_product_code`: 경로의 마지막 숫자 세그먼트 또는 문자열 내 마지막 숫자 시퀀스의 끝 5자리 추출.
  - `clean_scalar`: "무/없음/None/null/Undefined/N/A" 등 플레이스홀더 값을 공백으로 정리.
  - 결과 헤더: `상품 코드, 언어, 카테고리, 문의 유형, 문의 내용, 요청 ID, 예약코드`
  - 출력 인코딩: `utf-8-sig` (BOM 포함)
  - 사용 예: `python3 build_user_inquiry_csv.py` → `user_inquiry_from_response.csv`

- `inspect_values.py` (점검용)
  - `response.json`의 앞쪽 몇 건에 대해 주요 커스텀 필드 값 출력. 구조 확인/디버깅 용.
  - 사용 예: `python3 inspect_values.py`

- `dashboard_product_counts.js` (Node 기반 정적 대시보드 생성기)
  - 입력 CSV의 필수 헤더: `상품 코드`, `문의 유형`, `언어` (정확한 한글 컬럼명 필요; `\u00A0` NBSP 정규화 처리 포함)
  - 선택 헤더: `예약 상태`, `예약코드`, `문의 내용`, `요청 ID`
  - 기능 요약:
    - 상품×유형×언어 삼중 집계 및 수평 스택 바 차트 렌더링
    - 예약 상태별 전체/상품별 분포, 언어/유형 분해 뷰 제공
    - 상품별 최근 문의 텍스트/요청 ID 샘플 최대 20개씩 툴팁 표시
    - 주문 CSV(`product_order_dummy_database.csv`)가 존재하면 상품별 문의/주문 비율(%) 카드 생성
    - `--mode json` 또는 입력이 `user_inquiry_from_response.csv`인 경우 JSON 친화 모드 UI/문구 적용
  - 출력 파일: 기본 `dashboard_product_counts.html` 또는 JSON모드 시 `dashboard_product_counts_json.html`
  - 사용 예: `node dashboard_product_counts.js --csv user_inquiry_dummy_database.csv`

### 데이터 파일 스키마 관찰
- `user_inquiry_dummy_database.csv`
  - 헤더: `상품 코드, 상품명, 언어, 카테고리, 문의 유형, 문의 내용, 요청 ID, 예약코드, 예약 상태, createdAt`
  - 대시보드는 이 중 `상품 코드/언어/문의 유형`을 최소로 사용하고, `예약 상태/예약코드`가 있으면 추가 분석 수행.
- `user_inquiry_from_response.csv`
  - 헤더: `상품 코드, 언어, 카테고리, 문의 유형, 문의 내용, 요청 ID, 예약코드` (예약 상태 없음)
  - `dashboard_product_counts.js`는 `예약 상태` 부재를 감지(-1 인덱스)하여 예약 상태 관련 UI를 자동 비활성화.
- `product_order_dummy_database.csv`
  - 헤더: `주문 ID, 상품 코드, 상품명, ...`
  - 상품별 주문 건수 집계에만 사용되며, 헤더에서 `상품 코드` 위치만 필요.

### 주의사항 및 개선 제안
- 컬럼명 정확도
  - 스크립트는 한글 컬럼명을 정확히 찾습니다. 공백/NBSP 혼용을 정규화하지만, 철자 변경은 인식하지 못합니다. CSV 생성 시 컬럼명 유지 필요.
- 인코딩
  - CSV는 `utf-8-sig`로 저장되어 Excel 호환성이 좋습니다. 다른 도구로 재저장 시 BOM이 손상되면 첫 컬럼명이 깨질 수 있어 주의.
- `extract_product_code`의 5자리 제한
  - 현재 마지막 숫자 시퀀스의 "끝 5자리"만 취합니다. 실제 상품 코드가 5자 초과일 경우 원본 코드 손실 가능. 필요 시 전체 숫자 또는 고정 길이 규칙으로 수정 권장.
- 메모리 사용
  - `json_to_csv.py`와 `build_user_inquiry_csv.py`는 전체 JSON을 메모리에 로드합니다. `response.json`이 매우 큰 경우 스트리밍 처리(orjson/ijson) 고려.
- 대시보드 상수 문자열
  - `dashboard_product_counts.js`는 특정 태그 문자열(예: '상품 문의')를 별도 강조에 사용합니다. 업무 표준화가 바뀌면 해당 문자열을 상수로 분리해 설정화하는 것을 권장.

### 빠른 실행 가이드
- 문의 CSV 생성: `python3 build_user_inquiry_csv.py` → `user_inquiry_from_response.csv`
- 범용 변환: `python3 json_to_csv.py response.json response_value.csv`
- 대시보드 HTML 생성:
  - 더미 데이터: `node dashboard_product_counts.js --csv user_inquiry_dummy_database.csv`
  - 실데이터: `node dashboard_product_counts.js --csv user_inquiry_from_response.csv --out dashboard_product_counts_json.html`

### 파일 간 관계 다이어그램(문자)
- `response.json` → (`build_user_inquiry_csv.py`) → `user_inquiry_from_response.csv` → (`dashboard_product_counts.js`) → `dashboard_product_counts_json.html`
- `user_inquiry_dummy_database.csv` → (`dashboard_product_counts.js`) → `dashboard_product_counts.html`
- `response.json` → (`json_to_csv.py`) → `response_value.csv` (분석 보조/검증용)

---

## 추가 변경 사항 (2025-09-17 오후)

### 신규 기능/개선 요약
- 상단 “일자 별 문의 수” 라인 차트 추가
  - 단위 탭바: 일/월/분기/반기/연 기준 중 1개만 선택(기본: 일)
  - CSV의 `createdAt` 기준으로 날짜(YYYY-MM-DD) 집계 후, 선택 단위로 화면 내에서 재집계하여 표시
  - 메타 표시: 단위/기간/총 건수

- 상품 축 라벨을 ‘상품 코드’ → ‘상품명’으로 변경
  - CSV `상품명`을 읽어 코드→이름 매핑 후 Y축과 상세 팝업에 표시

- ‘주문량 보기’ 토글 추가 (상품 기반 분석 탭에서만)
  - 켜면 각 행에 주문 수량을 회색 얇은 보조 막대로 병행 표기
  - 주문 데이터는 `product_order_dummy_database.csv`를 집계하여 사용
  - X축 스케일은 문의/주문 중 최댓값을 기준으로 통일하여 비교 용이

- ‘예약코드 별 문의 수’ 차트 추가/개선
  - 예약 기반 분석 탭 하단 카드에 렌더링
  - 예약코드별 건수 내림차순 정렬

### 버그 수정/안정화
- 템플릿 리터럴 중첩으로 인한 Node 구문 오류를 문자열 연결 방식으로 교체 (예약코드 차트 렌더 부분)
- `statusLangType` 맵 초기화 버그 수정(중첩 맵 set 로직 보정)

### 새 스크립트
- `fill_product_names.py`
  - `user_inquiry_dummy_database.csv`에 `상품명` 컬럼을 추가/갱신
  - 상품 코드 해시 기반 결정적 랜덤 네이밍으로 동일 코드에 항상 동일 이름 할당

### 데이터 파싱/주입 변경점 (dashboard_product_counts.js)
- CSV 추가 컬럼 사용: `상품명`, `createdAt`
- 템플릿 데이터 추가: `codeNameMap`(코드→상품명), `dateCounts`(일 단위 집계)
- 예약코드 집계: `resvCodeCounts`를 객체로 주입 후 하단 차트에서 사용

### 사용 방법 요약
- 대시보드 생성: `node dashboard_product_counts.js --csv user_inquiry_dummy_database.csv`
- 페이지 상단: “일자 별 문의 수” 탭바에서 단위를 선택(항상 1개만 활성)
- 상품 기반 분석 탭: 우측 “주문량 보기” 토글로 주문 보조 막대 표시/숨김

### 주의사항
- `상품명`이 없는 CSV의 경우 Y축은 코드로 표시됨
- 상단 차트는 `createdAt`이 있어야 의미 있는 집계가 가능(날짜 문자열 앞 10자 `YYYY-MM-DD` 사용)
- 주문 보조 막대는 `product_order_dummy_database.csv` 존재 시에만 표시됨

---

## 추가 변경 사항 (2025-09-17 저녁)

### 대시보드 상단 UI/차트 개선
- 기간/정렬 UI 추가(차트 외부)
  - “일자 별 문의 수” 카드 위에 기간 필터(시작일/종료일)와 정렬 선택(문의 많은 순/적은 순) UI만 배치
  - 현재는 UI만 제공(동작 로직 미연결)
- 일자 단위 라인 차트 개선
  - 일 기준(daily)에서 최소~최대 날짜 사이의 공백일을 0으로 채워 실제 변동이 보이도록 수정
  - 상단 라인 차트와 상품별 툴팁 라인 차트 모두 호버 툴팁 표시(날짜/건수)

### 상품 라벨/툴팁 상호작용
- 상품명 라벨 클릭 시 동일 폭 툴팁 표시(고정 위치)
  - 툴팁 내부에 해당 상품으로 필터링된 “일자 별 문의 수” 라인 차트와 단위 탭바(일/월/분기/반기/연)
  - 라벨 위치 기준 위쪽 우선 배치, 공간 부족 시 아래로 배치, 좌우는 뷰포트 내로 클램프
  - 툴팁 외부 클릭 시 자동 닫힘

### 기타 정리/버그 수정
- 예약코드 차트: 건수 내림차순 정렬 유지, 문자열 연결 방식으로 재작성해 템플릿 리터럴 오류 해소
- statusLangType 중첩 맵 초기화 버그 수정
- 메인 “일자 별 문의 수” 렌더 함수에 호버 바인딩 통합(이중 바인딩 제거)
- 툴팁 좌표 계산을 fixed 기준으로 수정해 화면 밖 배치 문제 해결

### 현재 상태 정리
- UI
  - 상단: 기간 필터, 정렬 선택(작동 안 함/향후 연결 가능)
  - 상단 카드: “일자 별 문의 수” + 단위 탭바(동작), 호버 툴팁(동작)
  - 상품 기반 분석: 상품명 Y축, “주문량 보기” 토글(동작), 상품명 클릭 툴팁(동작)
- 동작 로직 미연결 항목
  - 상단 기간/정렬 UI는 차트 데이터 필터/정렬과 아직 연동되지 않음(요청 시 연결 가능)

---

## 추가 변경 사항 (2025-09-17 늦은 저녁)

### 예약 기반 · 표시 개선
- 상품 별 주문 대비 문의 비율 카드: 상품 코드 → 상품명으로 표기 변경

### 상품 툴팁(상품 기반 분석) 고도화
- 타이틀 우측에 통계 표기
  - 형식: “· 문의 수/주문 수 = {문의}/{주문} {백분율}” (소수점 2자리 반올림)
- 툴팁 내 시계열 차트 개선
  - 라인 → 그룹형 막대 그래프로 변경(문의: 파랑, 주문: 주황)
  - 단위 탭(일/월/분기/반기/연) 전환 시 문의/주문 동시 재집계 및 렌더
  - 호버 시 “문의: X · 주문: Y” 툴팁 노출
- 주문 시계열 데이터 주입
  - `product_order_dummy_database.csv`의 ‘주문 일시’를 `YYYY-MM-DD`로 절삭하여 상품별·일자별 집계(`perProductOrderDateCounts`)
  - 총 주문량(`orderCounts`)과 함께 템플릿 데이터에 포함
- 위치/표시 안정화
  - 라벨 기준 위쪽 우선 배치, 공간 부족 시 아래 배치, 좌/우 뷰포트 클램프

### 상단 필터 UI 확장(차트 외부)
- 기간 필터/정렬 UI를 “일자 별 문의 수” 카드 밖 상단으로 이동
- ‘상품 검색’ 입력(UI만) 추가: placeholder “상품명 또는 코드”

### “최근 문의 표” 추가 (일자 별 차트 하단)
- 위치: 상단 “일자 별 문의 수” 카드 바로 아래 카드형 테이블
- 컬럼: Created_at, 요청 ID, 예약코드, 상품 코드, 상품명, 언어, 문의 유형, 문의 내용
- 데이터 소스: CSV 파싱 시 수집한 rawRows (id, resvCode, productCode, productName, lang, type, summary, createdAt)
- 표시 개수/페이징: 한 페이지 10행, 페이지네이션(이전/다음/1·2·3) — 클라이언트 렌더
- 검색/정렬: 상단 검색(상품명/코드/요약 본문 부분일치), 정렬(최신순/오래된순; createdAt 기준)
- 링크화: 요청 ID/예약코드는 placeholder 링크(a[data-reqid], a[data-resv])로 표시(행동은 미연결)
