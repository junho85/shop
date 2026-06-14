# 주멍가게 — 설계 문서

> 정적(Vanilla HTML+CSS+JS) 쿠팡 파트너스 추천 상품 페이지. GitHub Pages 호스팅(`shop.junho85.pe.kr`).

## 컨셉
예전 워드프레스(WooCommerce)로 운영하던 **주멍가게**를 정적 사이트로 재구축. 직접 써보고 추천하는 제품을 쿠팡 파트너스 딥링크로 연결한다.

## 파일 구조
```
shop/
├── index.html        # 헤더 / 히어로 / 필터바 / 카드 그리드 / 상세 뷰 / 푸터
├── style.css         # 스타일 (반응형 그리드, 카드, 세일 뱃지, 파란 CTA)
├── app.js            # products.json fetch → 해시 라우팅(목록/필터/상세) 렌더
├── data/products.json# 상품 데이터 (유일한 관리 지점)
├── assets/           # 로컬 이미지·placeholder
├── CNAME             # shop.junho85.pe.kr
└── README.md         # 상품 추가 방법
```

## 데이터 스키마 (`data/products.json`)
```json
{
  "categories": ["전체", "생필품", "디지털", "도서", "육아", "게임", "가구", "미용", "기타"],
  "products": [
    {
      "id": "kebab-case-id",
      "name": "상품명",
      "category": "디지털",
      "image": "이미지 URL (없으면 placeholder)",
      "priceOriginal": 61650,
      "price": 57860,
      "sale": true,
      "note": "카드용 한 줄 코멘트(선택)",
      "description": "상세 페이지 사용기(선택, 줄바꿈 가능)",
      "link": "https://link.coupang.com/a/XXXX",
      "addedAt": "2026-06-14"
    }
  ]
}
```

## 동작
- **해시 라우팅**: `#/` 목록, `#/c/<카테고리>` 카테고리 필터, `#/p/<id>` 상세. 새로고침·공유 시 상태 유지.
- **목록**: 히어로 → "추천 상품" → 카테고리 탭 → 카드 그리드(반응형 1~4열). `addedAt` 최신순.
- **카드**: `sale`이면 `세일!` 뱃지, 썸네일, 상품명, 카테고리, 원가(취소선)+할인가, 별점(장식). `description` 있으면 카드 클릭 시 상세, 없으면 쿠팡으로 바로 이동.
- **상세**: 큰 이미지 / 가격 / `쿠팡 최저가 확인하기!`(파란 CTA, `rel="nofollow sponsored noopener"`, 새 탭) / 사용기.
- **푸터**: 쿠팡 파트너스 제휴 고지 문구 고정.

## 비범위(YAGNI)
장바구니/결제, 다크모드, 상품평, 검색, 빌드 단계, 백엔드. 전부 제외.
