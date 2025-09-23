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
*   **`user_inquiry_dummy_database.csv`**: 사용자 문의 관련 더미 데이터가 포함된 CSV 파일입니다. "상품 코드", "상품명", "언어", "대카테고리(구 카테고리)", "세부 카테고리" 등의 컬럼을 가집니다.
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

---

## 추가 변경 사항 (2025-09-23)

### 인사이트 토글 전반 연동/안정화
- 상단에 “인사이트 보기” 토글 UI 추가(상태는 localStorage 보존)
- 토글 ON 시 ‘인사이트=TRUE’ 행만으로 필터링된 집계 사용
  - 상품 스택 바, 상단 트렌드, 예약코드 차트, ‘주문 대비 문의 비율’, ‘언어별 문의 유형 분포’ 모두 연동
- 일부 뷰는 FULL/INSIGHT 두 벌을 미리 렌더해 CSS로 전환(full-only/insight-only)하여 안정성 확보
- ‘언어별 문의 유형 분포’에서 토글 OFF시 카드가 2개씩 보이던 문제를 CSS 우선 규칙 보강으로 해결

### 정렬 옵션 확장(비율 우선 정렬)
- ‘상품 별 주문 대비 문의 비율’ 카드 정렬에 백분위 높은/낮은 순 추가
  - pct_desc/pct_asc: 주문/문의 절대값과 무관하게 백분율 우선
- ‘언어별 문의 유형 분포’에도 동일 옵션 추가(언어 내 백분율 기준)

### 예약코드 차트 토글 연동
- FULL/INSIGHT 두 세트를 동일 SVG에 동시 렌더 후 CSS 전환(토글/정렬 동작과 일관)

### ‘주문량 보기’(주문 오버레이) 단순화/신뢰성 개선
- 상태 변수 1개(`STATE.dim = 'type'|'lang'`)로 차원 모드만 추적
- applyProductSort()에서 오버레이를 단 한 번 생성해 `#bars-orders`에 주입
  - 언어 모드: 문의 언어 분포 비율로 주문량 분해(언어별 스택)
  - 유형 모드: 회색 단일 바
- 표시 순서·미스매치 해소
  - Y축 라벨을 DOM(`'#ylabels-products .prod-label'`)에서 직접 읽어 실제 화면 순서로 주입
  - 주문 수 조회 안전화(Map/Object, 문자열·숫자 키 모두 지원)
    - `getOrderCount(key)`로 `DATA.orderCounts.get(key)`/`obj[key]`/`obj[Number(key)]`를 순차 조회
- 초기 템플릿에서 `#bars-orders`를 비워두고(사전 하드코딩 제거), 토글/탭/정렬 이벤트마다 재생성
- 전역 미정의로 인한 예외(OPEN_PROD/DRAWER_H) 가드 처리 → 예외로 렌더 중단되는 문제 제거
- 디버깅 헬퍼 추가: `window.rebuildOrders()`로 콘솔에서 수동 재생성 가능

### 기타
- lt-cards/ratios-grid의 full-only/insight-only 전환 CSS를 구체 선택자로 보강(display 충돌 방지)
- 템플릿 초기 `#bars-orders`는 비어 있는 `<g>`로 출력하여 초기 회색 바 노출 제거

### 확인 포인트
- 언어 탭 + ‘주문량 보기’ ON → 주문 오버레이가 언어 색상 스택으로 보임
- 문의 유형 탭 + ‘주문량 보기’ ON → 회색 단일 바
- 콘솔 검사(필요 시):
  - `document.querySelectorAll('#bars-orders rect').length > 0`
  - `window.rebuildOrders()`로 수동 재생성 가능
  - 라벨 기준 위쪽 우선 배치, 공간 부족 시 아래 배치, 좌/우 뷰포트 클램프

### 일자 트렌드 증감 표기 추가
- ‘일자 별 문의 수’ 카드 메타 영역에 전기간 대비 증감 수 표기
  - 단위별 문구: 일=전일, 주=전주, 월=전월, 분기=전분기, 반기=전반기, 연=전년
  - 계산: 현재 선택 단위의 “가장 최근 버킷 − 직전 버킷” 값으로 산출(값 없거나 버킷<2이면 비표시)
  - 표시 예: `단위: 일 · 기간: 2025-09-01 ~ 2025-09-23 · 총 123 · 전일 대비 +5`
  - 적용 파일: `dashboard_product_counts.js` (상단 트렌드 렌더 함수 내 메타 텍스트 생성 로직)

### 상단 분석 탭 버튼 비노출 처리
- 차트 설명 하단의 단일 ‘상품 기반 분석’ 탭 버튼을 UI 상 숨김 처리(display:none)
- 내부 참조는 유지하여 기존 로직과의 호환성 보장
- 적용 파일: `dashboard_product_counts.js`

### 대카테고리별 세부 카테고리 파이차트 3종 추가
- 위치: ‘X축: 건수 · Y축: 상품명 (총 N)’ 바로 아래 카드
- 구성: 좌→우 ‘여행’, ‘쇼핑’, ‘어학당’ 각 대카테고리의 ‘세부 카테고리’ 분포 파이차트
- 인사이트 토글과 연동(FULL/INSIGHT 두 벌 렌더 후 CSS 전환)
- 적용 파일: `dashboard_product_counts.js`

### 파이차트 클릭 → 하단 상품 차트 교차 필터링
- 파이 세그먼트(및 범례) 클릭 시 하단 상품 차트에 교차 필터 적용
  - 상태: `STATE.bigFilter`(대카테고리), `STATE.subFilter`(세부 카테고리)
  - 기존 내부 필터와 병행: ‘문의 유형’ 모드(`STATE.langFilter`), ‘언어’ 모드(`STATE.typeFilter`)
- 주문 오버레이(언어 모드)의 언어 분해 비율도 동일 조건으로 재계산
- 적용 파일: `dashboard_product_counts.js`

### 활성 필터 배지 표시(대카테고리/세부 카테고리)
- 위치: 차트 설명 바로 아래 `#active-filters`
- 표시: 클릭 시 즉시 노출(display:flex), X 아이콘으로 개별 해제/전체 해제(대카테고리 배지 해제 시 세부도 초기화)
- 차트 재렌더(applyProductSort)마다 배지 상태 갱신
- 적용 파일: `dashboard_product_counts.js`

### 총 건수 텍스트에 현재 필터 반영
- 차트 설명의 “총 N”이 현재 필터(대/세부·언어·유형)에 맞게 재계산되어 업데이트
- 적용 파일: `dashboard_product_counts.js`

### 문서/파일 정리
- `PRD.md` 파일 제거(불필요 문서 정리)

### 요구사항 문서 추가(차트별 유저 플로우)
- 신규 문서 `REQUIREMENTS.md` 작성
  - 일자 별 문의 수: 기준 단위 선택(일/주/월/분기/반기/연), 전기간 대비 증감 확인, 호버 툴팁, 인사이트 토글 반영
  - 최근 문의 표: 검색/정렬/페이지네이션, 요청 ID/예약코드 링크(placeholder)
  - 대카테고리 파이: 여행/쇼핑/어학당 세부 카테고리 분포, 클릭 시 하단 상품 차트 교차 필터, 배지로 상태 표시/해제
  - 상품 기반 분석: 차원 전환(문의 유형/언어), 내부 필터 탭(언어/유형), 정렬, 주문 오버레이, 툴팁·세그먼트 상호작용
  - 예약코드 차트: 정렬 지원, 인사이트 토글 반영
  - 주문 대비 문의 비율 카드: 비율 표시 및 정렬, 인사이트 토글 반영
  - 언어별 문의 유형 분포 카드: Top N/비율 표시, 정렬 옵션, 인사이트 토글 반영
  - 인사이트 토글(전역): 전체/인사이트 데이터 전환, 상태 로컬 저장
  - 전역 필터(상단 툴바): 기간/검색 적용 시 전체 시각화에 공통 반영

### 더미 CSV 스키마 조정(카테고리 → 대카테고리)
- `user_inquiry_dummy_database.csv`의 열 이름 ‘카테고리’를 ‘대카테고리’로 변경
- 해당 열의 값은 ‘여행’/‘쇼핑’/‘어학당’ 3종으로 정규화(기존 다른 값들은 ‘여행’으로 맵핑)
- 인코딩은 기존과 동일하게 `utf-8-sig` 유지

### 더미 CSV 스키마 확장(세부 카테고리 추가)
- `user_inquiry_dummy_database.csv`에서 ‘대카테고리’ 오른쪽에 ‘세부 카테고리’ 열 추가
- 행별 매핑 규칙(결정적 난수 기반 분배)
  - 대카테고리=여행 → {전문헤어, 뷰티, 사진, 교통, 오락/체험, 입장권/티켓, 통신/유심, 기타}
  - 대카테고리=쇼핑 → {배송, 품질, 서비스이용, 기타}
  - 대카테고리=어학당 → {신청과정, 신청자격, 비용, 기타}
- 재실행 시에도 같은 행은 동일 세부값이 부여되도록 해시 기반 결정 방식 사용

### 상품 차트 내부 필터 탭 추가/연동
- ‘문의 유형’ 상태일 때 언어 필터 탭 추가(영어/일본어/대만어/홍콩어)
  - 버튼 클릭 시 해당 언어 문의만 집계/표시, 동일 버튼 재클릭 시 해제
  - CSV의 ‘언어’ 값이 한글 라벨(예: “영어”)이므로 버튼 `data-lang`를 동일 라벨로 매칭하도록 수정
  - 반영 위치: `STATE.langFilter`(문의 유형 모드 전용), `computeProdTotals()` 및 `buildBars('type')`
- ‘언어’ 상태일 때 문의 유형 필터 탭 추가(DATA.types 기반 동적 버튼)
  - 버튼 클릭 시 해당 문의 유형만 집계/표시, 재클릭 시 해제
  - 반영 위치: `STATE.typeFilter`(언어 모드 전용), `computeProdTotals()` 및 `buildBars('lang')`
- 주문 오버레이 연동
  - 언어 모드에서 typeFilter가 적용된 경우, 오버레이의 언어 분해 비율도 해당 유형 기준으로 계산하도록 수정
- 탭 가시성
  - showProdType(): 언어 필터 탭 표시, 유형 필터 탭 숨김
  - showProdLang(): 유형 필터 탭 표시, 언어 필터 탭 숨김
  - 적용 파일: `dashboard_product_counts.js`

---

## 추가 변경 사항 (2025-09-22)

### 탭/레이아웃 개편 및 차트 조정
- 예약 기반 차트 병합 표시: 기존 ‘예약 기반 분석’ 탭에서 보이던 예약 관련 차트/카드들을 ‘상품 기반 분석’ 탭 하단에 함께 노출하도록 통합
  - 포함: 예약코드 별 문의 수 카드(`resv-code-chart-card`), 문의/주문 비율 카드(`resv-ratios-card`), 언어별 문의 유형 분포 카드(`resv-langtype-card`)
  - 초기 렌더 시 `renderResvCodeChart(...)` 호출 추가로 예약코드 차트 즉시 렌더
- 상단 분석 탭 제거: ‘상품 기반 분석’/‘예약 기반 분석’ 전환 탭 버튼 삭제(결합 뷰가 기본). `상품 기반 분석(json)` 링크는 유지
- ‘예약 상태’ Y축 차트 제거: 예약 상태를 Y축으로 하는 막대 차트(`scroll-resv`/`chart-resv`)는 화면에서 비노출 처리(HTML 보존, UI 상 숨김)
  - `showAnalProduct`, `showAnalResv` 모두에서 `scrollResv`를 숨겨 더 이상 표시되지 않음
  - 예약 상태 범례(`legend-resv`)도 계속 숨김 유지

### 현재 상태 요약
- 기본 화면: 상품 기반 막대차트(유형/언어 탭), 주문량 보조막대 토글 가능
- 하단 영역: 예약코드 차트, 문의/주문 비율 카드, 언어별 유형 분포 카드 노출
- 제거/비노출: 예약 상태 Y축 차트(상태×유형/언어 전환 포함)

### 데이터 정합성 조정
- 주문 ID ↔ 예약코드 동기화
  - `product_order_dummy_database.csv`의 `주문 ID` 일부를 `user_inquiry_dummy_database.csv`의 `예약코드`로 교체
  - 매핑 기준: 동일 `상품 코드`를 우선 매칭하여 1,750건 치환, `주문 ID` 전역 유일성 보장
  - 잔여 주문은 기존 `주문 ID` 유지(충돌 방지), 파일 인코딩은 `utf-8-sig` 유지

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

---

## 추가 변경 사항 (2025-09-22 오후)

### 인사이트 뷰 토글 및 필터링
- 상단 툴바에 ‘인사이트 뷰’ 토글 추가
- 토글 ON 시 `user_inquiry_dummy_database.csv`에서 ‘인사이트’ 값 TRUE인 행만 기준으로 재집계
  - 적용 대상: 상단 일자 차트, 메인 상품 차트(유형/언어), ‘예약코드 별 문의 수’ 차트, 총 건수 텍스트
- generator(`dashboard_product_counts.js`)가 CSV ‘인사이트’ 컬럼을 읽어 `rawRows[].insight`로 포함하도록 반영

### 탭/버튼/차트 정리(최종)
- ‘상품 기반 분석(json)’ 버튼 제거(HTML 생성 단계에서 출력하지 않음)
- ‘예약 상태’ Y축 차트 섹션은 화면에서 비노출 유지(예약 관련 카드들은 상품 화면에서 노출)
- ‘예약 코드 별 문의 수’ 차트는 상품 화면 진입 시 즉시 렌더되도록 호출 추가로 미노출 문제 해결

### CSV 업데이트/정리
- `user_inquiry_dummy_database.csv`에 ‘인사이트’ 컬럼 추가 및 무작위 35% TRUE 지정(2423 중 848)
- 백업 파일 정리: `product_order_dummy_database.csv.bak`, `user_inquiry_dummy_database.csv.bak_insight` 삭제
