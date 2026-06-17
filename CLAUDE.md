# 주멍가게 (shop.junho85.pe.kr) — AI 운영 규칙

직접 써본 제품을 쿠팡 파트너스·알리익스프레스 제휴 링크로 추천하는 정적 사이트.
GitHub Pages 호스팅, 빌드 도구 없음(순수 HTML+CSS+JS). 데이터 단일 소스 = `data/products.json`.

## 커밋·푸시 (중요)
- **git commit·push는 자동으로 하지 않는다. 항상 사용자에게 먼저 확인받는다.**
- 파일 수정·로컬 미리보기(`python3 -m http.server`)·검증은 물어보지 않고 진행해도 된다.
- force-push가 필요한 경우(히스토리 재작성) 특히 명시적으로 확인.

## 쿠팡 파트너스 딥링크 — subId=shopshop (필수)
- 쿠팡 상품 링크는 **항상 채널 `subId=shopshop`으로 생성**한다. (수익 채널 분리)
- 옵션이 있는 상품은 `vendorItemId`를 보존한다.
- `coupang-deeplink` 스킬 사용:
  ```bash
  # 상품 페이지 URL(옵션 포함)을 shopshop 채널 딥링크로
  python3 scripts/deeplink.py "https://www.coupang.com/vp/products/<id>?vendorItemId=<vid>" --sub-id shopshop
  ```
- 사용자가 일반 딥링크(`link.coupang.com/a/...`)를 줘도, 가능하면 풀어서(`curl -sIL`로 `vp/products/<id>?vendorItemId=<vid>` 추출) **shopshop으로 재발급**해 쓴다.
- 파트너스 트래킹코드는 **AF7634218** (상품 링크·푸터 검색바 동일 계정).

## 상품 데이터 (`data/products.json`)
한 상품 = 객체. 주요 필드:
- `id`(kebab-case), `name`, `category`(categories 배열 중 하나), `image`, `price`, `note`, `description`, `link`, `addedAt`(YYYY-MM-DD, 최신순 정렬), `priceHistory`([{date,price}]).
- **플랫폼**: 쿠팡은 필드 생략(기본). 알리는 `"platform": "aliexpress"`.
  - 알리는 가격이 수시로 바뀌므로 `price: null`(카드/상세에 "가격 확인" 표시), `priceHistory: []`.
  - 알리 이미지는 `og:image`의 `thumbnail.coupangcdn` 대신 `ae01.alicdn.com/...` 직접 URL 사용.
- **구매 희망(위시리스트)**: 직접 써본 게 아니라 사러 고려 중인 상품은 `"wish": true`.
  - "구매 희망" 카테고리 탭 + 🛒 뱃지로 "써본 추천템"과 구분된다. 설명도 "아직 써보진 않았고…"로 솔직하게.
- `sale: true` + `priceOriginal`이 있으면 카드에 "세일!" 뱃지 + 원가 취소선.

## 상품 추가 표준 절차
1. 딥링크/링크 → `curl -sIL`로 `vp/products/<id>`(+vendorItemId) 추출.
2. 쿠팡 상품 페이지는 **MCP 크롬이 차단**되므로 `cmux browser`로 직접 열어 읽는다.
   - 딥링크 리다이렉트 지연이 있으니 `document.title`이 안정될 때까지 폴링 후 이름·`og:image`·가격(스크린샷) 확인.
3. 이미지: `og:image`의 `//thumbnail.coupangcdn.com/...`에 `https:` 붙여 사용. (알리는 `ae01.alicdn.com` 직접 URL)
4. 쿠팡이면 링크를 **shopshop 딥링크로 재발급**.
5. `products.json`에 항목 추가(가격은 사용자가 산 옵션 기준, `priceHistory`에 오늘 날짜로 시드).

## 이미지·캐시 주의
- `<img>`에 `loading="lazy"`를 동적삽입+뷰포트 내에서 쓰면 Chrome에서 영구 pending(안 뜸) → lazy 쓰지 않는다.
- `app.js`/`style.css`를 바꾸면 `index.html`의 `?v=N`을 올려 캐시를 무효화한다. (`products.json`은 `fetch(cache:no-cache)`라 버전 불필요)

## 배포
- `main` 푸시 → GitHub Pages 자동 빌드. 빌드 트리거/상태: `gh api -X POST repos/junho85/shop/pages/builds`, `gh api repos/junho85/shop/pages/builds --jq '.[0].status'`.
