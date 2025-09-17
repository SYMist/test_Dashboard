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
