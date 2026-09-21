/* Personal theme runtime.
   Homepage: seeded flow-field engine, spotlight tabs, reveals, theme
   toggle with URL sync, scroll-spy, animated service ledger.
   Interiors: publication/update filters, dates, reading progress.
   The pre-paint theme/motion boot lives inline in base_layout. */
(function(){
  'use strict';
  var html = document.documentElement;
  var storageKey = 'jean-site-theme';
  var motionOK = window.matchMedia && matchMedia('(prefers-reduced-motion: no-preference)').matches;
  var themeExplicit = new URLSearchParams(location.search).has('theme');
  html.classList.add('js');

  /* ——— scroll reveals ——— */
  if (motionOK && 'IntersectionObserver' in window){
    var revIO = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){ e.target.classList.add('in'); revIO.unobserve(e.target); }
      });
    }, {threshold:.08});
    document.querySelectorAll('[data-reveal]').forEach(function(el){ revIO.observe(el); });
  } else {
    document.querySelectorAll('[data-reveal]').forEach(function(el){ el.classList.add('in'); });
  }

  /* ——— work spotlight — tabs on desktop, one-open accordion on small
         screens. Both controls operate the same project panels. ——— */
  (function(){
    var spot = document.querySelector('[data-spotlight]');
    if (!spot) return;
    var tabs = Array.prototype.slice.call(spot.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function(t){ return document.getElementById(t.getAttribute('aria-controls')); });
    var disclosures = Array.prototype.slice.call(spot.querySelectorAll('.sp-accordion-toggle'));
    var bodies = disclosures.map(function(t){ return document.getElementById(t.getAttribute('aria-controls')); });
    if (!tabs.length || panels.some(function(p){ return !p; }) ||
        disclosures.length !== tabs.length || bodies.some(function(p){ return !p; })) return;
    var desktop = matchMedia('(min-width: 720px)');   /* matches the CSS stack breakpoint */
    var current = 0, ready = false;

    function activate(i, focus){
      current = i;
      tabs.forEach(function(tab, j){
        var on = j === i;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        disclosures[j].setAttribute('aria-expanded', String(on));
        panels[j].hidden = false;
        panels[j].toggleAttribute('inert', desktop.matches && !on);
        bodies[j].hidden = !desktop.matches && !on;
      });
      if (ready && motionOK && desktop.matches && typeof panels[i].animate === 'function'){
        panels[i].animate(
          [{opacity:.45, transform:'translateY(4px)'}, {opacity:1, transform:'none'}],
          {duration:200, easing:'cubic-bezier(.2,.8,.2,1)'}   /* --d-fast · --ease */
        );
      }
      ready = true;
      if (focus) (desktop.matches ? tabs[i] : disclosures[i]).focus();
    }

    function sync(){
      if (desktop.matches){
        panels.forEach(function(p, j){
          p.setAttribute('role', 'tabpanel');
          p.setAttribute('aria-labelledby', tabs[j].id);
          bodies[j].removeAttribute('role');
          bodies[j].removeAttribute('aria-labelledby');
        });
      } else {
        panels.forEach(function(p, j){
          p.removeAttribute('role');
          p.removeAttribute('aria-labelledby');
          bodies[j].setAttribute('role', 'region');
          bodies[j].setAttribute('aria-labelledby', disclosures[j].id);
        });
      }
      ready = false;                       /* no fade on a layout swap */
      activate(current);
      /* drop the pre-JS placeholder veil once real state is set */
      panels.forEach(function(p){ p.removeAttribute('data-lazy'); });
    }

    tabs.forEach(function(tab, i){
      tab.addEventListener('click', function(){ activate(i); });
      tab.addEventListener('keydown', function(e){
        var n = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        activate(n, true);
      });
    });
    disclosures.forEach(function(toggle, i){
      toggle.addEventListener('click', function(){ activate(i); });
    });

    if (desktop.addEventListener) desktop.addEventListener('change', sync);
    else desktop.addListener(sync);
    sync();
  })();

  /* ——— single polite live region — cite confirmations and theme changes ——— */
  var live = document.getElementById('live');
  function announce(msg){ if (live){ live.textContent = ''; live.textContent = msg; } }

  /* ——— one seeded vector field, two renderings of it ———
       dark  — a luminous long exposure: particles deposit into the
               canvas and a periodic veil fade re-develops them
               (accumulation).
       light — a residue-free engraving: the canvas is fully cleared
               every frame and re-stroked as evenly-spaced continuous
               streamlines integrated through the same field
               (Jobard–Lefer separation, both directions, tapered
               ends). Nothing persists between frames.
     The particle physics advances in both themes (drawing only in
     dark), so a theme flip rewinds to a rolling exposure snapshot and
     replays the same trajectory window — the same drawing, re-lit. */
  function makeField(canvas){
    var ctx = canvas.getContext('2d');
    var SEED = 1103, DT = 33, EXPOSE = 210;
    var w = 0, h = 0, raf = null, last = 0, parts = [], running = false, fc = 0;
    var simT = 0, wantLive = false, visible = true, pal = null;

    /* pointer response: a gaussian velocity-field perturbation
       (falloff r ≈ 200px) pushes nearby strokes around the cursor —
       the flow parts and bends, like laminar flow meeting an obstacle
       — plus a subtle ink lift so the deflection reads. Identical in
       both themes. (pointer:fine) only — coarse pointers never
       attach; reduced motion never renders the canvas at all. */
    var ptr = {x:-1e4, y:-1e4, tx:-1e4, ty:-1e4, b:0, tb:0, on:false, sec:null, move:null, leave:null};
    var PTR_R2 = 40000;   /* gaussian falloff, r ~ 200px */
    function ptrBoost(p){
      if (ptr.b < .01) return 1;
      var dx = p.x - ptr.x, dy = p.y - ptr.y;
      var g = Math.exp(-(dx * dx + dy * dy) / PTR_R2);
      return 1 + (pal.dark ? .9 : 1.45) * ptr.b * g;
    }
    function attachPtr(){
      if (ptr.on) return;
      if (!(window.matchMedia && matchMedia('(pointer:fine)').matches)) return;
      ptr.sec = ptr.sec || canvas.closest('section');
      if (!ptr.sec) return;
      ptr.move = ptr.move || function(e){
        var r = canvas.getBoundingClientRect();
        ptr.tx = e.clientX - r.left; ptr.ty = e.clientY - r.top; ptr.tb = 1;
        if (ptr.b < .02){ ptr.x = ptr.tx; ptr.y = ptr.ty; } /* start at the cursor, never sweep in */
      };
      ptr.leave = ptr.leave || function(){ ptr.tb = 0; };
      ptr.sec.addEventListener('pointermove', ptr.move);
      ptr.sec.addEventListener('pointerleave', ptr.leave);
      ptr.on = true;
    }
    /* explicit-state mulberry32 so an exposure snapshot can rewind it */
    var randState = SEED;
    function rand(){
      randState |= 0; randState = randState + 0x6D2B79F5 | 0;
      var t = Math.imul(randState ^ randState >>> 15, 1 | randState);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    /* rolling anchors: full sim state every EXPOSE steps (two kept, so a
       replay always spans at least one full exposure window) */
    var snapA = null, snapB = null, sinceSnap = 0;
    function copyParts(list){
      return list.map(function(p){
        return {x:p.x, y:p.y, px:p.px, py:p.py, s:p.s, band:p.band,
                aU:p.aU, isB:p.isB, deep:p.deep, h:p.h, life:p.life, life0:p.life0};
      });
    }
    function takeSnap(){
      snapA = snapB;
      snapB = {t:simT, r:randState, f:fc, parts:copyParts(parts)};
      sinceSnap = 0;
    }
    function restoreSnap(s){
      simT = s.t; randState = s.r; fc = s.f;
      parts = copyParts(s.parts);
    }

    function cssVar(n){ return getComputedStyle(html).getPropertyValue(n).trim(); }
    function palette(){
      var dark = html.dataset.theme === 'dark';
      return {
        dark: dark,
        bg: cssVar('--flow-bg'),
        main: cssVar('--flow-main'),
        deep: cssVar('--flow-deep'),
        a: parseFloat(cssVar('--flow-ink-a')) || .13,   /* base alpha for the light engraving */
        veil: 'rgba(' + cssVar('--flow-veil') + ',.05)',
        comp: dark ? 'lighter' : 'source-over'
      };
    }
    function edgeFade(x, y){
      /* the field thins toward the top edge and especially the top
         corners. Pure alpha — the same fade in both themes; geometry
         and motion are untouched. */
      var ty = Math.min(1, Math.max(0, y / (h * .32)));
      ty = ty * (2 - ty);
      var cx = Math.min(1, Math.max(0, Math.min(x, w - x) / (w * .22)));
      cx = cx * (2 - cx);
      return (.30 + .70 * ty) * (1 - (1 - cx) * (1 - ty) * .75);
    }
    function alphaOf(p){ /* per-segment deposit alpha for the dark exposure */
      var f = p.band * edgeFade(p.x, p.y);
      return (p.isB ? .28 + p.aU * .14 : .06 + p.aU * .12) * f * ptrBoost(p);
    }
    function spawn(p){
      p = p || {};
      p.x = rand() * w; p.y = rand() * h;
      p.px = p.x; p.py = p.y;
      p.s = (.55 + rand() * .75) * .75;
      p.band = .3 + .7 * Math.exp(-Math.pow((p.y - h * .52) / (h * .36), 2));
      p.aU = rand(); p.isB = rand() < .07; p.deep = rand() < .3;
      p.h = null; p.life = 900 + rand() * 800;   /* long lives — long, unbroken strokes */
      p.life0 = p.life;                          /* initial lifetime, kept for deterministic snapshots */
      return p;
    }
    function angle(x, y, t){
      var yy = (y / Math.max(h, 1) - .5), tt = t * .00006;
      var s1 = Math.sin(yy * 6.0 + Math.cos(x * .0011 + tt) * 1.1);
      var s2 = Math.cos(yy * 9.0 - x * .0007 + tt * .8);
      return (s1 * .6 + s2 * .4) * .22;          /* low curvature keeps the flow laminar */
    }

    /* ============ the light exposure — streamline engraving ============
       Jobard–Lefer evenly-spaced streamlines through the same seeded
       field: candidate seeds from a seeded PRNG, min separation ~SEP,
       RK2 integration in both directions, alpha-tapered ends. The set
       is chosen once per viewport at t=0 (deterministic); each frame
       the accepted seeds are re-integrated through the drifting field
       with fixed step budgets, so the drawing sways without popping.
       Every frame starts from a cleared canvas — nothing accumulates. */
    var SEP = 34, DS = 4, L_W = 1.25;
    var lines = [];
    function mulberry(seed){
      var s = seed | 0;
      return function(){
        s = s + 0x6D2B79F5 | 0;
        var t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function rk2(x, y, t, dir){
      var a1 = angle(x, y, t);
      var mx = x + Math.cos(a1) * DS * .5 * dir, my = y + Math.sin(a1) * DS * .5 * dir;
      var a2 = angle(mx, my, t);
      return [x + Math.cos(a2) * DS * dir, y + Math.sin(a2) * DS * dir];
    }
    function buildLines(){
      lines = [];
      if (w < 8 || h < 8) return;
      var rnd = mulberry(SEED ^ 0x51ab);
      var M = 36, cell = SEP;
      var cols = Math.ceil((w + 2 * M) / cell), rows = Math.ceil((h + 2 * M) / cell);
      var grid = new Array(cols * rows);
      function near(x, y, r){
        var r2 = r * r;
        var cx = ((x + M) / cell) | 0, cy = ((y + M) / cell) | 0;
        for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++){
          var yy = cy + oy, xx = cx + ox;
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          var b = grid[yy * cols + xx];
          if (!b) continue;
          for (var k = 0; k < b.length; k += 2){
            var dx = b[k] - x, dy = b[k + 1] - y;
            if (dx * dx + dy * dy < r2) return true;
          }
        }
        return false;
      }
      function put(x, y){
        var cx = Math.min(cols - 1, Math.max(0, ((x + M) / cell) | 0));
        var cy = Math.min(rows - 1, Math.max(0, ((y + M) / cell) | 0));
        var i = cy * cols + cx;
        (grid[i] || (grid[i] = [])).push(x, y);
      }
      function trace(sx, sy, dir){
        var pts = [], x = sx, y = sy;
        var MAXS = Math.ceil((w + 160) / DS) + 90;
        for (var s = 0; s < MAXS; s++){
          var nx = rk2(x, y, 0, dir);
          x = nx[0]; y = nx[1];
          if (x < -M || x > w + M || y < -M || y > h + M) break;
          if (s % 3 === 0 && near(x, y, SEP * .68)) break;   /* Jobard–Lefer dTest — no double-tracks */
          pts.push(x, y);
        }
        return pts;
      }
      /* candidate seeds: one seeded jittered rake per row band, then a
         seeded scatter — deterministic per viewport */
      var cand = [], nrow = Math.ceil(h / (SEP * .82));
      for (var i = 0; i < nrow; i++)
        cand.push([rnd() * w, (i + .5) * h / nrow + (rnd() - .5) * SEP * .5]);
      for (i = 0; i < nrow; i++) cand.push([rnd() * w, rnd() * h]);
      var MAXL = 26, minPts = 30;   /* ≥120px of drawn curve */
      for (i = 0; i < cand.length && lines.length < MAXL; i++){
        var sx = cand[i][0], sy = cand[i][1];
        if (near(sx, sy, SEP)) continue;       /* Jobard–Lefer dSep — even seeding */
        var back = trace(sx, sy, -1), fwd = trace(sx, sy, 1);
        var nb = back.length / 2, nf = fwd.length / 2, n = nb + nf + 1;
        if (n < minPts) continue;
        var pts = new Float32Array(n * 2), o = 0, k;
        for (k = back.length - 2; k >= 0; k -= 2){ pts[o++] = back[k]; pts[o++] = back[k + 1]; }
        pts[o++] = sx; pts[o++] = sy;
        for (k = 0; k < fwd.length; k += 2){ pts[o++] = fwd[k]; pts[o++] = fwd[k + 1]; }
        for (k = 0; k < pts.length; k += 4) put(pts[k], pts[k + 1]);
        lines.push({sx:sx, sy:sy, nb:nb, nf:nf, n:n, pts:pts});
      }
    }
    function reIntegrate(ln, t, out){
      /* same seed and step budget through the drifting field —
         the engraved line sways; it never pops */
      var o = ln.nb * 2, x = ln.sx, y = ln.sy, k, nx;
      out[o] = x; out[o + 1] = y;
      for (k = 1; k <= ln.nb; k++){
        nx = rk2(x, y, t, -1); x = nx[0]; y = nx[1];
        out[o - k * 2] = x; out[o - k * 2 + 1] = y;
      }
      x = ln.sx; y = ln.sy;
      for (k = 1; k <= ln.nf; k++){
        nx = rk2(x, y, t, 1); x = nx[0]; y = nx[1];
        out[o + k * 2] = x; out[o + k * 2 + 1] = y;
      }
    }
    var NB = 10, buckX = [], buckW = [];        /* alpha buckets batch segments into few stroke() calls */
    for (var bi = 0; bi <= NB; bi++){ buckX.push([]); buckW.push(0); }
    var scratch = null;
    function renderLight(){
      ctx.clearRect(0, 0, w, h);                 /* full clear every frame — nothing accumulates */
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = L_W;
      var A = pal.a;
      var bendy = ptr.b > .01;
      var b, i, k;
      for (b = 0; b <= NB; b++) buckW[b] = 0;
      for (i = 0; i < lines.length; i++){
        var ln = lines[i];
        /* re-integrate through the drifting field — the engraving
           sways slightly; it never pops */
        if (!scratch || scratch.length < ln.n * 2) scratch = new Float32Array(Math.max(2048, ln.n * 2));
        reIntegrate(ln, simT, scratch);
        var pts = scratch;
        var m = A;
        var TAP = Math.min(26, ln.n * .16);      /* tapered ends */
        var px = 0, py = 0;
        for (k = 0; k < ln.n; k++){
          var x = pts[k * 2], y = pts[k * 2 + 1];
          if (bendy){
            var dx = x - ptr.x, dy = y - ptr.y, d2 = dx * dx + dy * dy;
            if (d2 < PTR_R2 * 7){
              var g = ptr.b * Math.exp(-d2 / PTR_R2);
              if (g > .004){                     /* the line bows around the cursor;
                                                    the push relaxes at the apex so
                                                    the bow stays round, never kinked */
                var dd = Math.sqrt(d2) || 1;
                var push = g * 26 * (dd / (dd + 48));
                x += dx / dd * push; y += dy / dd * push;
              }
            }
          }
          if (k > 0){
            var tp = Math.min(1, k / TAP, (ln.n - k) / TAP);
            var a = m * (tp * tp * (3 - 2 * tp)) * edgeFade(x, y);
            b = Math.round(Math.min(1.45, a / Math.max(A, .001)) / 1.45 * NB);
            if (b > 0){
              var arr = buckX[b], o = buckW[b];
              arr[o] = px; arr[o + 1] = py; arr[o + 2] = x; arr[o + 3] = y;
              buckW[b] = o + 4;
            }
          }
          px = x; py = y;
        }
      }
      for (b = 1; b <= NB; b++){
        if (!buckW[b]) continue;
        ctx.strokeStyle = 'rgba(' + pal.main + ',' + (1.45 * Math.max(A, .001) * b / NB).toFixed(4) + ')';
        ctx.beginPath();
        var arr = buckX[b];
        for (k = 0; k < buckW[b]; k += 4){
          ctx.moveTo(arr[k], arr[k + 1]); ctx.lineTo(arr[k + 2], arr[k + 3]);
        }
        ctx.stroke();
      }
    }

    /* ============ the dark exposure — luminous long exposure ==========
       step() always advances the physics (both themes, so snapshots
       stay warm for a theme flip); it deposits ink only when draw is
       true. */
    function step(ts, draw){
      fc++;
      if (draw){
        if (fc % 4 === 0){
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = pal.veil;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.globalCompositeOperation = pal.comp;
        ctx.lineCap = 'round';
      }
      for (var i = 0; i < parts.length; i++){
        var p = parts[i];
        var target = angle(p.x, p.y, ts);
        if (p.h === null) p.h = target;
        p.h += (target - p.h) * .045;   /* softer heading response — smoother arcs */
        p.px = p.x; p.py = p.y;
        p.x += Math.cos(p.h) * p.s * 2.2;   /* one speed — both themes */
        p.y += Math.sin(p.h) * p.s * 2.2;
        if (draw && ptr.b > .01){ /* pointer response: a dipole-like
             velocity-field perturbation — nearby strokes are pushed
             radially and slide tangentially, so the flow parts and
             bows around the cursor, then rejoins its own line. The
             heading is never touched: no curls, no scribble. */
          var ddx = p.x - ptr.x, ddy = p.y - ptr.y;
          var g = ptr.b * Math.exp(-(ddx * ddx + ddy * ddy) / PTR_R2);
          if (g > .02){
            var dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
            var rx = ddx / dd, ry = ddy / dd;
            /* the tangential term follows the stroke's own direction —
               continuous (no sign flip), so the bow stays smooth */
            var cr = rx * Math.sin(p.h) - ry * Math.cos(p.h);
            p.x += (rx * 1.1 - ry * cr * .85) * g;
            p.y += (ry * 1.1 + rx * cr * .85) * g;
          }
        }
        p.life--;
        if (p.x > w + 24 || p.x < -24 || p.y < -24 || p.y > h + 24 || p.life < 0){ spawn(p); continue; }
        if (!draw) continue;
        var a = alphaOf(p);
        ctx.lineWidth = p.isB ? 1.4 : 1;
        ctx.strokeStyle = 'rgba(' + (p.deep ? pal.deep : pal.main) + ',' + a + ')';
        ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
    }
    function redevelop(){
      /* repaint under the current theme.
         light: rebuild the streamline set if the viewport changed and
         re-stroke it on a cleared canvas (nothing accumulates).
         dark: rewind to the exposure snapshot and replay the identical
         trajectory window under the dark palette — no reseed, no
         restart; only the pigments change. */
      pal = palette();
      if (!pal.dark){
        if (!lines.length) buildLines();
        renderLight();
        return;
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h);
      var s = snapA || snapB;
      if (!s) return;
      var target = Math.max(simT, s.t + EXPOSE * DT);
      restoreSnap(s);
      var guard = 0;
      var pb = ptr.b; ptr.b = 0;   /* pointer boost disabled during replay */
      while (simT < target && guard++ < EXPOSE * 3){
        simT += DT;
        step(simT, true);
        if (++sinceSnap >= EXPOSE) takeSnap();
      }
      ptr.b = pb;
    }
    function setStore(){
      /* crisp backing store: 2x on fine-pointer desktops, 1.5x
         elsewhere; the transform rescales, geometry never changes */
      var cap = (window.matchMedia &&
                 matchMedia('(hover:hover) and (min-width:960px)').matches) ? 2 : 1.5;
      var dpr = Math.min(window.devicePixelRatio || 1, cap);
      var r = canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2){ w = 0; h = 0; return false; }
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    function resize(){
      if (!setStore()) return;
      /* a new viewport is the only thing that reseeds — and it reseeds
         identically for both themes */
      randState = SEED; simT = 0; fc = 0;
      parts = [];
      for (var i = 0; i < 260; i++) parts.push(spawn());
      snapA = null; snapB = null; sinceSnap = 0;
      takeSnap();
      lines = [];                         /* streamlines rebuild for the new viewport */
      redevelop();
    }
    function resizeKeep(){
      /* small height-only deltas (mobile URL bar): resize the backing
         store and re-develop from the snapshot — the same drawing
         continues; nothing reseeds */
      if (!setStore()) return;
      lines = [];
      redevelop();
    }
    function frame(ts){
      raf = requestAnimationFrame(frame);
      if (ts - last < 31) return;         /* 30fps cap — both themes */
      last = ts;
      if (ptr.on || ptr.b > 0){
        ptr.b += (ptr.tb - ptr.b) * .12;
        ptr.x += (ptr.tx - ptr.x) * .3;   /* smoothed pointer tracking */
        ptr.y += (ptr.ty - ptr.y) * .3;
      }
      simT += DT;
      step(simT, pal.dark);               /* physics always; ink deposits only in dark */
      if (++sinceSnap >= EXPOSE) takeSnap();
      if (!pal.dark) renderLight();       /* light: cleared canvas, re-stroked */
    }
    function start(){ if (!running){ running = true; last = 0; raf = requestAnimationFrame(frame); } }
    function stop(){ if (running){ running = false; cancelAnimationFrame(raf); } }

    function apply(opts){
      opts = opts || {};
      var r = canvas.getBoundingClientRect();
      var sizeChanged = Math.abs(r.width - w) > 1 || Math.abs(r.height - h) > 1;
      if (w === 0 || sizeChanged || opts.reseed) resize();
      else if (opts.repaint) redevelop();
      wantLive = true;
      if (visible && !document.hidden) start(); else stop();
    }
    var needsRelight = false;
    function themeFlip(){
      /* only an on-screen canvas re-develops inside the click — an
         offscreen one re-lights lazily (same snapshot, same
         trajectories, so the drawing is identical either way) */
      if (!visible){
        needsRelight = true;
        if (window.requestIdleCallback){
          requestIdleCallback(function(){
            if (needsRelight){ needsRelight = false; redevelop(); }
          });
        }
        return;
      }
      /* quiet crossfade: repaint under an opacity fade so the flip never blinks */
      canvas.classList.add('snap');
      apply({repaint:true});
      void canvas.offsetWidth;
      requestAnimationFrame(function(){ canvas.classList.remove('snap'); });
    }
    function wake(){ wantLive = true; if (visible && !document.hidden) start(); }
    function sleep(){ wantLive = false; stop(); }

    var rt = null;
    function onSizeSettled(){
      var r = canvas.getBoundingClientRect();
      var dw = Math.abs(r.width - w), dh = Math.abs(r.height - h);
      if (dw <= 1 && dh <= 1) return;              /* size-unchanged event — free */
      if (dw > 1 || dh > 150) apply({reseed:true}); /* a genuinely new viewport */
      else resizeKeep();                            /* URL-bar collapse: keep the drawing */
    }
    if (window.ResizeObserver){
      /* catches late stylesheet/layout arrival — reloads must self-heal */
      var ro = new ResizeObserver(function(){
        clearTimeout(rt); rt = setTimeout(onSizeSettled, 150);
      });
      ro.observe(canvas);
    }
    window.addEventListener('resize', function(){
      clearTimeout(rt);
      rt = setTimeout(onSizeSettled, 150);
    });
    new IntersectionObserver(function(es){
      es.forEach(function(e){
        visible = e.isIntersecting;
        if (visible && needsRelight){ needsRelight = false; redevelop(); }
        if (wantLive && visible && !document.hidden) start(); else stop();
      });
    }, {threshold:0}).observe(canvas);
    /* never draw in a hidden tab */
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) stop();
      else if (wantLive && visible) start();
    });

    function advance(ms){
      /* test hook: runs the real per-frame path without waiting on
         requestAnimationFrame */
      var n = Math.max(1, Math.round(ms / DT));
      for (var i = 0; i < n; i++){
        simT += DT;
        step(simT, pal.dark);
        if (++sinceSnap >= EXPOSE) takeSnap();
        if (!pal.dark) renderLight();
      }
    }
    function linePaths(){
      /* the streamlines serialized as SVG path data — used to
         generate the reduced-motion static fallback */
      return lines.map(function(ln){
        var d = '', k;
        for (k = 0; k < ln.n; k += 3)
          d += (k ? 'L' : 'M') + ln.pts[k * 2].toFixed(1) + ' ' + ln.pts[k * 2 + 1].toFixed(1);
        return d;
      });
    }
    attachPtr();   /* the (pointer:fine) gate lives inside */

    /* boot gate: on a cold reload the deferred script can run before the
       stylesheet has applied or the hero has laid out — initializing then
       caches an EMPTY palette (canvas default black ink) and a degenerate
       buffer that gets stretched fat, and nothing recovers until a window
       resize. Hold until the tokens and a real rect exist. */
    function bootReady(){
      var r = canvas.getBoundingClientRect();
      return cssVar('--flow-main') !== '' && r.width > 40 && r.height > 40;
    }
    (function boot(tries){
      if (bootReady()){ apply({}); return; }
      if (tries <= 0){ apply({}); return; }   /* best effort after ~5s */
      requestAnimationFrame(function(){ boot(tries - 1); });
    })(300);
    return {apply:apply, themeFlip:themeFlip, wake:wake, sleep:sleep,
            advance:advance,
            ptrState:function(){ return ptr.on; },
            lineCount:function(){ return lines.length; },
            linePaths:linePaths};
  }

  /* one seeded system, up to two instances of it: the hero canvas and
     the contact canvas. Both share seed, speed, and palette rules. */
  var engine = (function(){
    var fields = [];
    var ioOK = 'IntersectionObserver' in window;   /* no IO → the static SVG field renders instead */
    var booted = false;
    var c2 = null, contactField = null, near = null;
    function bootContact(){
      if (contactField || !c2) return;
      contactField = makeField(c2);
      fields.push(contactField);
    }
    function boot(){
      if (booted || !ioOK) return;
      booted = true;
      var c1 = document.getElementById('flow');
      if (c1) fields.push(makeField(c1));
      /* the contact canvas initializes on approach — development is
         deterministic from SEED, so the drawing is pixel-identical,
         but half the load-time replay cost is deferred. */
      c2 = document.getElementById('flow2');
      if (c2){
        near = new IntersectionObserver(function(es){
          es.forEach(function(e){
            if (!e.isIntersecting || contactField) return;
            near.disconnect();
            bootContact();
          });
        }, {rootMargin:'1200px 0px'});
        near.observe(c2);
      }
    }
    if (motionOK) boot();
    return {
      apply:function(o){ fields.forEach(function(f){ f.apply(o); }); },
      themeFlip:function(){ fields.forEach(function(f){ f.themeFlip(); }); },
      setLive:function(on){
        if (on){ boot(); fields.forEach(function(f){ f.wake(); }); }
        else fields.forEach(function(f){ f.sleep(); });
      },
      advance:function(ms){ fields.forEach(function(f){ f.advance(ms); }); },
      probe:function(){
        return {fields:fields.length,
                lines:fields.map(function(f){ return f.lineCount(); }),
                paths:fields.map(function(f){ return f.linePaths(); }),
                pointer:fields.map(function(f){ return f.ptrState(); })};
      }
    };
  })();

  /* ——— reduced-motion is tracked live, not read once at load —
         flipping it mid-session swaps canvas ↔ static field both ways ——— */
  if (window.matchMedia){
    var rmq = matchMedia('(prefers-reduced-motion: reduce)');
    var rmSync = function(){
      motionOK = !rmq.matches;
      html.classList.toggle('motion', motionOK);
      engine.setLive(motionOK);
    };
    if (rmq.addEventListener) rmq.addEventListener('change', rmSync);
    else if (rmq.addListener) rmq.addListener(rmSync);
  }

  /* ——— the service ledger animates open/close instead of the native
         one-frame snap ——— */
  (function(){
    var det = document.querySelector('details.svc-tier');
    if (!det) return;
    var sum = det.querySelector('summary');
    var ledger = det.querySelector('.svc-ledger');
    if (!sum || !ledger || typeof ledger.animate !== 'function') return;
    var anim = null;
    var EASE = 'cubic-bezier(.2,.8,.2,1)', DUR = 320;   /* --ease family */
    function settle(fn){
      /* run once, on finish or on a timer — whichever lands first; a
         superseding animation makes the stale callback a no-op */
      var a = anim, done = false;
      function run(){ if (done || anim !== a) return; done = true; fn(); }
      a.onfinish = run;
      setTimeout(run, DUR + 120);
    }
    sum.addEventListener('click', function(e){
      if (!html.classList.contains('motion')) return;   /* reduced motion: native snap */
      e.preventDefault();
      if (anim){ anim.cancel(); anim = null; }          /* a re-click reverses, never stalls */
      ledger.style.overflow = 'hidden';
      if (!det.open){
        det.open = true;
        anim = ledger.animate(
          [{height:'0px', opacity:0, marginTop:'0px'},
           {height:ledger.scrollHeight + 'px', opacity:1, marginTop:'1.75rem'}],
          {duration:DUR, easing:EASE});
        settle(function(){ ledger.style.overflow = ''; anim = null; });
      } else {
        anim = ledger.animate(
          [{height:ledger.scrollHeight + 'px', opacity:1, marginTop:'1.75rem'},
           {height:'0px', opacity:0, marginTop:'0px'}],
          {duration:DUR, easing:EASE});
        settle(function(){ ledger.style.overflow = ''; det.open = false; anim = null; });
      }
    });
  })();

  /* ——— print: the collapsed ledger opens for printing, then restores ——— */
  (function(){
    var det = document.querySelector('details.svc-tier');
    if (!det) return;
    var was = false;
    window.addEventListener('beforeprint', function(){ was = det.open; det.open = true; });
    window.addEventListener('afterprint', function(){ det.open = was; });
  })();

  /* ——— URL sync — the chosen theme is shareable ——— */
  function syncURL(){
    var p = new URLSearchParams(location.search);
    if (themeExplicit) p.set('theme', html.dataset.theme); else p.delete('theme');
    var q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
  }

  /* ——— meta theme-color ——— */
  function metaColor(){
    var c = html.dataset.theme === 'dark' ? '#0a0f0c' : '#f6f2ea';
    document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){ m.setAttribute('content', c); });
  }

  /* ——— theme toggle — a quiet 240ms token crossfade ——— */
  var toggle = document.getElementById('themeToggle');
  function toggleAria(){
    if (!toggle) return;
    toggle.setAttribute('aria-label',
      html.dataset.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  function setTheme(next){
    if (next !== 'light' && next !== 'dark') return;
    if (next === html.dataset.theme) return;
    if (motionOK) html.classList.add('theming');
    html.dataset.theme = next;
    try { localStorage.setItem(storageKey, next); } catch(e){}
    themeExplicit = true;
    syncURL(); metaColor(); toggleAria();
    announce(next === 'dark' ? 'Dark theme on' : 'Light theme on');
    if (motionOK){
      engine.themeFlip();
      setTimeout(function(){ html.classList.remove('theming'); }, 300);
    } else {
      engine.apply({repaint:true});
    }
  }
  toggleAria(); metaColor();
  if (toggle){
    toggle.addEventListener('click', function(){
      setTheme(html.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  /* ——— cross-tab + system-preference sync (no stored/URL choice) ——— */
  window.addEventListener('storage', function(event){
    if (event.key !== storageKey) return;
    var value = event.newValue;
    if (value !== 'light' && value !== 'dark') return;
    if (value === html.dataset.theme) return;
    html.dataset.theme = value;
    metaColor(); toggleAria();
    engine.apply({repaint:true});
  });
  if (window.matchMedia){
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(event){
      var stored = null;
      try { stored = localStorage.getItem(storageKey); } catch(e){}
      if (stored === 'light' || stored === 'dark') return;
      if (themeExplicit) return;
      var next = event.matches ? 'dark' : 'light';
      if (next === html.dataset.theme) return;
      html.dataset.theme = next;
      metaColor(); toggleAria();
      engine.apply({repaint:true});
    });
  }

  /* ——— scroll-spy — the current section's nav link keeps its
         underline. Nav routes stay page routes; data-spy names the
         homepage section each link answers for. ——— */
  (function(){
    var io = null, cur = null, links = {};
    document.querySelectorAll('header.site nav.primary a[data-spy]').forEach(function(a){
      links[a.getAttribute('data-spy')] = a;
    });
    if (!Object.keys(links).length) return;
    function set(id){
      var next = (id && links[id]) || null;
      if (next === cur) return;
      if (cur) cur.classList.remove('current');
      cur = next;
      if (cur) cur.classList.add('current');
    }
    if (!('IntersectionObserver' in window)) return;
    var sections = document.querySelectorAll('main section[id]');
    if (!sections.length) return;
    io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if (e.isIntersecting) set(e.target.id); });
    }, {rootMargin:'-45% 0px -50% 0px'});
    sections.forEach(function(s){ io.observe(s); });
  })();


  /* ================= interior-page machinery ================= */

    function initializePrototypePages() {
        const pages = [...document.querySelectorAll("[data-page]")];
        if (pages.length < 2) return;

        const requested = new URLSearchParams(window.location.search).get("page");
        const availablePages = pages.map((page) => page.dataset.page).filter(Boolean);
        const fallback = pages.find((page) => !page.hidden)?.dataset.page || availablePages[0];
        const activePage = availablePages.includes(requested) ? requested : fallback;

        pages.forEach((page) => {
            page.hidden = page.dataset.page !== activePage;
        });

        document.querySelectorAll("[data-nav]").forEach((link) => {
            const active = link.dataset.nav === activePage;
            link.classList.toggle("is-active", active);
            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    function initializeMobileNavigation() {
        const menuButton = document.querySelector(
            ".menu-button, .nav-toggle, [data-nav-toggle]",
        );
        const mobileNavigation = document.querySelector(
            ".mobile-nav, [data-mobile-nav], .site-menu",
        );
        if (!menuButton || !mobileNavigation) return;

        const focusableSelector = [
            "a[href]",
            "button:not([disabled])",
            "input:not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            '[tabindex]:not([tabindex="-1"])',
        ].join(",");
        const inertState = new Map();
        let lastFocused = null;

        if (!mobileNavigation.id) mobileNavigation.id = "mobile-navigation";
        menuButton.setAttribute("aria-controls", mobileNavigation.id);

        function isVisible(element) {
            return element.getClientRects().length > 0;
        }

        function focusableElements() {
            const headerControls = [
                ...document.querySelectorAll(".theme-toggle, [data-theme-toggle]"),
                menuButton,
            ];
            const menuControls = [...mobileNavigation.querySelectorAll(focusableSelector)];
            return [...new Set([...headerControls, ...menuControls])].filter(isVisible);
        }

        function setPageInert(inert) {
            const pageRegions = document.querySelectorAll("main, .footer");
            pageRegions.forEach((region) => {
                if (mobileNavigation.contains(region) || region.contains(mobileNavigation)) return;
                if (inert) {
                    if (!inertState.has(region)) inertState.set(region, region.inert);
                    region.inert = true;
                } else if (inertState.has(region)) {
                    region.inert = inertState.get(region);
                    inertState.delete(region);
                }
            });
        }

        function setMenu(open, restoreFocus = true) {
            if (open) lastFocused = document.activeElement;

            mobileNavigation.classList.toggle("is-open", open);
            mobileNavigation.setAttribute("aria-hidden", String(!open));
            mobileNavigation.inert = !open;
            menuButton.setAttribute("aria-expanded", String(open));
            menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
            document.body.classList.toggle("menu-open", open);
            setPageInert(open);

            if (open) {
                const firstMenuControl = mobileNavigation.querySelector(focusableSelector);
                (firstMenuControl || menuButton).focus();
            } else if (restoreFocus) {
                const focusTarget =
                    lastFocused instanceof HTMLElement && lastFocused.isConnected
                        ? lastFocused
                        : menuButton;
                focusTarget.focus();
            }
        }

        setMenu(false, false);

        menuButton.addEventListener("click", () => {
            setMenu(menuButton.getAttribute("aria-expanded") !== "true");
        });

        mobileNavigation.querySelectorAll("a[href]").forEach((link) => {
            link.addEventListener("click", () => setMenu(false, false));
        });

        document.addEventListener("keydown", (event) => {
            if (menuButton.getAttribute("aria-expanded") !== "true") return;

            if (event.key === "Escape") {
                event.preventDefault();
                setMenu(false);
                return;
            }

            if (event.key !== "Tab") return;
            const controls = focusableElements();
            if (controls.length === 0) {
                event.preventDefault();
                menuButton.focus();
                return;
            }

            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        });

        document.addEventListener("focusin", (event) => {
            if (menuButton.getAttribute("aria-expanded") !== "true") return;
            if (focusableElements().includes(event.target)) return;
            const firstMenuControl = mobileNavigation.querySelector(focusableSelector);
            (firstMenuControl || menuButton).focus();
        });

        window.matchMedia("(min-width: 960px)").addEventListener("change", (event) => {
            if (event.matches && menuButton.getAttribute("aria-expanded") === "true") {
                setMenu(false, false);
            }
        });
    }

    function initializePublicationFilters() {
        const filterContainers = [
            ...new Set(
                document.querySelectorAll(
                    "#publication-filters, [data-publication-filters], .archive-tools",
                ),
            ),
        ];

        filterContainers.forEach((container) => {
            const scope = container.closest("main, [data-page]") || document;
            const search = container.querySelector(
                "#publication-search, #search-input, [data-publication-search], input.search, input[type='search']",
            );
            const year = container.querySelector(
                "#publication-year, [data-publication-year], select[name='year']",
            );
            const direction = container.querySelector(
                "#publication-direction, [data-publication-direction], select[name='direction']",
            );
            const yearButtons = [
                ...container.querySelectorAll("[data-filter-year], [data-year-filter]"),
            ];
            const directionButtons = [
                ...container.querySelectorAll(
                    "[data-filter-direction], [data-direction-filter]",
                ),
            ];
            const topicButtons = [...container.querySelectorAll("[data-filter]")];
            const publications = [
                ...scope.querySelectorAll("[data-pub-item], [data-publication]"),
            ];
            if (publications.length === 0) return;

            const groups = [
                ...scope.querySelectorAll("[data-group], [data-publication-group]"),
            ];
            const status = scope.querySelector(
                "#publication-result-status, [data-result-status], .result-status",
            );
            const emptyState = scope.querySelector(
                "#filter-empty, [data-filter-empty], .empty-state",
            );
            const activeYearButton = yearButtons.find((button) =>
                button.classList.contains("is-active"),
            );
            const activeDirectionButton = directionButtons.find((button) =>
                button.classList.contains("is-active"),
            );
            let selectedYear =
                activeYearButton?.dataset.filterYear ||
                activeYearButton?.dataset.yearFilter ||
                "";
            let selectedDirection =
                activeDirectionButton?.dataset.filterDirection ||
                activeDirectionButton?.dataset.directionFilter ||
                "";
            let selectedTopic =
                topicButtons.find((button) => button.classList.contains("is-active"))?.dataset
                    .filter || "";

            function normalizedValue(value) {
                const normalized = String(value || "").trim().toLowerCase();
                return normalized === "all" ? "" : normalized;
            }

            function publicationYear(publication) {
                if (publication.dataset.year) return publication.dataset.year;
                const group = publication.closest("[data-year], [data-group], [data-publication-group]");
                if (group?.dataset.year) return group.dataset.year;
                const dated = publication.querySelector("time[datetime]");
                if (dated) return dated.getAttribute("datetime").slice(0, 4);
                const heading = group?.querySelector(".archive-year");
                return heading?.textContent.match(/\b\d{4}\b/)?.[0] || "";
            }

            function valuesFromData(value) {
                const normalized = String(value || "").trim().toLowerCase();
                if (!normalized) return [];
                return normalized.split(/\s*[|,;]\s*/).filter(Boolean);
            }

            function matchesDataValue(rawValue, selected) {
                if (!selected) return true;
                const normalized = String(rawValue || "").trim().toLowerCase();
                return (
                    normalized === selected ||
                    valuesFromData(normalized).includes(selected) ||
                    normalized.split(/\s+/).includes(selected)
                );
            }

            function applyFilters() {
                const query = String(search?.value || "").trim().toLowerCase();
                const activeYear = normalizedValue(year ? year.value : selectedYear);
                const activeDirection = normalizedValue(
                    direction ? direction.value : selectedDirection,
                );
                const activeTopic = normalizedValue(selectedTopic);
                let visibleCount = 0;

                publications.forEach((publication) => {
                    const searchText = (
                        publication.dataset.search ||
                        publication.dataset.title ||
                        publication.textContent
                    ).toLowerCase();
                    const directions =
                        publication.dataset.directions || publication.dataset.direction || "";
                    const topics = publication.dataset.topics || directions;
                    const visible =
                        (!query || searchText.includes(query)) &&
                        (!activeYear ||
                            publicationYear(publication).toLowerCase() === activeYear) &&
                        matchesDataValue(directions, activeDirection) &&
                        matchesDataValue(topics, activeTopic);

                    publication.hidden = !visible;
                    if (visible) visibleCount += 1;
                });

                groups.forEach((group) => {
                    group.hidden = !group.querySelector(
                        "[data-pub-item]:not([hidden]), [data-publication]:not([hidden])",
                    );
                });

                if (status) {
                    status.textContent = `Showing ${visibleCount} publication${
                        visibleCount === 1 ? "" : "s"
                    }`;
                }
                if (emptyState) {
                    emptyState.hidden = visibleCount !== 0;
                    emptyState.classList.toggle("is-visible", visibleCount === 0);
                }
            }

            function initializeButtonGroup(buttons, dataKeys, setValue) {
                buttons.forEach((button) => {
                    button.setAttribute(
                        "aria-pressed",
                        String(button.classList.contains("is-active")),
                    );
                    button.addEventListener("click", () => {
                        const value =
                            dataKeys.map((dataKey) => button.dataset[dataKey]).find(Boolean) ||
                            "";
                        setValue(value);
                        buttons.forEach((candidate) => {
                            const active = candidate === button;
                            candidate.classList.toggle("is-active", active);
                            candidate.setAttribute("aria-pressed", String(active));
                        });
                        applyFilters();
                    });
                });
            }

            initializeButtonGroup(yearButtons, ["filterYear", "yearFilter"], (value) => {
                selectedYear = value;
            });
            initializeButtonGroup(
                directionButtons,
                ["filterDirection", "directionFilter"],
                (value) => {
                    selectedDirection = value;
                },
            );
            initializeButtonGroup(topicButtons, ["filter"], (value) => {
                selectedTopic = value;
            });

            container.addEventListener("input", applyFilters);
            container.addEventListener("change", applyFilters);
            if (container instanceof HTMLFormElement) {
                container.addEventListener("submit", (event) => event.preventDefault());
            }
            applyFilters();
        });
    }

    async function copyText(text) {
        if (navigator.clipboard?.writeText && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard copy was rejected.");
    }

    function initializeCitationCopying() {
        document
            .querySelectorAll("[data-cite], [data-bibtex], [data-citation], .copy-bibtex")
            .forEach((button) => {
                button.setAttribute("aria-live", "polite");
                button.addEventListener("click", async (event) => {
                    const citation =
                        button.dataset.cite ||
                        button.dataset.bibtex ||
                        button.dataset.citation;
                    if (!citation || button.dataset.copying === "true") return;
                    if (button instanceof HTMLAnchorElement) event.preventDefault();

                    const originalMarkup = button.innerHTML;
                    const originalLabel = button.getAttribute("aria-label");
                    button.dataset.copying = "true";

                    try {
                        await copyText(citation);
                        button.textContent = "Copied";
                        announce("BibTeX copied to clipboard");
                        button.setAttribute("aria-label", "Citation copied");
                    } catch {
                        button.textContent = "Copy failed";
                        announce("Copy failed");
                        button.setAttribute("aria-label", "Could not copy citation");
                    }

                    window.setTimeout(() => {
                        button.innerHTML = originalMarkup;
                        if (originalLabel === null) {
                            button.removeAttribute("aria-label");
                        } else {
                            button.setAttribute("aria-label", originalLabel);
                        }
                        delete button.dataset.copying;
                    }, 1600);
                });
            });
    }

    function initializeUpdateFilters() {
        const list = document.querySelector("[data-updates-list]");
        if (!list) return;

        const records = [...list.querySelectorAll("[data-update-type]")];
        const buttons = [...document.querySelectorAll("[data-update-filter]")];
        const status = document.querySelector("[data-update-status]");
        const emptyState = document.querySelector("[data-update-empty]");
        if (!records.length || !buttons.length) return;

        const validFilters = new Set(["all", "talk", "news"]);

        function applyFilter(filter, updateUrl = false) {
            const selected = validFilters.has(filter) ? filter : "all";
            const visible = records.filter((record) => {
                const show =
                    selected === "all" || record.dataset.updateType === selected;
                record.hidden = !show;
                record.classList.remove("is-first-visible", "is-last-visible");
                return show;
            });

            visible[0]?.classList.add("is-first-visible");
            visible.at(-1)?.classList.add("is-last-visible");

            buttons.forEach((button) => {
                const active = button.dataset.updateFilter === selected;
                button.classList.toggle("is-active", active);
                button.setAttribute("aria-pressed", String(active));
            });

            if (status) {
                const noun = visible.length === 1 ? "update" : "updates";
                status.textContent = `${visible.length} ${noun}`;
            }
            if (emptyState) emptyState.hidden = visible.length !== 0;

            if (updateUrl) {
                const url = new URL(window.location.href);
                if (selected === "all") {
                    url.searchParams.delete("filter");
                } else {
                    url.searchParams.set("filter", selected);
                }
                window.history.replaceState({}, "", url);
            }
        }

        buttons.forEach((button) => {
            button.addEventListener("click", () => {
                applyFilter(button.dataset.updateFilter, true);
            });
        });

        applyFilter(
            new URLSearchParams(window.location.search).get("filter") || "all",
        );
    }

    function initializeFormattedDates() {
        const formatter = new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
        document.querySelectorAll("time[data-format-date][datetime]").forEach((element) => {
            const value = element.getAttribute("datetime");
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return;
            const parsed = new Date(`${value}T00:00:00`);
            if (!Number.isNaN(parsed.valueOf())) {
                element.textContent = formatter.format(parsed);
            }
        });
    }

    function initializeReadingProgress() {
        const progress = document.querySelector(".reading-progress span");
        const content = document.querySelector(".blog-post__content");
        if (!progress || !content) return;

        function update() {
            const start = content.offsetTop;
            const end = content.offsetTop + content.offsetHeight - window.innerHeight;
            const distance = Math.max(1, end - start);
            const value = Math.min(1, Math.max(0, (window.scrollY - start) / distance));
            progress.style.transform = `scaleX(${value})`;
        }

        window.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        update();
    }

  initializePrototypePages();
  initializeMobileNavigation();
  initializePublicationFilters();
  initializeCitationCopying();
  initializeUpdateFilters();
  initializeFormattedDates();
  initializeReadingProgress();
})();
