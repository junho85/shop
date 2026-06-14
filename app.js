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

/* ---------- List view ---------- */
function renderList(cat) {
  const items = sorted(cat === '전체' ? DATA.products : DATA.products.filter((p) => p.category === cat));
  const filters = DATA.categories
    .map((c) => `<button data-cat="${esc(c)}" class="${c === cat ? 'active' : ''}">${esc(c)}</button>`)
    .join('');

  $app.innerHTML = `
    <section class="hero" style="background-image:url('${esc(HERO.image)}')">
      <div class="container hero-inner">
        <h1>${esc(HERO.title)}</h1>
        <p>${esc(HERO.subtitle)}</p>
        <div class="hero-actions">
          <a class="btn btn-solid" href="#products">SHOP NOW</a>
          <a class="btn btn-ghost" href="https://world.junho85.pe.kr" rel="noopener">FIND MORE</a>
        </div>
      </div>
    </section>

    <section class="section container" id="products">
      <div class="section-title"><h2>추천 상품</h2><div class="rule"></div></div>
      <div class="filters">${filters}</div>
      ${items.length
        ? `<div class="grid">${items.map(card).join('')}</div>`
        : `<p class="empty">이 카테고리에는 아직 상품이 없어요.</p>`}
    </section>`;

  $app.querySelectorAll('.filters button').forEach((b) =>
    b.addEventListener('click', () => {
      const c = b.dataset.cat;
      location.hash = c === '전체' ? '#/' : `#/c/${encodeURIComponent(c)}`;
    }));

  $app.querySelectorAll('[data-id]').forEach((el) =>
    el.addEventListener('click', () => openProduct(byId(el.dataset.id))));
}

function card(p) {
  const price = p.sale && p.priceOriginal
    ? `<span class="orig">${won(p.priceOriginal)}</span><span class="now">${won(p.price)}</span>`
    : `<span class="now">${won(p.price)}</span>`;
  return `
    <article class="card" data-id="${esc(p.id)}">
      <div class="card-thumb">
        ${p.sale ? '<span class="badge-sale">세일!</span>' : ''}
        <img src="${esc(p.image || PLACEHOLDER)}" alt="${esc(p.name)}" referrerpolicy="no-referrer"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
      </div>
      <div class="card-body">
        <h3 class="card-name">${esc(p.name)}</h3>
        <p class="card-cat">${esc(p.category || '')}</p>
        <p class="card-price">${price}</p>
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
    window.open(p.link, '_blank', 'noopener');
  }
}

/* ---------- Detail view ---------- */
function renderDetail(p) {
  const price = p.sale && p.priceOriginal
    ? `<span class="orig">${won(p.priceOriginal)}</span><span class="now">${won(p.price)}</span>`
    : `<span class="now">${won(p.price)}</span>`;
  $app.innerHTML = `
    <div class="detail container">
      <nav class="breadcrumb">
        <a href="#/">홈</a> / <a href="#/c/${encodeURIComponent(p.category)}">${esc(p.category)}</a> / ${esc(p.name)}
      </nav>
      <div class="detail-grid">
        <div class="detail-img">
          <img src="${esc(p.image || PLACEHOLDER)}" alt="${esc(p.name)}" referrerpolicy="no-referrer"
               onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
        </div>
        <div class="detail-info">
          <h1>${esc(p.name)}</h1>
          <div class="detail-price">${price}</div>
          <a class="cta" href="${esc(p.link)}" target="_blank" rel="nofollow sponsored noopener">쿠팡 최저가 확인하기!</a>
          <p class="detail-cat">카테고리: ${esc(p.category)}</p>
        </div>
      </div>
      ${priceChart(p.priceHistory)}
      ${p.description ? `
      <div class="detail-desc">
        <h3>설명</h3>
        <p>${esc(p.description)}</p>
        ${p.blog ? `<p class="detail-blog">📝 <a href="${esc(p.blog)}" target="_blank" rel="noopener">${esc(p.blogLabel || '관련 블로그 글 보기')}</a></p>` : ''}
      </div>` : ''}
    </div>`;
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
