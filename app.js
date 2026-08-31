'use strict';

const PLACEHOLDER = 'assets/placeholder.svg';
let DATA = { categories: ['전체'], products: [] };
let DEALS = { fetchedAt: '', deals: [] };
let TASKS = { tasks: [] };

const $app = document.getElementById('app');
const $nav = document.getElementById('nav');

const won = (n) => '₩' + Number(n).toLocaleString('ko-KR');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (id) => DATA.products.find((p) => p.id === id);
const sorted = (list) => [...list].sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')));

/* 가격 변화 인라인 SVG 차트 */
function priceChart(history) {
  if (!Array.isArray(history) || !history.length) return '';
  const W = 600, H = 190, padL = 64, padR = 18, padT = 18, padB = 38;
  const prices = history.map((h) => h.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = (max - min) || 1;
  const n = history.length;
  const x = (i) => (n === 1 ? padL + (W - padL - padR) / 2 : padL + (W - padL - padR) * i / (n - 1));
  const y = (p) => padT + (H - padT - padB) * (1 - (p - min) / span);
  const pts = history.map((h, i) => [x(i), y(h.price)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const dots = pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="var(--accent)"/>`).join('');
  const yLabels = `<text x="${padL - 10}" y="${(y(max) + 4).toFixed(1)}" text-anchor="end" class="axisl">${won(max)}</text>` +
    (max !== min ? `<text x="${padL - 10}" y="${(y(min) + 4).toFixed(1)}" text-anchor="end" class="axisl">${won(min)}</text>` : '');
  const first = history[0].date, last = history[n - 1].date;
  const xLabels = `<text x="${x(0).toFixed(1)}" y="${H - 12}" text-anchor="${n === 1 ? 'middle' : 'start'}" class="axisl">${esc(first)}</text>` +
    (n > 1 ? `<text x="${x(n - 1).toFixed(1)}" y="${H - 12}" text-anchor="end" class="axisl">${esc(last)}</text>` : '');
  const cur = history[n - 1].price;
  const note = n === 1
    ? '오늘 가격을 기록했습니다. 다음 확인부터 변화가 그려집니다.'
    : `현재 ${won(cur)} · 최저 ${won(min)} · 최고 ${won(max)} (기록 ${n}회)`;
  return `
    <div class="detail-chart">
      <h3>가격 변화</h3>
      <svg viewBox="0 0 ${W} ${H}" class="pricechart" role="img" aria-label="가격 변화 차트">
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" class="axis"/>
        <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" class="axis"/>
        ${n > 1 ? `<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
        ${dots}${yLabels}${xLabels}
      </svg>
      <p class="chart-note">${note}</p>
    </div>`;
}

/* ---------- Routing ---------- */
function parseHash() {
  const h = (location.hash || '#/').replace(/^#/, '');
  const parts = h.split('/').filter(Boolean); // ['c','게임'] | ['p','id'] | []
  if (parts[0] === 'p' && parts[1]) return { view: 'detail', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'c' && parts[1]) return { view: 'list', cat: decodeURIComponent(parts[1]) };
  if (parts[0] === 't' && parts[1]) return { view: 'task', id: decodeURIComponent(parts[1]) };
  return { view: 'list', cat: '전체' };
}

const SCROLL_OFFSET = 76;   // sticky 헤더(65px) + 여백

/* innerHTML 교체 후 레이아웃이 확정된 뒤 실행.
   rAF는 창이 비활성이면 초당 몇 번까지 throttle되므로 타이머와 경합시켜 먼저 오는 쪽을 쓴다 */
function afterLayout(fn) {
  let done = false;
  const once = () => { if (!done) { done = true; fn(); } };
  requestAnimationFrame(() => requestAnimationFrame(once));
  setTimeout(once, 50);
}

function render() {
  const r = parseHash();
  gaPageView();
  renderNav(r.view === 'list' ? r.cat : null);
  renderRail();
  if (r.view === 'detail') {
    const p = byId(r.id);
    if (p) return renderDetail(p);
    location.hash = '#/';
    return;
  }
  if (r.view === 'task') {
    const t = taskById(r.id);
    if (t) return renderTask(t);
    location.hash = '#/';
    return;
  }
  renderList(r.cat || '전체');
  /* 카테고리를 고르면 위쪽 추천 캐러셀을 지나 상품 리스트로 내려간다.
     innerHTML 직후엔 레이아웃이 확정되기 전이라 스크롤이 씹힌다 → 다음 프레임에 실행 */
  /* 카테고리를 고르면 상품 리스트로, 홈이면 맨 위로.
     innerHTML 교체 직후엔 레이아웃이 확정되기 전이라 다음 프레임에 실행한다 */
  afterLayout(() => {
    let top = 0;
    if (r.cat && r.cat !== '전체') {
      const el = document.getElementById('products');
      if (el) top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    }
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
}

/* ---------- Nav ---------- */
/* 상품이 하나도 없는 카테고리는 메뉴·필터에 노출하지 않는다 */
function categoryCount(c) {
  if (c === '전체') return DATA.products.length;
  if (c === '구매 희망') return DATA.products.filter((p) => p.wish).length;
  return DATA.products.filter((p) => p.category === c).length;
}
function visibleCategories() {
  return DATA.categories.filter((c) => categoryCount(c) > 0);
}

function renderNav(activeCat) {
  $nav.innerHTML = visibleCategories()
    .filter((c) => c !== '전체')
    .map((c) => `<a href="#/c/${encodeURIComponent(c)}" class="${c === activeCat ? 'active' : ''}">${esc(c)}</a>`)
    .join('');
}

/* ---------- 개인화 (이 브라우저 기준, localStorage) ---------- */
const LS_KEY = 'jumeong_interest_v1';
let searchQuery = '';
let onSearchInput = null;                 // renderList 가 자기 onQuery 로 채운다
const $search = document.getElementById('globalSearch');
let searchTimer = null;

/* ---------- Google Analytics 4 ----------
   측정 ID 를 채우면 켜진다. 비워두면 스크립트를 아예 불러오지 않는다.
   analytics.google.com → 관리 → 데이터 스트림에서 'G-' 로 시작하는 값을 복사해 넣는다. */
const GA_ID = 'G-QH32GHL4HG';   // 주멍가게 (shop.junho85.pe.kr) · GA4 속성 552190978

function initGA() {
  if (!GA_ID) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  /* 해시 라우팅이라 화면 전환을 자동으로 못 잡는다 → page_view 는 gaPageView 로 직접 보낸다 */
  gtag('config', GA_ID, { send_page_view: false });
  const sc = document.createElement('script');
  sc.async = true;
  sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
  document.head.appendChild(sc);
}
const gaReady = () => Boolean(GA_ID && window.gtag);

function gaEvent(name, params) {
  if (!gaReady()) return;
  try { window.gtag('event', name, params || {}); } catch (e) {}
}
function gaPageView() {
  if (!gaReady()) return;
  gaEvent('page_view', {
    page_title: document.title,
    page_location: location.href,
    page_path: location.pathname + (location.hash || '#/'),
  });
}
initGA();

function loadInterest() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
}
function saveInterest(d) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (e) {} }

/* kind: 'view'(상세 열람) | 'cta'(쿠팡 이동=구매의사) | 'search' */
function track(kind, data) {
  const d = loadInterest();
  d.products = d.products || {};
  d.categories = d.categories || {};
  d.searches = d.searches || [];
  if ((kind === 'view' || kind === 'cta') && data.id) {
    const pr = d.products[data.id] = d.products[data.id] || { views: 0, cta: 0 };
    if (kind === 'view') pr.views++; else pr.cta++;
    if (data.cat) d.categories[data.cat] = (d.categories[data.cat] || 0) + (kind === 'cta' ? 2 : 1);
  } else if (kind === 'search' && data.q) {
    d.searches.push({ q: data.q });
    if (d.searches.length > 50) d.searches = d.searches.slice(-50);
    (data.cats || []).forEach((c) => { d.categories[c] = (d.categories[c] || 0) + 1; });
  }
  saveInterest(d);
  sendToGA(kind, data);
}

/* 개인화용 기록과 같은 지점에서 GA4 로도 보낸다 */
function sendToGA(kind, data) {
  if (!gaReady()) return;
  const p = data.id ? byId(data.id) : null;
  const item = p ? {
    item_id: p.id,
    item_name: p.name,
    item_category: p.category,
    price: p.price == null ? undefined : p.price,
    currency: 'KRW',
    platform: p.platform || 'coupang',
  } : null;

  if (kind === 'view' && item) {
    gaEvent('view_item', { currency: 'KRW', value: item.price, items: [item] });
  } else if (kind === 'cta' && item) {
    /* 제휴 링크 클릭 — 이 사이트에서 가장 중요한 지표 */
    gaEvent('affiliate_click', {
      item_id: item.item_id, item_name: item.item_name,
      item_category: item.item_category, platform: item.platform,
      value: item.price, currency: 'KRW',
    });
    gaEvent('select_item', { items: [item] });
  } else if (kind === 'search' && data.q) {
    gaEvent('search', { search_term: data.q, categories: (data.cats || []).join(',') });
  } else if (kind === 'task' && data.id) {
    const t = taskById(data.id);
    gaEvent('task_view', { task_id: data.id, task_title: t ? t.title : '' });
  }
}

function interestScore(p, d) {
  const pr = (d.products || {})[p.id] || { views: 0, cta: 0 };
  const catAff = (d.categories || {})[p.category] || 0;
  return pr.views * 3 + pr.cta * 8 + catAff;
}
function isEngaged(p, d) {
  const pr = (d.products || {})[p.id];
  return !!(pr && (pr.views || pr.cta));
}

/* 직접 클릭/열람한 상품 + 관심 카테고리 기반 추천을 섞어 상위 N개 */
function personalizedPicks(limit) {
  const d = loadInterest();
  const hasHistory = (d.products && Object.keys(d.products).length) ||
    (d.categories && Object.keys(d.categories).length);
  if (!hasHistory) return [];
  const scored = DATA.products
    .map((p) => ({ p, s: interestScore(p, d), eng: isEngaged(p, d) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => (b.eng - a.eng) || (b.s - a.s) ||
      String(b.p.addedAt || '').localeCompare(String(a.p.addedAt || '')));
  return scored.slice(0, limit).map((x) => x.p);
}

/* ---------- 스마트 서제스트 (의도 사전 기반) ---------- */
const INTENTS = [
  { label: '주말·식사로', keys: ['먹', '식사', '밥', '간식', '요리', '저녁', '점심', '아침', '주말', '한끼', '안주', '반찬', '식재료', '먹을', '배고', '야식', '맛있', '먹거리', '군것질', '출출', '입이 심심', '맛난', '식료품', '장보'], cats: ['식품'] },
  { label: '손님 대접엔', keys: ['손님', '대접', '집들이', '파티', '모임', '한상'], ids: ['shabu-mealkit-freshmeal', 'shabu-beef-au-1kg', 'mowi-salmon-sashimi'] },
  { label: '샤브샤브엔', keys: ['샤브', '샤부', '전골'], ids: ['shabu-mealkit-freshmeal', 'shabu-beef-au-1kg', 'shabu-broth-gomgom', 'samsung-induction-1burner'] },
  { label: '조명이 깜빡일 땐', keys: ['전구', '조명', '형광등', '깜빡', '어두', '안정기', '불빛', '등이', '불이', '등기구'], ids: ['ballast-fpl-36w', 'ballast-dooyoung-fpl-55w'] },
  { label: '읽을거리로', keys: ['책', '도서', '읽', '소설', '독서', '읽을', 'sf', '헤일메리'], cats: ['도서'] },
  { label: '청소엔', keys: ['청소', '물때', '때가', '찌든', '세척', '화장실', '수전', '걸레'], ids: ['karcher-mini-pressure-washer'] },
  { label: '양치엔', keys: ['양치', '치아', '이닦', '이 닦', '이를 닦', '양치질', '치약', '칫솔', '구강', '이가', '이빨'], ids: ['median-toothpaste-120-12', 'oralb-vitality-flossaction'] },
  { label: '머리 감을 땐', keys: ['머리', '샴푸', '두피', '감을', '감기'], ids: ['organist-cherryblossom-shampoo'] },
  { label: '휴지 떨어졌을 땐', keys: ['휴지', '화장지', '롤화장'], ids: ['comet-roll-tissue-30'] },
  { label: '출력·인쇄엔', keys: ['종이', '프린트', '출력', '복사', '용지', '인쇄', 'a4'], ids: ['paperone-a4-80g-2500'] },
  { label: '속 편한 우유', keys: ['우유', '유당', '속편', '속이'], ids: ['milk-1a-easy-digest'] },
  { label: '간단한 아침엔', keys: ['시리얼', '콘푸로스트', '초코', '간단', '아침거리'], ids: ['kelloggs-frost-darkchoco', 'gomgom-salad-lunchbox'] },
  { label: '가벼운 한 끼', keys: ['샐러드', '다이어트', '가벼운', '야채', '채소'], ids: ['gomgom-salad-lunchbox'] },
  { label: '두부 요리엔', keys: ['두부', '순두부', '된장'], ids: ['gomgom-tofu-500-2', 'shabu-broth-gomgom', 'fivestar-black-tiger-shrimp'] },
  { label: '해산물로', keys: ['새우', '해산물', '조개'], ids: ['fivestar-black-tiger-shrimp'] },
  { label: '회·사케동엔', keys: ['연어', '사케동', '초밥', '회덮밥', '회'], ids: ['mowi-salmon-sashimi'] },
  { label: '식탁 조리엔', keys: ['인덕션', '버너', '끓여', '식탁', '조리'], ids: ['samsung-induction-1burner'] },
  { label: '촬영·기록엔', keys: ['카메라', '영상', '촬영', '액션캠', '브이로그', '동호회', '기록'], ids: ['dji-osmo-pocket-4'] },
  { label: '습기·보관엔', keys: ['제습', '습기', '필라멘트', '방습', '실리카겔', '곰팡', '3d'], ids: ['homeplanet-silicagel-20'] },
];

/* 규칙(의도 사전 + 키워드) 점수 — suggest와 aiSuggest가 공유 */
function ruleScores(q) {
  const score = {};
  const add = (id, s) => { if (byId(id)) score[id] = (score[id] || 0) + s; };
  let label = null;
  INTENTS.forEach((rule) => {
    if (rule.keys.some((k) => q.includes(k))) {
      label = label || rule.label;
      (rule.ids || []).forEach((id) => add(id, 5));
      (rule.cats || []).forEach((cat) =>
        DATA.products.filter((p) => p.category === cat).forEach((p) => add(p.id, 3)));
    }
  });
  /* 이름·별칭에 그대로 들어간 상품이 의도 사전(5점)에 밀리지 않게 가중치를 둔다.
     예: '순두부'는 사전의 '두부' 규칙에도 걸리는데, 이름이 순두부인 상품이 먼저 와야 한다 */
  const toks = q.split(/\s+/).filter((t) => t.length >= 2);
  DATA.products.forEach((p) => {
    const name = (p.name || '').toLowerCase();
    const kw = (p.keywords || []).join(' ').toLowerCase();
    const rest = [p.note, p.description, p.category].filter(Boolean).join(' ').toLowerCase();
    if (q.length >= 2 && name.includes(q)) add(p.id, 8);       // 검색어 전체가 이름에
    if (q.length >= 2 && kw.includes(q)) add(p.id, 7);         // 별칭 정확히 ('말발굽')
    toks.forEach((t) => {
      if (name.includes(t) || kw.includes(t)) add(p.id, 4);
      else if (rest.includes(t)) add(p.id, 2);
    });
  });
  return { score, label };
}

function suggest(query, limit) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return { message: '', products: [] };
  const { score, label } = ruleScores(q);
  const d = loadInterest();
  const ranked = Object.keys(score)
    .map((id) => ({ p: byId(id), s: score[id] + interestScore(byId(id), d) * 0.1 }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
  const products = ranked.slice(0, limit || 6);
  const message = products.length
    ? (label ? `✨ ${label} 이런 건 어때요?` : '✨ 이런 상품을 추천해요')
    : '✨ 딱 맞는 상품을 못 찾았어요. "주말에 먹을 거", "전구가 깜빡거릴 때"처럼 말해보세요.';
  return { message, products };
}

/* ---------- 브라우저 내 임베딩 AI (Transformers.js · 키/서버 불필요) ---------- */
const AI_MODEL = 'Xenova/multilingual-e5-small';
const AI_FLAG = 'jumeong_ai_on';
let aiState = 'off';      // 엔진 상태: off | loading | ready | error
/* 사용자가 켜둔 의도는 새로고침해도 유지된다. 무거운 모델 로딩만 검색 시점으로 미룬다 */
let aiEnabled = (() => { try { return localStorage.getItem('jumeong_ai_on') === '1'; } catch (e) { return false; } })();
let aiExtractor = null;
let aiProductEmb = null;  // [{id, vec}]
let aiReqSeq = 0;
let aiOnReady = null;     // 뷰가 등록하는 갱신 콜백

function setAiUI() {
  const btn = document.getElementById('aiToggle');
  if (!btn) return;
  /* 헤더 검색창 옆이라 아이콘만 두고, 상태는 툴팁으로 알린다 */
  const label = aiState === 'loading' ? (aiMessage || 'AI 로딩 중…')
    : aiState === 'error' ? 'AI 로딩 실패 — 다시 시도'
      : aiEnabled ? 'AI 의미검색 켜짐 — 끄려면 클릭'
        : 'AI 의미검색 켜기 (상품을 뜻으로 찾아줍니다)';
  btn.classList.toggle('on', aiEnabled && aiState !== 'error');
  btn.classList.toggle('loading', aiState === 'loading');
  btn.textContent = '🧠';
  /* 브라우저 기본 title 툴팁은 1초쯤 늦게 뜬다 → CSS 툴팁으로 즉시 보여준다 */
  btn.dataset.tip = label;
  btn.removeAttribute('title');
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(aiEnabled));
}
let aiMessage = '';
function setAiStatus(msg) {
  aiMessage = msg || '';
  setAiUI();
}

/* 상품 임베딩 캐시.
   모델 파일은 브라우저가 캐시하지만 상품 37개 추론은 매번 다시 하느라 오래 걸렸다.
   결과를 Float32 → base64 로 담아 두고 상품 목록이 그대로면 재사용한다. */
const AI_CACHE = 'jumeong_ai_emb_v1';

function productsSignature() {
  let h = 5381;
  for (const p of DATA.products) {
    const t = p.id + '|' + (p.name || '') + '|' + (p.note || '') + '|' + (p.description || '')
      + '|' + (p.category || '') + '|' + (p.keywords || []).join(',');
    for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  }
  return `${AI_MODEL}:${DATA.products.length}:${h}`;
}
const vecToB64 = (v) => {
  const bytes = new Uint8Array(new Float32Array(v).buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const b64ToVec = (b) => {
  const bin = atob(b);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
};

function loadEmbCache() {
  try {
    const raw = localStorage.getItem(AI_CACHE);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.sig !== productsSignature()) return null;
    return d.items.map((x) => ({ id: x.id, vec: b64ToVec(x.v) }));
  } catch (e) { return null; }
}
function saveEmbCache(emb) {
  try {
    localStorage.setItem(AI_CACHE, JSON.stringify({
      sig: productsSignature(),
      items: emb.map((x) => ({ id: x.id, v: vecToB64(x.vec) })),
    }));
  } catch (e) { /* 용량 초과 등은 그냥 캐시 없이 간다 */ }
}

async function loadAI() {
  if (aiState === 'ready' || aiState === 'loading') return aiState === 'ready';
  aiState = 'loading';
  setAiStatus('AI 모델 다운로드 중… (최초 1회, 다운로드 후엔 캐시됩니다)');
  try {
    const cached = loadEmbCache();
    const TF = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    TF.env.allowLocalModels = false;
    aiExtractor = await TF.pipeline('feature-extraction', AI_MODEL, {
      quantized: true,
      progress_callback: (d) => {
        if (d && d.status === 'progress' && d.total) {
          setAiStatus(`AI 모델 다운로드 중… ${Math.round((d.loaded / d.total) * 100)}%`);
        }
      },
    });
    if (cached) {
      aiProductEmb = cached;
    } else {
      setAiStatus('상품을 분석하는 중…');
      aiProductEmb = [];
      let done = 0;
      for (const p of DATA.products) {
        const text = 'passage: ' + [p.name, p.note, p.description, p.category, (p.keywords || []).join(', ')]
          .filter(Boolean).join('. ');
        const out = await aiExtractor(text, { pooling: 'mean', normalize: true });
        aiProductEmb.push({ id: p.id, vec: new Float32Array(out.data) });
        setAiStatus(`상품을 분석하는 중… ${++done}/${DATA.products.length}`);
      }
      saveEmbCache(aiProductEmb);
    }
    aiState = 'ready';
    aiEnabled = true;
    try { localStorage.setItem(AI_FLAG, '1'); } catch (e) {}
    setAiStatus('🧠 의미 기반 추천이 켜졌어요. 검색해 보세요!');
    if (typeof aiOnReady === 'function') aiOnReady();
    return true;
  } catch (e) {
    aiState = 'error';
    setAiStatus('AI 로드에 실패했어요. 네트워크 확인 후 다시 시도해 주세요.');
    return false;
  }
}

async function aiSuggest(query, limit) {
  if (aiState !== 'ready' || !aiProductEmb) return null;
  const ql = String(query || '').toLowerCase().trim();
  /* 규칙(의도 사전)이 잡으면 규칙 결과를 그대로 — 한국어는 규칙이 더 정확.
     규칙이 침묵할 때만 AI 임베딩 의미검색으로 폴백. */
  const { score } = ruleScores(ql);
  if (Object.keys(score).length > 0) return suggest(query, limit);
  const out = await aiExtractor('query: ' + query, { pooling: 'mean', normalize: true });
  const qv = out.data;
  const d = loadInterest();
  const scored = aiProductEmb.map((pe) => {
    let cos = 0;
    for (let i = 0; i < qv.length; i++) cos += qv[i] * pe.vec[i];
    return { id: pe.id, s: cos + interestScore(byId(pe.id), d) * 0.02 };
  }).sort((a, b) => b.s - a.s);
  const products = scored.slice(0, limit || 8).map((r) => byId(r.id)).filter(Boolean);
  return { message: '🧠 AI가 의미로 찾았어요', products };
}

/* ---------- 할 일별 추천 ---------- */
const taskById = (id) => TASKS.tasks.find((t) => t.id === id);

/* 할 일에 묶인 상품 전체 (중복 제거) — 그룹과 별개로 그리드에도 쓴다 */
function taskProducts(t) {
  const seen = new Set();
  const out = [];
  (t.groups || []).forEach((g) => (g.items || []).forEach((id) => {
    if (seen.has(id)) return;
    const p = byId(id);
    if (p) { seen.add(id); out.push(p); }
  }));
  return out;
}

function taskChips(activeId) {
  if (!TASKS.tasks.length) return '';
  return `
    <div class="task-chips">
      ${TASKS.tasks.map((t) => `
        <a class="task-chip ${t.id === activeId ? 'active' : ''}" href="#/t/${encodeURIComponent(t.id)}">
          <span class="task-chip-emoji">${esc(t.emoji || '')}</span>${esc(t.title)}
        </a>`).join('')}
    </div>`;
}

function renderTask(t) {
  const all = taskProducts(t);
  const groups = (t.groups || []).map((g) => {
    const items = (g.items || []).map(byId).filter(Boolean);
    if (!items.length) return '';
    return `
      <section class="task-group">
        <h3>${esc(g.label)}</h3>
        ${g.note ? `<p class="task-note">${esc(g.note)}</p>` : ''}
        <div class="grid">${items.map(card).join('')}</div>
      </section>`;
  }).join('');

  const extras = (t.extras || []).length ? `
    <section class="task-extras">
      <h3>주멍가게에 없는 것</h3>
      <p class="task-note">직접 써본 추천은 아니지만, 이 할 일에 같이 필요한 것들이에요.</p>
      <div class="extra-links">
        ${t.extras.map((x) => `
          <a href="${esc(x.link)}" target="_blank" rel="nofollow sponsored noopener">${esc(x.name)} <span>쿠팡에서 보기 ›</span></a>`).join('')}
      </div>
    </section>` : '';

  $app.innerHTML = `
    <div class="task-view container">
      <nav class="breadcrumb"><a href="#/">홈</a> / 할 일 / ${esc(t.title)}</nav>
      <div class="task-head">
        <h1>${esc(t.emoji || '')} ${esc(t.title)}</h1>
        ${t.summary ? `<p>${esc(t.summary)}</p>` : ''}
      </div>
      ${taskChips(t.id)}
      <section class="section products-section" id="products">
        <div class="section-title"><h2>추천 상품</h2><div class="rule"></div></div>
        <div class="grid">${all.map(card).join('')}</div>
      </section>
      ${groups ? `<div class="task-groups"><div class="section-title"><h2>어디에 쓰는지</h2><div class="rule"></div></div>${groups}</div>` : ''}
      ${extras}
    </div>`;

  $app.querySelectorAll('[data-id]').forEach((el) =>
    el.addEventListener('click', () => openProduct(byId(el.dataset.id))));
  track('task', { id: t.id });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* ---------- List view ---------- */
function renderList(cat) {
  const filters = visibleCategories()
    .map((c) => `<button data-cat="${esc(c)}" class="${c === cat ? 'active' : ''}">${esc(c)}</button>`)
    .join('');
  $app.innerHTML = `
    ${TASKS.tasks.length ? `
    <section class="section container tasks-section">
      <div class="section-title"><h2>🍳 이런 거 하시나요?</h2><div class="rule"></div></div>
      <p class="tasks-sub">하려는 일을 고르면 필요한 것들을 묶어서 보여드려요. 특정 상품은 위 검색창에서 찾으세요.</p>
      ${taskChips(null)}
    </section>` : ''}

    <section class="section products-section" id="products">
      <div class="section-title"><h2>추천 상품</h2><div class="rule"></div></div>
      <div class="filters">${filters}</div>
      <div id="gridWrap"></div>
    </section>`;

  const gridWrap = document.getElementById('gridWrap');
  function renderResults(res) {
    gridWrap.innerHTML = `<p class="suggest-msg">${esc(res.message)}</p>` +
      (res.products.length ? `<div class="grid">${res.products.map(card).join('')}</div>` : '');
    gridWrap.querySelectorAll('[data-id]').forEach((el) =>
      el.addEventListener('click', () => openProduct(byId(el.dataset.id))));
  }
  function applyGrid() {
    const q = searchQuery.trim();
    if (!q) {
      const items = sorted(
        cat === '전체' ? DATA.products
          : cat === '구매 희망' ? DATA.products.filter((p) => p.wish)
            : DATA.products.filter((p) => p.category === cat));
      gridWrap.innerHTML = items.length
        ? `<div class="grid">${items.map(card).join('')}</div>`
        : `<p class="empty">이 카테고리에는 아직 상품이 없어요.</p>`;
      gridWrap.querySelectorAll('[data-id]').forEach((el) =>
        el.addEventListener('click', () => openProduct(byId(el.dataset.id))));
      return;
    }
    renderResults(suggest(q, 12));            // 규칙 기반 즉시
    if (aiState === 'ready') {                 // AI 준비됐으면 의미검색으로 정교화
      const myId = ++aiReqSeq;
      aiSuggest(q, 10).then((res) => {
        if (res && myId === aiReqSeq && searchQuery.trim() === q) renderResults(res);
      });
    }
  }
  aiOnReady = applyGrid;
  applyGrid();
  setAiUI();

  /* 검색 입력은 헤더에 있다. 리스트가 다시 그려질 때마다 값만 맞추고 훅을 갱신한다 */
  const input = $search;
  if (input && input.value !== searchQuery) input.value = searchQuery;
  function onQuery() {
    applyGrid();
    clearTimeout(searchTimer);
    const q = searchQuery.trim();
    if (q.length >= 2) searchTimer = setTimeout(() => {
      const cats = [...new Set(suggest(q, 12).products.map((p) => p.category))];
      track('search', { q, cats });
    }, 1200);
  }
  onSearchInput = onQuery;

  $app.querySelectorAll('.filters button').forEach((b) =>
    b.addEventListener('click', () => {
      const c = b.dataset.cat;
      location.hash = c === '전체' ? '#/' : `#/c/${encodeURIComponent(c)}`;
    }));
}

/* ---------- 🔥 오늘의 핫딜 (쿠팡 골드박스, 자동 수집) ---------- */
/* 사이드바에 세로 리스트로 표시. 직접 써본 추천과 분리, 쿠팡으로 바로 이동. */
const SIDE_DEAL_LIMIT = 5;

function sideDealItem(d) {
  return `
    <a class="side-deal" href="${esc(d.url)}" target="_blank" rel="nofollow sponsored noopener">
      <div class="side-deal-thumb">
        <img src="${esc(d.image || PLACEHOLDER)}" alt="${esc(d.name)}" referrerpolicy="no-referrer"
             loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
      </div>
      <div class="side-deal-info">
        <p class="side-deal-name">${esc(d.name)}</p>
        <p class="side-deal-price">${won(d.price)}${d.isRocket ? ' <span class="side-deal-rocket">🚀</span>' : ''}</p>
      </div>
    </a>`;
}

function dealsBox() {
  const list = (DEALS.deals || []).slice(0, SIDE_DEAL_LIMIT);
  if (!list.length) return '';
  return `
    <section class="side-box side-deals">
      <h3>🔥 오늘의 핫딜</h3>
      <p class="side-note">쿠팡 골드박스 실시간 특가 — <strong>직접 써본 추천은 아닙니다.</strong></p>
      <div class="side-deal-list">${list.map(sideDealItem).join('')}</div>
      ${DEALS.fetchedAt ? `<p class="side-time">${esc(DEALS.fetchedAt)} 기준</p>` : ''}
    </section>`;
}

/* 🔖 나를 위한 추천 — 핫딜과 같은 사이드 리스트 형식 */
const SIDE_PICK_LIMIT = 3;

function sidePickItem(p) {
  const badge = p.wish ? '🛒' : (p.ordered ? '📦' : '');
  return `
    <a class="side-deal side-pick" href="#/p/${encodeURIComponent(p.id)}" data-id="${esc(p.id)}">
      <div class="side-deal-thumb">
        <img src="${esc(p.image || PLACEHOLDER)}" alt="${esc(p.name)}"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
      </div>
      <div class="side-deal-info">
        <p class="side-deal-name">${badge ? badge + ' ' : ''}${esc(p.name)}</p>
        <p class="side-pick-price">${priceLabel(p)}</p>
      </div>
    </a>`;
}

function picksBox() {
  const list = personalizedPicks(SIDE_PICK_LIMIT);
  if (!list.length) return '';
  return `
    <section class="side-box side-picks">
      <h3>🔖 나를 위한 추천</h3>
      <p class="side-note">자주 보고 클릭한 상품 기준</p>
      <div class="side-deal-list">${list.map(sidePickItem).join('')}</div>
    </section>`;
}

function searchBox() {
  return `
    <section class="side-box side-search">
      <h3>🔎 쿠팡에서 검색</h3>
      <p>여기 없는 상품도 바로 찾기</p>
      <iframe src="https://ads-partners.coupang.com/iframe/search-bar?id=1905271823563450211004594-f2&type=f2&trackingCode=AF7634218"
              width="100%" height="36" frameborder="0" scrolling="no" title="쿠팡 검색"></iframe>
    </section>`;
}

/* 우측 레일(핫딜 + 쿠팡 검색) — 페이지 레벨, 모든 뷰 공통 */
function renderRail() {
  const rail = document.getElementById('rail');
  if (!rail) return;
  rail.innerHTML = searchBox() + picksBox() + dealsBox();
  /* 사용기가 없는 상품은 상세 대신 쿠팡으로 바로 보낸다 (카드 클릭과 동일 규칙) */
  rail.querySelectorAll('.side-pick').forEach((el) =>
    el.addEventListener('click', (e) => { e.preventDefault(); openProduct(byId(el.dataset.id)); }));
}

/* 가격 표시 — price가 null이면(알리 등 변동가) "가격 확인" */
function priceLabel(p) {
  if (p.price == null) return '<span class="now muted">가격 확인 ›</span>';
  if (p.sale && p.priceOriginal) return `<span class="orig">${won(p.priceOriginal)}</span><span class="now">${won(p.price)}</span>`;
  return `<span class="now">${won(p.price)}</span>`;
}
function ctaLabel(p) {
  return p.platform === 'aliexpress' ? '알리익스프레스에서 보기' : '쿠팡 최저가 확인하기!';
}

function card(p) {
  return `
    <article class="card" data-id="${esc(p.id)}">
      <div class="card-thumb">
        ${p.platform === 'aliexpress' ? '<span class="badge-platform">AliExpress</span>' : ''}
        ${p.wish ? '<span class="badge-wish">🛒 구매 희망</span>'
          : p.ordered ? '<span class="badge-ordered">📦 주문함</span>'
            : (p.sale ? '<span class="badge-sale">세일!</span>' : '')}
        <img src="${esc(p.image || PLACEHOLDER)}" alt="${esc(p.name)}" referrerpolicy="no-referrer"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
      </div>
      <div class="card-body">
        <h3 class="card-name">${esc(p.name)}</h3>
        ${p.note ? `<p class="card-note">${esc(p.note)}</p>` : ''}
        <p class="card-cat">${esc(p.category || '')}</p>
        <p class="card-price">${priceLabel(p)}</p>
        <div class="stars">★★★★★</div>
      </div>
    </article>`;
}

/* 사용기(description) 있으면 상세로, 없으면 쿠팡으로 바로 이동 */
function openProduct(p) {
  if (!p) return;
  if (p.description && p.description.trim()) {
    location.hash = `#/p/${encodeURIComponent(p.id)}`;
  } else {
    track('cta', { id: p.id, cat: p.category });
    window.open(p.link, '_blank', 'noopener');
  }
}

/* ---------- Detail view ---------- */
/* 직접 찍은 설명 사진 — 상세 본문 하단.
   loading="lazy"는 쓰지 않는다 (동적 삽입 + 뷰포트 내에서 Chrome이 영구 pending 됨) */
function photoFigures(photos) {
  if (!Array.isArray(photos) || !photos.length) return '';
  return `
    <div class="detail-photos">
      ${photos.map((ph) => `
        <figure class="detail-photo">
          <img src="${esc(ph.src)}" alt="${esc(ph.caption || '')}"
               onerror="this.onerror=null;this.closest('figure').remove()">
          ${ph.caption ? `<figcaption>${esc(ph.caption)}</figcaption>` : ''}
        </figure>`).join('')}
    </div>`;
}

/* 이 상품이 들어가는 할 일과, 거기에 같이 묶인 다른 상품들 */
function relatedByTask(p) {
  const tasks = TASKS.tasks.filter((t) =>
    (t.groups || []).some((g) => (g.items || []).includes(p.id)));
  if (!tasks.length) return '';
  const seen = new Set([p.id]);
  const items = [];
  tasks.forEach((t) => taskProducts(t).forEach((q) => {
    if (!seen.has(q.id)) { seen.add(q.id); items.push(q); }
  }));
  if (!items.length) return '';
  return `
    <section class="detail-related">
      <h3>같이 쓰는 것</h3>
      <p class="task-note">${esc(tasks.map((t) => `${t.emoji || ''} ${t.title}`).join(' · '))}에 함께 쓰는 상품이에요.</p>
      <div class="task-chips">
        ${tasks.map((t) => `
          <a class="task-chip" href="#/t/${encodeURIComponent(t.id)}">
            <span class="task-chip-emoji">${esc(t.emoji || '')}</span>${esc(t.title)} 전체 보기
          </a>`).join('')}
      </div>
      <div class="grid">${items.map(card).join('')}</div>
    </section>`;
}

function renderDetail(p) {
  $app.innerHTML = `
    <div class="detail container">
      <nav class="breadcrumb">
        <a href="#/">홈</a> / <a href="#/c/${encodeURIComponent(p.category)}">${esc(p.category)}</a> / ${esc(p.name)}
      </nav>
      <div class="detail-grid">
        <div class="detail-img">
          ${p.platform === 'aliexpress' ? '<span class="badge-platform">AliExpress</span>' : ''}
          ${p.wish ? '<span class="badge-wish">🛒 구매 희망</span>' : ''}
          ${p.ordered ? '<span class="badge-ordered">📦 주문함</span>' : ''}
          <img src="${esc(p.image || PLACEHOLDER)}" alt="${esc(p.name)}" referrerpolicy="no-referrer"
               onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
        </div>
        <div class="detail-info">
          <h1>${esc(p.name)}</h1>
          ${p.note ? `<p class="detail-summary">💬 한줄 요약: ${esc(p.note)}</p>` : ''}
          <div class="detail-price">${priceLabel(p)}</div>
          <a class="cta" href="${esc(p.link)}" target="_blank" rel="nofollow sponsored noopener">${esc(ctaLabel(p))}</a>
          <p class="detail-cat">카테고리: ${esc(p.category)}${p.platform === 'aliexpress' ? ' · 해외직구(AliExpress)' : ''}</p>
          ${priceChart(p.priceHistory)}
        </div>
      </div>
      ${p.description ? `
      <div class="detail-desc">
        <h3>상세리뷰</h3>
        <p>${esc(p.description)}</p>
        ${photoFigures(p.photos)}
        ${p.blog ? `<p class="detail-blog">📝 <a href="${esc(p.blog)}" target="_blank" rel="noopener">${esc(p.blogLabel || '관련 블로그 글 보기')}</a></p>` : ''}
      </div>` : ''}
      ${relatedByTask(p)}
    </div>`;
  track('view', { id: p.id, cat: p.category });
  const cta = $app.querySelector('.cta');
  if (cta) cta.addEventListener('click', () => track('cta', { id: p.id, cat: p.category }));
  $app.querySelectorAll('.detail-related [data-id]').forEach((el) =>
    el.addEventListener('click', () => openProduct(byId(el.dataset.id))));
  window.scrollTo({ top: 0 });
}

/* ---------- 내부 라우팅 링크 ---------- */
/* <a href="#/...">를 그냥 두면 브라우저가 자체 해시 스크롤(대상 없으면 최상단)을 수행해
   render()의 스크롤을 덮어쓴다. 기본 동작을 막고 해시만 바꿔 hashchange로 넘긴다. */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  const href = a.getAttribute('href');
  if (location.hash === href || (href === '#/' && !location.hash)) render();
  else location.hash = href;
});

/* ---------- 헤더 검색 ---------- */
if ($search) {
  $search.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    /* 상세·할 일 화면에서 입력하면 목록으로 나가야 결과를 볼 수 있다 */
    /* 켜둔 상태라면 검색을 시작하는 지금 불러온다 (새로고침 때마다가 아니라) */
    if (aiEnabled && aiState === 'off' && searchQuery.trim().length >= 2) loadAI();
    if (parseHash().view !== 'list') { location.hash = '#/'; return; }
    if (onSearchInput) onSearchInput();
  });
}

/* AI 의미검색 토글 — 검색창 옆, 부팅 시 한 번만 배선 */
const $aiToggle = document.getElementById('aiToggle');
if ($aiToggle) {
  $aiToggle.addEventListener('click', () => {
    if (aiState === 'loading') return;
    if (aiEnabled) {                       // 다시 누르면 끈다
      aiEnabled = false;
      aiState = 'off';
      try { localStorage.removeItem(AI_FLAG); } catch (e) {}
      setAiStatus('');
      if (typeof aiOnReady === 'function') aiOnReady();
      return;
    }
    aiEnabled = true;
    try { localStorage.setItem(AI_FLAG, '1'); } catch (e) {}
    loadAI();                              // 직접 켰으니 바로 준비시킨다
  });
  setAiUI();
}

/* "/" 로 검색창에 바로 포커스 */
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (!$search) return;
  e.preventDefault();
  $search.focus();
  $search.select();
});

/* ---------- Mobile nav toggle ---------- */
document.getElementById('navToggle').addEventListener('click', (e) => {
  const open = $nav.classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});
$nav.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') $nav.classList.remove('open');
});

/* ---------- Boot ---------- */
document.getElementById('year').textContent = '2026';
window.addEventListener('hashchange', render);

Promise.all([
  fetch('data/products.json', { cache: 'no-cache' })
    .then((res) => { if (!res.ok) throw new Error('데이터를 불러올 수 없습니다.'); return res.json(); }),
  fetch('data/deals.json', { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null),
  fetch('data/tasks.json', { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null),
])
  .then(([products, deals, tasks]) => {
    DATA = products;
    if (!DATA.categories.includes('전체')) DATA.categories.unshift('전체');
    if (deals && Array.isArray(deals.deals)) DEALS = deals;
    if (tasks && Array.isArray(tasks.tasks)) TASKS = tasks;
    render();
  })
  .catch((err) => {
    $app.innerHTML = `<p class="empty">⚠️ ${esc(err.message)}</p>`;
  });
