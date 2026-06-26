'use strict';

const PLACEHOLDER = 'assets/placeholder.svg';
const HERO = {
  title: '우리집 추천 생필품!',
  subtitle: '직접 써본 좋은 제품만 엄선했습니다!',
  image: 'assets/hero.svg',
};

let DATA = { categories: ['전체'], products: [] };

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
  return { view: 'list', cat: '전체' };
}

function render() {
  const r = parseHash();
  renderNav(r.view === 'list' ? r.cat : null);
  if (r.view === 'detail') {
    const p = byId(r.id);
    if (p) return renderDetail(p);
    location.hash = '#/';
    return;
  }
  renderList(r.cat || '전체');
  window.scrollTo({ top: 0 });
}

/* ---------- Nav ---------- */
function renderNav(activeCat) {
  $nav.innerHTML = DATA.categories
    .filter((c) => c !== '전체')
    .map((c) => `<a href="#/c/${encodeURIComponent(c)}" class="${c === activeCat ? 'active' : ''}">${esc(c)}</a>`)
    .join('');
}

/* ---------- 개인화 (이 브라우저 기준, localStorage) ---------- */
const LS_KEY = 'jumeong_interest_v1';
let searchQuery = '';
let searchTimer = null;

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
  const toks = q.split(/\s+/).filter((t) => t.length >= 2);
  DATA.products.forEach((p) => {
    const hay = [p.name, p.note, p.description, p.category].join(' ').toLowerCase();
    toks.forEach((t) => { if (hay.includes(t)) add(p.id, 2); });
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
let aiState = 'off';      // off | loading | ready | error
let aiExtractor = null;
let aiProductEmb = null;  // [{id, vec}]
let aiReqSeq = 0;
let aiOnReady = null;     // 뷰가 등록하는 갱신 콜백

function setAiUI() {
  const btn = document.getElementById('aiToggle');
  if (btn) {
    btn.classList.toggle('on', aiState === 'ready');
    btn.textContent = aiState === 'ready' ? '🧠 AI 의미검색 켜짐'
      : aiState === 'loading' ? '🧠 AI 로딩 중…'
      : aiState === 'error' ? '🧠 AI 다시 시도'
      : '🧠 AI 의미검색 켜기';
  }
}
function setAiStatus(msg) {
  const el = document.getElementById('aiStatus');
  if (el) el.textContent = msg || '';
  setAiUI();
}

async function loadAI() {
  if (aiState === 'ready' || aiState === 'loading') return aiState === 'ready';
  aiState = 'loading';
  setAiStatus('AI 모델 다운로드 중… (최초 1회, 다운로드 후엔 캐시됩니다)');
  try {
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
    setAiStatus('상품을 분석하는 중…');
    aiProductEmb = [];
    for (const p of DATA.products) {
      const text = 'passage: ' + [p.name, p.note, p.description, p.category].filter(Boolean).join('. ');
      const out = await aiExtractor(text, { pooling: 'mean', normalize: true });
      aiProductEmb.push({ id: p.id, vec: out.data });
    }
    aiState = 'ready';
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

/* ---------- List view ---------- */
function renderList(cat) {
  const filters = DATA.categories
    .map((c) => `<button data-cat="${esc(c)}" class="${c === cat ? 'active' : ''}">${esc(c)}</button>`)
    .join('');
  const picks = personalizedPicks(8);

  $app.innerHTML = `
    <section class="hero" style="background-image:url('${esc(HERO.image)}')">
      <div class="container hero-inner">
        <h1>${esc(HERO.title)}</h1>
        <p>${esc(HERO.subtitle)}</p>
        <div class="hero-actions">
          <a class="btn btn-solid" href="#products">SHOP NOW</a>
        </div>
      </div>
    </section>

    ${picks.length ? `
    <section class="section container picks">
      <div class="section-title"><h2>🔖 나를 위한 추천</h2><div class="rule"></div></div>
      <p class="picks-sub">자주 보고 클릭·검색한 상품을 바탕으로 골랐어요</p>
      <div class="carousel-wrap">
        <button class="carousel-btn prev" aria-label="이전 상품" data-dir="-1">‹</button>
        <div class="carousel" id="picksCarousel">${picks.map(card).join('')}</div>
        <button class="carousel-btn next" aria-label="다음 상품" data-dir="1">›</button>
      </div>
    </section>` : ''}

    <section class="section container" id="products">
      <div class="section-title"><h2>추천 상품</h2><div class="rule"></div></div>
      <div class="search-bar">
        <input id="searchInput" type="search" placeholder="검색하거나 필요한 걸 말해보세요 (예: 주말에 먹을 거, 전구가 깜빡)"
               value="${esc(searchQuery)}" autocomplete="off" aria-label="상품 검색 및 추천">
      </div>
      <div class="chips">
        ${['주말에 먹을 거', '전구가 깜빡거릴 때', '추천 도서', '화장실 청소', '간단한 아침'].map((c) =>
          `<button class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div class="ai-row">
        <button id="aiToggle" class="ai-toggle"></button>
        <span id="aiStatus" class="ai-status"></span>
      </div>
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

  $app.querySelectorAll('.picks [data-id]').forEach((el) =>
    el.addEventListener('click', () => openProduct(byId(el.dataset.id))));

  const carousel = document.getElementById('picksCarousel');
  if (carousel) {
    const updateArrows = () => {
      const max = carousel.scrollWidth - carousel.clientWidth - 2;
      const prev = $app.querySelector('.carousel-btn.prev');
      const next = $app.querySelector('.carousel-btn.next');
      if (prev) prev.classList.toggle('hidden', carousel.scrollLeft <= 2);
      if (next) next.classList.toggle('hidden', carousel.scrollLeft >= max || max <= 0);
    };
    $app.querySelectorAll('.carousel-btn').forEach((b) =>
      b.addEventListener('click', () => {
        carousel.scrollBy({ left: Number(b.dataset.dir) * carousel.clientWidth * 0.8, behavior: 'smooth' });
      }));
    carousel.addEventListener('scroll', updateArrows, { passive: true });
    updateArrows();
  }

  const input = document.getElementById('searchInput');
  function onQuery() {
    applyGrid();
    clearTimeout(searchTimer);
    const q = searchQuery.trim();
    if (q.length >= 2) searchTimer = setTimeout(() => {
      const cats = [...new Set(suggest(q, 12).products.map((p) => p.category))];
      track('search', { q, cats });
    }, 1200);
  }
  input.addEventListener('input', (e) => { searchQuery = e.target.value; onQuery(); });

  $app.querySelectorAll('.chip').forEach((b) =>
    b.addEventListener('click', () => {
      searchQuery = b.dataset.q;
      input.value = searchQuery;
      onQuery();
      input.focus();
      document.getElementById('products').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

  const aiToggle = document.getElementById('aiToggle');
  aiToggle.addEventListener('click', () => { if (aiState !== 'loading') loadAI(); });
  let aiFlag = null;
  try { aiFlag = localStorage.getItem(AI_FLAG); } catch (e) {}
  if (aiState === 'off' && aiFlag === '1') loadAI();

  $app.querySelectorAll('.filters button').forEach((b) =>
    b.addEventListener('click', () => {
      const c = b.dataset.cat;
      location.hash = c === '전체' ? '#/' : `#/c/${encodeURIComponent(c)}`;
    }));
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
        ${p.wish ? '<span class="badge-wish">🛒 구매 희망</span>' : (p.sale ? '<span class="badge-sale">세일!</span>' : '')}
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
          <img src="${esc(p.image || PLACEHOLDER)}" alt="${esc(p.name)}" referrerpolicy="no-referrer"
               onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
        </div>
        <div class="detail-info">
          <h1>${esc(p.name)}</h1>
          ${p.note ? `<p class="detail-summary">💬 한줄 요약: ${esc(p.note)}</p>` : ''}
          <div class="detail-price">${priceLabel(p)}</div>
          <a class="cta" href="${esc(p.link)}" target="_blank" rel="nofollow sponsored noopener">${esc(ctaLabel(p))}</a>
          <p class="detail-cat">카테고리: ${esc(p.category)}${p.platform === 'aliexpress' ? ' · 해외직구(AliExpress)' : ''}</p>
        </div>
      </div>
      ${priceChart(p.priceHistory)}
      ${p.description ? `
      <div class="detail-desc">
        <h3>상세리뷰</h3>
        <p>${esc(p.description)}</p>
        ${p.blog ? `<p class="detail-blog">📝 <a href="${esc(p.blog)}" target="_blank" rel="noopener">${esc(p.blogLabel || '관련 블로그 글 보기')}</a></p>` : ''}
      </div>` : ''}
    </div>`;
  track('view', { id: p.id, cat: p.category });
  const cta = $app.querySelector('.cta');
  if (cta) cta.addEventListener('click', () => track('cta', { id: p.id, cat: p.category }));
  window.scrollTo({ top: 0 });
}

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

fetch('data/products.json', { cache: 'no-cache' })
  .then((res) => { if (!res.ok) throw new Error('데이터를 불러올 수 없습니다.'); return res.json(); })
  .then((json) => {
    DATA = json;
    if (!DATA.categories.includes('전체')) DATA.categories.unshift('전체');
    render();
  })
  .catch((err) => {
    $app.innerHTML = `<p class="empty">⚠️ ${esc(err.message)}</p>`;
  });
