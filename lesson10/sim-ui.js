/* 第10堂示範共用：配色、畫布、主題。物理在各頁自己的 script。 */
(function (global) {
  'use strict';

  const FONT = 'system-ui, -apple-system, "Segoe UI", "Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", "WenQuanYi Micro Hei", "Droid Sans Fallback", sans-serif';
  const G = 9.8;

  const PAL = {
    light: {
      bg: '#ffffff', grid: '#efeee9', grid2: '#dcdad1', ink: '#1a1a19', ink2: '#55544f', muted: '#8c8a83',
      a: '#2563c9', b: '#d9531e', c: '#178a4c', cm: '#7c3aed', gold: '#b58105',
      ghost: 'rgba(26,26,25,0.35)', ground: '#9a978c', warn: '#c2410c', ok: '#15803d',
      ans: '#7c3aed', panel: '#fafaf8', panelLine: 'rgba(0,0,0,0.12)', ice: '#e7eef6',
    },
    dark: {
      bg: '#161615', grid: '#232321', grid2: '#34342f', ink: '#f2f1ec', ink2: '#c3c2b7', muted: '#8c8a83',
      a: '#5b9cf5', b: '#f08050', c: '#3fbf78', cm: '#b48cff', gold: '#f5c451',
      ghost: 'rgba(242,241,236,0.35)', ground: '#6d6b63', warn: '#fb923c', ok: '#4ade80',
      ans: '#b48cff', panel: '#1d1d1b', panelLine: 'rgba(255,255,255,0.14)', ice: '#1a2430',
    },
  };

  function fmt(x, d) {
    if (d == null) d = 2;
    if (!isFinite(x)) return '—';
    const s = Number(x).toFixed(d);
    return /^-0(?:\.0+)?$/.test(s) ? s.slice(1) : s;
  }

  function themeName() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function cycleTheme() {
    document.documentElement.setAttribute('data-theme', themeName() === 'dark' ? 'light' : 'dark');
  }

  function fitCanvas(canvas, stage) {
    const r = stage.getBoundingClientRect();
    const cs = getComputedStyle(stage);
    const aw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    let w = aw, h = (aw * 9) / 16;
    if (h > ah) { h = ah; w = (ah * 16) / 9; }
    w = Math.max(160, Math.floor(w));
    h = Math.max(90, Math.floor((w * 9) / 16));
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    return { w: w, h: h, dpr: dpr };
  }

  function typeset(root) {
    if (!global.katex) return;
    const scope = root || document;
    scope.querySelectorAll('[data-tex]').forEach((node) => {
      const tex = node.getAttribute('data-tex');
      try {
        global.katex.render(tex, node, {
          throwOnError: false,
          displayMode: node.classList.contains('formula'),
        });
      } catch (e) { /* 留下 HTML 裡的純文字 */ }
    });
  }

  function pen(ctx, w, h, pal) {
    const u = Math.max(0.55, w / 960);
    function font(px, weight) {
      return (weight || 500) + ' ' + (px * u) + 'px ' + FONT;
    }
    function stroke(o) {
      ctx.strokeStyle = o.color || pal.ink;
      ctx.lineWidth = (o.width || 2) * u;
      ctx.setLineDash(o.dash ? o.dash.map((d) => d * u) : []);
      ctx.lineCap = o.cap || 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    function text(x, y, str, o) {
      o = o || {};
      ctx.font = font(o.size || 13, o.weight);
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = o.base || 'middle';
      if (o.halo !== false) {
        ctx.lineWidth = (o.haloWidth || 4) * u;
        ctx.strokeStyle = o.haloColor || pal.bg;
        ctx.lineJoin = 'round';
        ctx.strokeText(str, x, y);
      }
      ctx.fillStyle = o.color || pal.ink;
      ctx.fillText(str, x, y);
    }
    function line(x0, y0, x1, y1, o) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      stroke(o || {});
    }
    function circle(x, y, r, o) {
      o = o || {};
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.color || !o.fill) stroke(o);
    }
    function arrow(x0, y0, x1, y1, o) {
      o = o || {};
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 0.5 * u) return;
      const hw = (o.head || 9) * u * Math.min(1, L / (14 * u));
      const a = Math.atan2(y1 - y0, x1 - x0);
      const bx = x1 - hw * Math.cos(a), by = y1 - hw * Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(bx, by);
      stroke({ color: o.color, width: o.width || 2.4, dash: o.dash });
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(bx + hw * 0.55 * Math.sin(a), by - hw * 0.55 * Math.cos(a));
      ctx.lineTo(bx - hw * 0.55 * Math.sin(a), by + hw * 0.55 * Math.cos(a));
      ctx.closePath();
      ctx.fillStyle = o.color || pal.ink;
      ctx.fill();
    }
    function poly(pts, o) {
      if (!pts.length) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (o && o.close) ctx.closePath();
      if (o && o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (!o || o.color || !o.fill) stroke(o || {});
    }
    function roundRect(x, y, rw, rh, rad, o) {
      o = o || {};
      const r = Math.min(rad, rw / 2, rh / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + rw, y, x + rw, y + rh, r);
      ctx.arcTo(x + rw, y + rh, x, y + rh, r);
      ctx.arcTo(x, y + rh, x, y, r);
      ctx.arcTo(x, y, x + rw, y, r);
      ctx.closePath();
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.color || !o.fill) stroke(o);
    }
    return { u: u, font: font, text: text, line: line, circle: circle, arrow: arrow, poly: poly, roundRect: roundRect, ctx: ctx, pal: pal, w: w, h: h };
  }

  function wirePanel(btn, app) {
    const key = 'sim.panelCollapsed';
    function set(collapsed) {
      app.classList.toggle('collapsed', collapsed);
      btn.textContent = collapsed ? '⚙ 展開參數' : '⚙ 收起參數';
      btn.setAttribute('aria-pressed', String(collapsed));
      try { localStorage.setItem(key, collapsed ? '1' : '0'); } catch (e) { /* 無痕 */ }
    }
    let saved = false;
    try { saved = localStorage.getItem(key) === '1'; } catch (e) { /* 同上 */ }
    set(saved);
    btn.addEventListener('click', () => set(!app.classList.contains('collapsed')));
  }

  function watchResize(stage, canvas, draw) {
    let pending = false;
    function apply() {
      canvas._css = fitCanvas(canvas, stage);
      draw();
    }
    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; apply(); });
    }
    const ro = new ResizeObserver(schedule);
    ro.observe(stage);
    addEventListener('resize', schedule);
    apply();
  }

  function beginFrame(canvas) {
    const css = canvas._css;
    if (!css) return null;
    const ctx = canvas.getContext('2d');
    const pal = PAL[themeName()];
    ctx.setTransform(css.dpr, 0, 0, css.dpr, 0, 0);
    ctx.clearRect(0, 0, css.w, css.h);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, css.w, css.h);
    return pen(ctx, css.w, css.h, pal);
  }

  function canvasPoint(canvas, ev) {
    const rec = canvas.getBoundingClientRect();
    const css = canvas._css || { w: rec.width, h: rec.height };
    return {
      x: (ev.clientX - rec.left) * (css.w / rec.width),
      y: (ev.clientY - rec.top) * (css.h / rec.height),
    };
  }

  function bindRange(id, onInput) {
    const el = document.getElementById(id);
    const out = document.querySelector('[data-for="' + id + '"]');
    const step = el.step && el.step !== 'any' ? el.step : '1';
    const dec = (step.split('.')[1] || '').length;
    function sync() {
      if (out) out.textContent = fmt(parseFloat(el.value), dec);
    }
    el.addEventListener('input', () => { sync(); onInput(parseFloat(el.value)); });
    sync();
    return el;
  }

  function reportCheck(errors) {
    if (errors.length) console.error('[self-check] ' + errors.join(' | '));
    return errors.length === 0;
  }

  global.SimUI = {
    G: G,
    FONT: FONT,
    PAL: PAL,
    fmt: fmt,
    themeName: themeName,
    cycleTheme: cycleTheme,
    fitCanvas: fitCanvas,
    typeset: typeset,
    pen: pen,
    wirePanel: wirePanel,
    watchResize: watchResize,
    beginFrame: beginFrame,
    canvasPoint: canvasPoint,
    bindRange: bindRange,
    reportCheck: reportCheck,
  };
})(window);
