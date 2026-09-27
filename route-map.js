/* 가는 길 미리보기: 등고선 지도 위에 경로가 그려지고 택시 점이 따라가며, 고도 그래프와 숫자가 함께 채워진다.
   routeMap(el, id)            — 코스 상세용(지도 + 고도 + 숫자 + 다시 보기)
   routeMini(el, id)           — 목록 카드용(지도만, 화면에 보이면 경로가 그려짐) */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var CSS = '' +
    '.rt{--rt-ink:#123f29;--rt-line:#11693e;--rt-paper:#f5f4ef;--rt-muted:#5d6a61;--rt-rule:rgba(20,50,34,.13)}' +
    'html.dark .rt{--rt-ink:#8fd4a8;--rt-line:#34c882;--rt-paper:#0c1410;--rt-muted:#93a89a;--rt-rule:rgba(143,212,168,.15)}' +
    '.rt-map{position:relative;perspective:1100px;overflow:hidden;border-radius:14px;background:var(--rt-paper)}' +
    '.rt-tilt{transform:rotateX(28deg) scale(1.04);transform-origin:50% 55%;transition:transform 1.2s cubic-bezier(.2,.7,.2,1)}' +
    '.rt-map svg{display:block;width:100%;height:auto}' +
    '.rt-minor{fill:none;stroke:var(--rt-ink);stroke-width:.55;opacity:.22}' +
    '.rt-major{fill:none;stroke:var(--rt-ink);stroke-width:.9;opacity:.4}' +
    '.rt-path-bg{fill:none;stroke:var(--rt-paper);stroke-width:7;stroke-linecap:round;stroke-linejoin:round}' +
    '.rt-path{fill:none;stroke:var(--rt-line);stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}' +
    '.rt-end{fill:var(--rt-paper);stroke:var(--rt-ink);stroke-width:2}' +
    '.rt-lbl{font-family:"Noto Sans KR",sans-serif;font-weight:700;fill:var(--rt-ink);paint-order:stroke;stroke:var(--rt-paper);stroke-width:5px;stroke-linejoin:round}' +
    '.rt-lbl.sm{font-weight:500;fill:var(--rt-muted)}' +
    '.rt-axis{display:flex;justify-content:space-between;gap:12px;margin-top:8px;font-size:13.5px;color:var(--rt-muted)}' +
    '.rt-car circle.h{fill:var(--rt-line);opacity:.25}.rt-car circle.c{fill:var(--rt-line);stroke:#fff;stroke-width:2.5}' +
    '.rt-prof{margin-top:18px}.rt-prof svg{display:block;width:100%;height:auto;overflow:visible}' +
    '.rt-area{fill:var(--rt-line);opacity:.16}.rt-pl{fill:none;stroke:var(--rt-line);stroke-width:2}' +
    '.rt-ax{font:500 12px "Noto Sans KR",sans-serif;fill:var(--rt-muted)}' +
    '.rt-stats{margin-top:26px;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--rt-rule)}' +
    '.rt-stats>div{padding:18px 0 4px;text-align:left}.rt-stats>div+div{padding-left:22px;border-left:1px solid var(--rt-rule)}' +
    '.rt-stats b{font:600 38px/1 "Hahmlet",serif;letter-spacing:-.05em;color:var(--rt-ink)}' +
    '.rt-stats small{font-size:16px;font-weight:600;margin-left:3px;color:var(--rt-ink)}' +
    '.rt-stats i{display:block;font-style:normal;margin-top:8px;font-size:14px;color:var(--rt-muted)}' +
    '.rt-foot{margin-top:18px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 20px}' +
    '.rt-re{display:inline-flex;align-items:center;gap:6px;font-size:15px;font-weight:600;color:var(--rt-ink);border:1px solid var(--rt-rule);border-radius:999px;padding:8px 16px;background:transparent;cursor:pointer}' +
    '.rt-re:hover{border-color:var(--rt-line)}' +
    '.rt-src{font-size:12px;color:var(--rt-muted)}' +
    '@media (max-width:640px){.rt-stats b{font-size:30px}.rt-stats>div+div{padding-left:14px}.rt-stats small{font-size:14px}.rt-stats i{font-size:13px}}' +
    '.rtm .rt-tilt{transform:rotateX(30deg) scale(1.1)}';
  function css() { if (document.getElementById('rt-css')) return; var s = document.createElement('style'); s.id = 'rt-css'; s.textContent = CSS; document.head.appendChild(s); }
  function el(t, a, p) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function ease(u) { return u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }

  function mapSvg(R, mini, k) {
    k = k || 1; var fs = (mini ? 13 : 17) * k, fs2 = 13 * k, gap = 9 * k;
    var svg = el('svg', { viewBox: '0 0 ' + R.vb[0] + ' ' + R.vb[1], role: 'img', 'aria-label': R.from + '에서 ' + R.to + '까지 가는 길 지도' });
    el('path', { d: R.minor, 'class': 'rt-minor' }, svg);
    el('path', { d: R.major, 'class': 'rt-major' }, svg);
    el('path', { d: R.route, 'class': 'rt-path-bg' }, svg);
    var path = el('path', { d: R.route, 'class': 'rt-path', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, svg);
    var a = R.pts[0], b = R.pts[R.pts.length - 1];
    path.style.strokeWidth = (mini ? 4 : 3.4) * Math.min(k, 1.8);
    el('circle', { cx: a[0], cy: a[1], r: 6 * Math.min(k, 1.6), 'class': 'rt-end' }, svg);
    var endDot = el('circle', { cx: b[0], cy: b[1], r: 6 * Math.min(k, 1.6), 'class': 'rt-end', opacity: 0 }, svg);
    function label(p, txt, sub, other) {
      var up = p[1] < other[1], anchor = p[0] < 90 * k ? 'start' : p[0] > R.vb[0] - 90 * k ? 'end' : 'middle', hasSub = sub && !mini;
      var yMain = up ? p[1] - gap - (hasSub ? fs2 + 4 * k : 0) : p[1] + gap + fs;
      var t = el('text', { x: p[0], y: yMain, 'text-anchor': anchor, 'class': 'rt-lbl', style: 'font-size:' + fs + 'px' }, svg); t.textContent = txt;
      if (!hasSub) return [t];
      var yS = up ? p[1] - gap : yMain + fs2 + 4 * k;
      var s = el('text', { x: p[0], y: yS, 'text-anchor': anchor, 'class': 'rt-lbl sm', style: 'font-size:' + fs2 + 'px' }, svg); s.textContent = sub;
      return [t, s];
    }
    label(a, R.from, '해발 ' + R.startElev.toLocaleString() + 'm', b);
    var endLbl = label(b, R.to, '해발 ' + R.endElev.toLocaleString() + 'm', a);
    endLbl.forEach(function (n) { n.setAttribute('opacity', 0); });
    var car = el('g', { 'class': 'rt-car', transform: 'translate(' + a[0] + ' ' + a[1] + ')' }, svg);
    el('circle', { r: 13 * Math.min(k, 1.6), 'class': 'h' }, car); el('circle', { r: 7 * Math.min(k, 1.6), 'class': 'c' }, car);
    return { svg: svg, path: path, car: car, end: [endDot].concat(endLbl) };
  }

  function play(M, R, dur, onT, done) {
    var n = R.pts.length, t0 = null;
    M.end.forEach(function (e) { e.setAttribute('opacity', 0); });
    function f(now) {
      if (t0 === null) t0 = now;
      var u = Math.min(1, (now - t0) / dur), k = ease(u), fi = k * (n - 1), i = Math.floor(fi), r = fi - i;
      var p = R.pts[i], q = R.pts[Math.min(n - 1, i + 1)];
      M.car.setAttribute('transform', 'translate(' + (p[0] + (q[0] - p[0]) * r).toFixed(1) + ' ' + (p[1] + (q[1] - p[1]) * r).toFixed(1) + ')');
      M.path.setAttribute('stroke-dashoffset', (1 - k).toFixed(4));
      onT && onT(k);
      if (u < 1) requestAnimationFrame(f); else { M.end.forEach(function (e) { e.setAttribute('opacity', 1); }); done && done(); }
    }
    requestAnimationFrame(f);
  }
  function whenVisible(node, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: .35 });
    io.observe(node);
  }
  var reduce = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || /[?&]t=/.test(location.search);

  window.routeMap = function (host, id) {
    var R = window.ROUTES && window.ROUTES[id]; if (!R) return; css();
    host.classList.add('rt'); host.innerHTML = '';
    var box = document.createElement('div'); box.className = 'rt-map'; var tilt = document.createElement('div'); tilt.className = 'rt-tilt'; box.appendChild(tilt); host.appendChild(box);
    var M = mapSvg(R, false, Math.max(1, Math.min(2.2, 560 / (host.clientWidth || 600)))); tilt.appendChild(M.svg);
    // 고도 그래프
    var pw = 600, ph = 120, lo = Math.floor(R.minElev / 100) * 100, hi = Math.ceil(R.maxElev / 100) * 100 + 50;
    var pv = document.createElement('div'); pv.className = 'rt-prof'; host.appendChild(pv);
    var ps = el('svg', { viewBox: '0 0 ' + pw + ' ' + (ph + 4) }, pv);
    function Y(e) { return ph - (e - lo) / (hi - lo) * ph; }
    var line = R.prof.map(function (p, i) { return (i ? 'L' : 'M') + (p[0] * pw).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('');
    var clip = el('clipPath', { id: 'rtc-' + id }, el('defs', {}, ps)); var cr = el('rect', { x: 0, y: -10, width: 0, height: ph + 20 }, clip);
    var g = el('g', { 'clip-path': 'url(#rtc-' + id + ')' }, ps);
    el('path', { d: line + 'L' + pw + ' ' + ph + 'L0 ' + ph + 'Z', 'class': 'rt-area' }, g);
    el('path', { d: line, 'class': 'rt-pl' }, g);
    el('line', { x1: 0, x2: pw, y1: ph, y2: ph, stroke: 'currentColor', opacity: .15 }, ps);
    var ax = document.createElement('div'); ax.className = 'rt-axis'; ax.innerHTML = '<span>' + R.from + ' ' + R.startElev.toLocaleString() + 'm</span><span>' + R.to + ' ' + R.endElev.toLocaleString() + 'm</span>'; pv.appendChild(ax);
    var pdot = el('circle', { r: 5, cx: 0, cy: Y(R.prof[0][1]), fill: 'var(--rt-line)', stroke: '#fff', 'stroke-width': 2 }, ps);
    // 숫자 3개
    var st = document.createElement('div'); st.className = 'rt-stats';
    st.innerHTML = '<div><b data-v="' + R.km + '" data-d="1">0</b><small>km</small><i>거리</i></div>' +
      '<div><b data-v="' + R.min + '">0</b><small>분</small><i>약 소요 시간</i></div>' +
      '<div><b data-v="' + R.endElev + '" data-c="1">0</b><small>m</small><i>도착 해발</i></div>';
    host.appendChild(st);
    var bs = st.querySelectorAll('b');
    function nums(k) { bs.forEach(function (b) { var v = +b.dataset.v * k; b.textContent = b.dataset.d ? v.toFixed(1) : Math.round(v).toLocaleString(); }); }
    var ft = document.createElement('div'); ft.className = 'rt-foot';
    ft.innerHTML = '<button class="rt-re" type="button"><span class="material-symbols-outlined" style="font-size:18px">replay</span>다시 보기</button><span class="rt-src">경로 © OpenStreetMap 기여자 · 고도 SRTM · 시간은 도로 사정에 따라 달라질 수 있습니다</span>';
    host.appendChild(ft);
    function step(k) {
      cr.setAttribute('width', (k * pw).toFixed(1));
      var fi = k * (R.prof.length - 1), i = Math.floor(fi), r = fi - i, p = R.prof[i], q = R.prof[Math.min(R.prof.length - 1, i + 1)];
      pdot.setAttribute('cx', ((p[0] + (q[0] - p[0]) * r) * pw).toFixed(1)); pdot.setAttribute('cy', Y(p[1] + (q[1] - p[1]) * r).toFixed(1));
      nums(k);
    }
    function run() { play(M, R, reduce ? 1 : 5200, step); }
    ft.querySelector('.rt-re').addEventListener('click', run);
    step(0);
    if (reduce) { step(1); play(M, R, 1, step); } else whenVisible(host, run);
  };

  window.routeMini = function (host, id) {
    var R = window.ROUTES && window.ROUTES[id]; if (!R) return; css();
    host.classList.add('rt', 'rtm'); host.innerHTML = '';
    var box = document.createElement('div'); box.className = 'rt-map'; var tilt = document.createElement('div'); tilt.className = 'rt-tilt'; box.appendChild(tilt); host.appendChild(box);
    var M = mapSvg(R, true, Math.max(1, Math.min(2.2, 560 / (host.clientWidth || 600)))); tilt.appendChild(M.svg);
    if (reduce) play(M, R, 1); else whenVisible(host, function () { play(M, R, 2600); });
  };
})();
