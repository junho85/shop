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
