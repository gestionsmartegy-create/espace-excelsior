/* reveal au scroll, en cascade */
const obs = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('on'), i * 60);
      obs.unobserve(e.target);
    }
  });
}, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.rv').forEach(el => obs.observe(el));

/* panneaux ambiance — wipe au scroll */
const ambObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('on'); ambObs.unobserve(e.target); }
  });
}, { threshold: .3 });
document.querySelectorAll('.amb-panel').forEach(el => ambObs.observe(el));

/* nav — transparent sur hero, solide dès qu'on quitte */
const nav = document.querySelector('.nav');
const progress = document.querySelector('.scroll-progress');
const heroHeight = () => document.querySelector('.hero')?.offsetHeight ?? window.innerHeight;
const onScroll = () => {
  nav.classList.toggle('scrolled', window.scrollY > heroHeight() * 0.6);
  const h = document.documentElement;
  const pct = h.scrollTop / (h.scrollHeight - h.clientHeight) * 100;
  progress.style.width = pct + '%';
};
document.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* parallax léger — hero + panneaux ambiance, via rAF */
const parallaxEls = [
  ...document.querySelectorAll('.hero-bg img'),
  ...document.querySelectorAll('.amb-clip img')
];
let ticking = false;
function updateParallax() {
  const vh = window.innerHeight;
  parallaxEls.forEach(img => {
    const rect = img.closest('.hero-bg, .amb-clip').getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) return;
    const progressY = (rect.top) / vh;
    const shift = progressY * 26;
    img.style.transform = `translateY(${shift}px)`;
  });
  ticking = false;
}
document.addEventListener('scroll', () => {
  if (!ticking) { requestAnimationFrame(updateParallax); ticking = true; }
}, { passive: true });
updateParallax();

/* compteurs animés sur les stats */
const counters = document.querySelectorAll('.stat-n');
const countObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = parseInt(el.dataset.count, 10);
    const suffixEl = el.querySelector('span');
    const suffix = suffixEl ? suffixEl.outerHTML : '';
    const dur = 1400;
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(target * eased);
      el.innerHTML = String(val).padStart(String(target).length, '0') + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    countObs.unobserve(el);
  });
}, { threshold: .6 });
counters.forEach(el => countObs.observe(el));

/* hover magnétique — liens et boutons */
document.querySelectorAll('.magnetic').forEach(el => {
  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    el.style.transform = `translate(${x * .25}px, ${y * .35}px)`;
  });
  el.addEventListener('mouseleave', () => { el.style.transform = 'translate(0,0)'; });
});

/* galerie — onglets */
const tabs = document.querySelectorAll('.gal-tab');
const panels = document.querySelectorAll('.gal-panel');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});

/* lightbox */
const lightbox = document.querySelector('.lightbox');
const lightboxImg = lightbox.querySelector('img');
document.querySelectorAll('.mi img').forEach(img => {
  img.addEventListener('click', () => {
    lightboxImg.src = img.src;
    lightbox.classList.add('open');
  });
});
lightbox.addEventListener('click', () => lightbox.classList.remove('open'));
