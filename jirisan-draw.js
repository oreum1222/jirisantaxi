/* 지리산 인트로: 연필 획으로 흑백 스케치가 그려진 뒤 소나무에서 초록 수채가 번지는 캔버스 애니메이션.
   jirisanDraw(canvas, {src, onDone}) — 재현 가능하도록 고정 dt(1/60초)로 시뮬레이션한다.
   URL에 ?t=초 를 붙이면 그 시점의 정지 프레임만 그린다(검수용). */
(function () {
  var W = 1600, DT = 1 / 60, PAPER = [245, 244, 239];
  var T_OUTLINE = [0.3, 3.0], T_HATCH = [2.3, 5.1], T_SETTLE = [5.0, 5.5], T_COLOR = [5.3, 7.2], T_LABEL = 7.0, T_END = 9.0;

  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function prepare(img) {
    var H = Math.round(W * img.naturalHeight / img.naturalWidth);
    var col = mk(W, H), cx = col.getContext('2d');
    cx.drawImage(img, 0, 0, W, H);
    var d = cx.getImageData(0, 0, W, H), p = d.data, L = new Float32Array(W * H), n = W * H;
    for (var i = 0, j = 0; i < p.length; i += 4, j++) L[j] = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / 255;
    // 채색본의 종이 부분을 바탕 종이색으로 맞춤(하늘에 얼룩 방지)
    for (i = 0, j = 0; i < p.length; i += 4, j++) {
      var k = Math.min(1, Math.max(0, (L[j] - 0.86) / 0.1));
      p[i] += (PAPER[0] - p[i]) * k; p[i + 1] += (PAPER[1] - p[i + 1]) * k; p[i + 2] += (PAPER[2] - p[i + 2]) * k;
    }
    cx.putImageData(d, 0, 0);
    // 국소 평균(적분영상 박스블러) → 주변보다 어두운 곳 = 연필 선
    var I = new Float64Array((W + 1) * (H + 1)), r = 3;
    for (var y = 0; y < H; y++) { var row = 0; for (var x = 0; x < W; x++) { row += L[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
    var sk = mk(W, H), sx = sk.getContext('2d'), sd = sx.createImageData(W, H), q = sd.data;
    var ln = mk(W, H), lx = ln.getContext('2d'), ld = lx.createImageData(W, H), o = ld.data;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      j = y * W + x; i = j * 4;
      var x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
      var m = (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      var e = Math.min(1, Math.max(0, (m - L[j]) * 5.5 + (L[j] < 0.25 ? 0.25 : 0)));
      var lg = 255 * (1 - e * 0.85);
      o[i] = lg; o[i + 1] = lg; o[i + 2] = lg; o[i + 3] = 255;
      var g = Math.min(1, Math.max(0, (L[j] - 0.04) / 0.86));
      g = Math.pow(g, 1.15) * 255;
      q[i] = g; q[i + 1] = g; q[i + 2] = g; q[i + 3] = 255;
    }
    sx.putImageData(sd, 0, 0); lx.putImageData(ld, 0, 0);
    return { H: H, col: col, sk: sk, ln: ln, L: L };
  }

  // 능선 윤곽: 위는 밝고(하늘·운해) 아래는 어두운 지점을 이어 짧은 획들로 자른다
  function outlineStrokes(A, R) {
    var H = A.H, L = A.L, chains = [], open = [];
    for (var x = 0; x < W; x += 2) {
      var pts = [];
      for (var y = 4; y < H - 4; y++) {
        if (L[(y - 4) * W + x] > 0.72 && L[(y + 4) * W + x] < 0.62) { pts.push(y); y += 6; }
      }
      var next = [];
      pts.forEach(function (y) {
        var best = -1, bd = 7;
        for (var k = 0; k < open.length; k++) { var c = open[k], ly = c[c.length - 1][1]; if (Math.abs(ly - y) < bd) { bd = Math.abs(ly - y); best = k; } }
        var c2 = best >= 0 ? open.splice(best, 1)[0] : (chains.push([]), chains[chains.length - 1]);
        c2.push([x, y]); next.push(c2);
      });
      open = next;
    }
    var out = [];
    chains.forEach(function (c) {
      if (c.length < 8) return;
      var my = c.reduce(function (s, p) { return s + p[1]; }, 0) / c.length;
      var i = 0;
      while (i < c.length - 3) {
        var n = 18 + Math.floor(R() * 30), seg = c.slice(i, i + n + 2);
        if (seg.length > 3) out.push({ pts: jitter(seg, R, 0.8), w: 7, a: 1, layer: 0, key: my / H * 0.35 + R() * 0.15, tip: true });
        i += n;
      }
    });
    out.sort(function (a, b) { return a.key - b.key; });
    schedule(out, [T_OUTLINE[0], T_OUTLINE[0] + 1.1], 0.07, 0.13, R);
    return out.concat(contourStrokes(A, R));
  }

  // 스케치 선: 칸마다 결(기울기 수직 방향)을 따라 짧게 슥 긋는 획
  function contourStrokes(A, R) {
    var H = A.H, L = A.L, N = noise2(R), cs = 26, out = [];
    for (var cy = 0; cy < H - 2; cy += cs) for (var cx = 0; cx < W - 2; cx += cs) {
      var s = 0, n = 0, gx = 0, gy = 0;
      for (var y = cy + 1; y < Math.min(H - 1, cy + cs); y += 3) for (var x = cx + 1; x < Math.min(W - 1, cx + cs); x += 3) {
        var k = y * W + x; s += L[k]; n++;
        var dx = L[k + 1] - L[k - 1], dy = L[k + W] - L[k - W];
        gx += dx * dx - dy * dy; gy += 2 * dx * dy; // 구조텐서(방향 평균)
      }
      var ink = 1 - s / n; if (ink < 0.06) continue;
      var ang = 0.5 * Math.atan2(gy, gx) + Math.PI / 2; // 결 방향
      var cnt = 1 + (ink > 0.35 ? 1 : 0);
      for (var q = 0; q < cnt; q++) {
        var len = 34 + R() * 50, bend = (R() - .5) * 0.5, ox = cx + R() * cs, oy = cy + R() * cs, pts = [];
        for (var z = 0; z <= 6; z++) { var u = z / 6 - 0.5, a2 = ang + bend * u; pts.push([ox + Math.cos(a2) * len * u, oy + Math.sin(a2) * len * u]); }
        out.push({ pts: pts, w: 9, a: 1, layer: 0, key: 0.35 + (cy / H) * 0.45 + N(cx, cy, H) * 0.2 + R() * 0.05, tip: true });
      }
    }
    out.sort(function (a, b) { return a.key - b.key; });
    schedule(out, [T_OUTLINE[0] + 0.5, T_OUTLINE[1]], 0.06, 0.11, R);
    return out;
  }

  function jitter(pts, R, a) { return pts.map(function (p) { return [p[0] + (R() - .5) * a, p[1] + (R() - .5) * a]; }); }

  function noise2(R) { // 거친 값노이즈 → 구역별로 몰아서 그리는 순서
    var gx = 9, gy = 5, g = []; for (var i = 0; i < (gx + 1) * (gy + 1); i++) g.push(R());
    return function (x, y, H) {
      var fx = x / W * gx, fy = y / H * gy, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      function v(a, b) { return g[Math.min(gy, b) * (gx + 1) + Math.min(gx, a)]; }
      var a = v(ix, iy) * (1 - tx) + v(ix + 1, iy) * tx, b = v(ix, iy + 1) * (1 - tx) + v(ix + 1, iy + 1) * tx;
      return a * (1 - ty) + b * ty;
    };
  }

  // 명암: 칸마다 잉크 양만큼 짧은 지그재그(슥슥) 획
  function hatchStrokes(A, R) {
    var H = A.H, L = A.L, N = noise2(R), cs = 20, out = [];
    for (var cy = 0; cy < H; cy += cs) for (var cx = 0; cx < W; cx += cs) {
      var s = 0, n = 0;
      for (var y = cy; y < Math.min(H, cy + cs); y += 3) for (var x = cx; x < Math.min(W, cx + cs); x += 3) { s += L[y * W + x]; n++; }
      var ink = 1 - s / n;
      if (ink < 0.05) continue;
      var cnt = 3 + Math.round(ink * 6);
      for (var k = 0; k < cnt; k++) {
        var ang = (-38 + (R() - .5) * 22) * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
        var amp = 11 + R() * 12, stp = 3.6 + R() * 1.6, zig = 4 + Math.floor(R() * 4);
        var ox = cx + R() * cs, oy = cy + R() * cs, pts = [];
        for (var z = 0; z <= zig; z++) {
          var side = (z % 2 ? 1 : -1) * amp * (0.75 + R() * 0.5), adv = (z - zig / 2) * stp;
          pts.push([ox + ca * side - sa * adv, oy + sa * side + ca * adv]);
        }
        out.push({ pts: pts, w: 6 + R() * 3, a: 0.26, layer: 1, key: (cy / H) * 0.3 + N(cx, cy, H) * 0.12 + R() * 0.58, tip: R() < 0.35 });
      }
    }
    out.sort(function (a, b) { return a.key - b.key; });
    schedule(out, T_HATCH, 0.08, 0.15, R);
    return out;
  }

  function schedule(list, span, d0, d1, R) {
    var n = list.length;
    list.forEach(function (s, i) {
      s.t0 = span[0] + (span[1] - span[0] - d1) * (i / Math.max(1, n - 1));
      s.dur = d0 + R() * (d1 - d0);
      var len = 0; s.cum = [0];
      for (var k = 1; k < s.pts.length; k++) { len += Math.hypot(s.pts[k][0] - s.pts[k - 1][0], s.pts[k][1] - s.pts[k - 1][1]); s.cum.push(len); }
      s.len = len; s.done = 0;
    });
  }

  // 수채: 전경 소나무(아래 좌·우)에서 번져 오르는 물감 방울
  function colorBlobs(A, R) {
    var H = A.H, L = A.L, seeds = [[0.06 * W, H], [0.9 * W, H], [0.5 * W, H * 1.05]], out = [], maxD = Math.hypot(W * 0.55, H);
    for (var i = 0; i < 1500; i++) {
      var x = R() * W, y = R() * H, l = L[(y | 0) * W + (x | 0)];
      if (l > 0.84) continue;
      var d = Math.min.apply(null, seeds.map(function (s) { return Math.hypot(x - s[0], (y - s[1]) * 1.6); }));
      out.push({ x: x, y: y, r: 30 + R() * 34, t0: T_COLOR[0] + Math.min(1, d / maxD) * (T_COLOR[1] - T_COLOR[0] - 0.5) + (R() - .5) * 0.3, dur: 0.45 + R() * 0.3 });
    }
    return out;
  }

  function strokeUpTo(ctx, s, from, to) {
    var a = from * s.len, b = to * s.len;
    ctx.beginPath();
    var started = false;
    for (var k = 1; k < s.pts.length; k++) {
      var c0 = s.cum[k - 1], c1 = s.cum[k];
      if (c1 < a || c0 > b) continue;
      var p0 = s.pts[k - 1], p1 = s.pts[k], seg = c1 - c0 || 1;
      var u0 = Math.max(0, (a - c0) / seg), u1 = Math.min(1, (b - c0) / seg);
      var x0 = p0[0] + (p1[0] - p0[0]) * u0, y0 = p0[1] + (p1[1] - p0[1]) * u0, x1 = p0[0] + (p1[0] - p0[0]) * u1, y1 = p0[1] + (p1[1] - p0[1]) * u1;
      if (!started) { ctx.moveTo(x0, y0); started = true; }
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
  }
  // 봉우리 이름표: 가는 선이 위로 그어진 뒤 이름이 떠오름
  function drawLabel(ctx, lb, H, e) {
    var k = lb.scale || 1, x = lb.x * W, y = lb.y * H, len = 58 * k, u = ease(e / 0.55), a = ease((e - 0.35) / 0.7) * (lb.alpha || 1);
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(18,63,41,' + (0.75 * (lb.alpha || 1)) + ')'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 9 - len * u); ctx.stroke();
    ctx.fillStyle = 'rgba(18,63,41,' + (0.85 * Math.min(1, e / 0.3)) + ')';
    ctx.beginPath(); ctx.arc(x, y - 4, 2.4, 0, 6.283); ctx.fill();
    if (a > 0) {
      ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.fillStyle = '#123f29';
      var ty = y - 9 - len - 12 + (1 - a) * 6;
      ctx.font = '500 ' + Math.round(13 * k) + 'px "Noto Sans KR", sans-serif'; if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
      ctx.fillText(lb.sub, x, ty);
      ctx.font = '700 ' + Math.round(25 * k) + 'px "Noto Sans KR", sans-serif'; if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
      ctx.fillText(lb.name, x, ty - 22 * k);
    }
    ctx.restore();
  }
  function ease(u) { return u < 0 ? 0 : u > 1 ? 1 : 1 - Math.pow(1 - u, 2.2); }

  window.jirisanDraw = function (canvas, opt) {
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      var A = prepare(img), H = A.H, R = rng(1915);
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d');
      var strokes = outlineStrokes(A, R).concat(hatchStrokes(A, R)), blobs = colorBlobs(A, R);
      var mK = mk(W, H), mx = mK.getContext('2d'), mC = mk(W, H), mcx = mC.getContext('2d');
      var mL = mk(W, H), mlx = mL.getContext('2d');
      var tK = mk(W, H), tkx = tK.getContext('2d'), tC = mk(W, H), tcx = tC.getContext('2d');
      [mx, mlx].forEach(function (c) { c.lineCap = c.lineJoin = 'round'; c.strokeStyle = '#000'; });
      var t = 0, settle = 0, colorAll = 0;

      function step() {
        t += DT;
        for (var i = 0; i < strokes.length; i++) {
          var s = strokes[i]; if (t < s.t0 || s.done >= 1) continue;
          var u = ease((t - s.t0) / s.dur); if (u <= s.done) continue;
          var mm = s.layer ? mx : mlx; mm.globalAlpha = s.a; mm.lineWidth = s.w; strokeUpTo(mm, s, s.done, u); mm.globalAlpha = 1; s.done = u;
        }
        if (t > T_SETTLE[0]) { // 남은 빈틈을 연하게 메워 스케치 마무리
          var ns = Math.min(1, (t - T_SETTLE[0]) / (T_SETTLE[1] - T_SETTLE[0]));
          if (ns > settle) { mx.globalAlpha = (ns - settle) * 0.9; mx.fillRect(0, 0, W, H); mx.globalAlpha = 1; settle = ns; }
        }
        for (var b = 0; b < blobs.length; b++) {
          var o = blobs[b], v = (t - o.t0) / o.dur; if (v < 0 || v > 1.3) continue;
          var r = o.r * (0.35 + 0.65 * ease(v)), gr = mcx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
          gr.addColorStop(0, 'rgba(0,0,0,.16)'); gr.addColorStop(.7, 'rgba(0,0,0,.1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          mcx.fillStyle = gr; mcx.beginPath(); mcx.arc(o.x, o.y, r, 0, 6.283); mcx.fill();
        }
        if (t > T_COLOR[1] - 0.2) {
          var nc = Math.min(1, (t - (T_COLOR[1] - 0.2)) / 0.5);
          if (nc > colorAll) { mcx.globalAlpha = (nc - colorAll) * 0.8; mcx.fillStyle = '#000'; mcx.fillRect(0, 0, W, H); mcx.globalAlpha = 1; colorAll = nc; }
        }
      }
      function paint() {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgb(' + PAPER + ')'; ctx.fillRect(0, 0, W, H);
        if (settle < 1) { // 스케치 선 (명암이 완성되면 사라짐)
          tkx.globalCompositeOperation = 'source-over'; tkx.clearRect(0, 0, W, H); tkx.drawImage(A.ln, 0, 0);
          tkx.globalCompositeOperation = 'destination-in'; tkx.drawImage(mL, 0, 0);
          ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 1 - settle; ctx.drawImage(tK, 0, 0); ctx.globalAlpha = 1;
        }
        tkx.globalCompositeOperation = 'source-over'; tkx.clearRect(0, 0, W, H); tkx.drawImage(A.sk, 0, 0);
        tkx.globalCompositeOperation = 'destination-in'; tkx.drawImage(mK, 0, 0);
        ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(tK, 0, 0);
        if (t > T_COLOR[0] - 0.1) {
          tcx.globalCompositeOperation = 'source-over'; tcx.clearRect(0, 0, W, H); tcx.drawImage(A.col, 0, 0);
          tcx.globalCompositeOperation = 'destination-in'; tcx.drawImage(mC, 0, 0);
          ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(tC, 0, 0);
        }
        if (opt && opt.labels) opt.labels.forEach(function (lb) { var e = t - T_LABEL - (lb.delay || 0); if (e > 0) drawLabel(ctx, lb, H, e); });
        // 보이지 않는 연필 끝: 지금 그어지는 획의 머리에 흑연 자국
        ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(38,40,38,.55)'; ctx.lineWidth = 1.1;
        for (var i = 0; i < strokes.length; i++) {
          var s = strokes[i]; if (!s.tip || s.done <= 0 || s.done >= 1 || t < s.t0) continue;
          strokeUpTo(ctx, s, Math.max(0, s.done - 0.35), s.done);
        }
      }

      var qs = /[?&]t=([\d.]+)/.exec(location.search);
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (qs || reduce) {
        var target = qs ? parseFloat(qs[1]) : T_END + 1;
        while (t < target) step();
        paint(); opt && opt.onDone && opt.onDone(); return;
      }
      var last = null, acc = 0;
      function frame(now) {
        if (last === null) last = now;
        acc += Math.min(0.1, (now - last) / 1000); last = now;
        while (acc >= DT) { step(); acc -= DT; }
        paint();
        if (t < T_END) requestAnimationFrame(frame); else { opt && opt.onDone && opt.onDone(); }
      }
      function go() { opt && opt.onStart && opt.onStart(); requestAnimationFrame(frame); }
      paint(); // 빈 종이
      if (!('IntersectionObserver' in window)) return go();
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); go(); } }, { threshold: 0.3 });
      io.observe(canvas);
    };
    img.src = (opt && opt.src) || 'jirisan-paint.jpg';
  };
})();
