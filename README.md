# 주멍가게 (shop.junho85.pe.kr)

직접 써보고 좋았던 제품을 쿠팡 파트너스 링크로 추천하는 정적 사이트.
빌드 도구·백엔드 없이 **순수 HTML+CSS+JS**로 동작하며 GitHub Pages로 호스팅한다.

## 상품 추가/수정하는 법

`data/products.json` 의 `products` 배열만 편집하면 된다. (페이지는 자동 반영)

```json
{
  "id": "kebab-case-고유id",
  "name": "상품명",
  "category": "디지털",          // categories 배열 중 하나
  "image": "https://...jpg",     // 쿠팡 이미지 URL. 비우면 placeholder 표시
  "priceOriginal": 61650,        // 원가 (할인 표시용, 선택)
  "price": 57860,                // 표시 가격
  "sale": true,                  // true면 '세일!' 뱃지 + 원가 취소선
  "note": "카드 한 줄 코멘트(선택)",
  "description": "상세 페이지 사용기(선택, \\n 줄바꿈 가능)",
  "link": "https://link.coupang.com/a/XXXX",  // 쿠팡 파트너스 딥링크
  "addedAt": "2026-06-14"        // 최신순 정렬 기준
}
```

- **카테고리**는 `categories` 배열에서 관리한다. 새 카테고리를 쓰려면 배열에 먼저 추가.
- `description` 이 있으면 카드 클릭 시 **상세 페이지**로, 없으면 **쿠팡으로 바로 이동**한다.

## 링크 — 쿠팡 파트너스 딥링크

현재 모든 `link` 는 **파트너스 딥링크**(`link.coupang.com/a/...`)로 들어가 있어 수익이 추적된다.
다만 초기 샘플은 **검색 결과 페이지** 기반 딥링크라 특정 상품 페이지로 바로 가지 않는다.
정확한 상품 페이지로 연결하려면 실제 쿠팡 상품 URL(`coupang.com/vp/products/...`)을 딥링크로 변환해 교체한다.

새 상품 추가 시 링크 변환은 Claude Code `coupang-deeplink` 스킬을 쓰면 된다:
```bash
# 실제 상품 검색(로켓 여부·모델명 확인) → 상품 URL 딥링크 변환
python3 scripts/search.py "상품명" --rocket-only
python3 scripts/deeplink.py "https://www.coupang.com/vp/products/<id>"
# 또는 검색형 딥링크(폴백)
python3 scripts/deeplink.py --search "상품명 모델명"
```

## 제휴 고지

푸터에 쿠팡 파트너스 고지 문구가 항상 표시된다 (파트너스 운영 정책 필수 사항).

## 로컬 미리보기

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```
(파일을 `file://` 로 직접 열면 `fetch`가 CORS로 막히므로 반드시 로컬 서버로 띄운다.)

## 구조

| 파일 | 역할 |
|------|------|
| `index.html` | 골격 (헤더/푸터/앱 컨테이너) |
| `style.css` | 스타일 |
| `app.js` | products.json 로드 + 해시 라우팅(목록/필터/상세) |
| `data/products.json` | 상품 데이터 (유일한 관리 지점) |
| `assets/` | placeholder·hero 이미지 |
| `DESIGN.md` | 설계 문서 |
