/* LMTLSS UI kit — DOM helpers, icons, charts, toast, sheet, confirm. */

(function () {
  "use strict";

  /* ---------- DOM helpers ---------- */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "dataset") Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else node.setAttribute(k, v === true ? "" : String(v));
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function frag(children) {
    const f = document.createDocumentFragment();
    (children || []).forEach(function (c) { if (c) f.appendChild(c); });
    return f;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* "1 exercise" / "2 exercises" — counts should never look sloppy */
  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  /* ---------- Icons (original stroked set, 24px grid) ---------- */

  const P = {
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V20h12v-9.5"/><path d="M10 20v-5h4v5"/>',
    train: '<path d="M4 12h2.5M17.5 12H20"/><path d="M7 8v8M12 6v12M17 8v8"/><path d="M7 12h10"/>',
    progress: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3.5-4.5 3 3L19 7"/>',
    coach: '<path d="M12 3a7 7 0 0 1 7 7c0 2.4-1.2 4-2.6 5.2-.7.6-1 1.2-1.1 2.3l-.1 1.5H8.8l-.1-1.5c-.1-1.1-.4-1.7-1.1-2.3C6.2 14 5 12.4 5 10a7 7 0 0 1 7-7Z"/><path d="M10 21.5h4"/>',
    profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.4 3.6-5 7-5s6.2 1.6 7 5"/>',
    play: '<path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    back: '<path d="m15 6-6 6 6 6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    bolt: '<path d="M13 3 5.5 13.5H11l-.5 7.5L18.5 10H13l0-7Z"/>',
    drop: '<path d="M12 3.5c3.5 4.2 6 7.2 6 10a6 6 0 1 1-12 0c0-2.8 2.5-5.8 6-10Z"/>',
    heart: '<path d="M12 20s-7-4.4-7-9.5A3.9 3.9 0 0 1 12 7a3.9 3.9 0 0 1 7 3.5C19 15.6 12 20 12 20Z"/>',
    run: '<circle cx="14.5" cy="5" r="2"/><path d="m9 21 2.5-5 2-2.5-1-4-3.5 2-1 3"/><path d="m13.5 9 3 2 2.5-.5"/><path d="m14 13.5 1.5 2.5L18 21"/>',
    dumbbell: '<rect x="3" y="9" width="3" height="6" rx="1"/><rect x="18" y="9" width="3" height="6" rx="1"/><rect x="6.5" y="10.5" width="2.5" height="3" rx="0.8"/><rect x="15" y="10.5" width="2.5" height="3" rx="0.8"/><path d="M9 12h6"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3"/><path d="M12 13v4M9 20h6M10 17h4"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    doc: '<path d="M7 3h7l4 4v14H7V3Z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 16h5"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M6.5 7l.8 13h9.4l.8-13"/>',
    download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11"/><path d="M5 20h14"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/>',
    warning: '<path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 10v4"/><circle cx="12" cy="16.8" r="0.6" fill="currentColor"/>',
    swap: '<path d="M6 8h12l-3-3M18 16H6l3 3"/>',
    share: '<path d="M12 3.5v11"/><path d="m8 7 4-3.5L16 7"/><path d="M5.5 13.5V20h13v-6.5"/>'
  };

  function icon(name, cls) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    if (cls) svg.setAttribute("class", cls);
    // Static icon paths only — P[name] is a module constant, never user input.
    svg.innerHTML = P[name] || "";
    return svg;
  }

  /* ---------- Toast ---------- */

  function toast(msg, opts) {
    opts = opts || {};
    const root = document.getElementById("toast-root");
    const t = el("div", { class: "toast" + (opts.error ? "" : " toast-accent") }, [
      icon(opts.error ? "warning" : "check"),
      el("span", { text: msg })
    ]);
    root.appendChild(t);
    setTimeout(function () {
      t.style.opacity = "0";
      t.style.transition = "opacity 200ms";
      setTimeout(function () { t.remove(); }, 220);
    }, opts.duration || 2600);
  }

  /* ---------- Sheet (modal bottom sheet) ---------- */

  let lastFocus = null;

  function sheet(title, contentNodes, opts) {
    opts = opts || {};
    closeSheet();
    lastFocus = document.activeElement;
    const root = document.getElementById("overlay-root");
    const panel = el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": title || "Dialog" }, [
      el("div", { class: "sheet-grip", "aria-hidden": "true" }),
      title ? el("h2", { class: "sheet-title", text: title }) : null
    ].concat(contentNodes));
    const overlay = el("div", {
      class: "overlay",
      onclick: function (e) { if (e.target === overlay) closeSheet(); }
    }, [panel]);
    overlay.dataset.sheet = "1";
    root.appendChild(overlay);

    // focus trap basics
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); closeSheet(); }
      if (e.key === "Tab") {
        const focusables = panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    setTimeout(function () {
      const f = panel.querySelector("input, button, select, textarea");
      if (f) f.focus();
    }, 30);
    return panel;
  }

  function closeSheet() {
    const root = document.getElementById("overlay-root");
    const open = root.querySelector(".overlay");
    if (open) open.remove();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  function confirmSheet(title, message, confirmLabel, onConfirm, danger) {
    const body = [
      el("p", { class: "muted small", text: message }),
      el("div", { class: "mt-6 stack" }, [
        el("button", {
          class: "btn " + (danger ? "btn-danger" : "btn-primary") + " btn-block",
          text: confirmLabel,
          onclick: function () { closeSheet(); onConfirm(); }
        }),
        el("button", { class: "btn btn-ghost btn-block", text: "Cancel", onclick: closeSheet })
      ])
    ];
    sheet(title, body);
  }

  /* ---------- Charts ---------- */

  // Minimal line chart. data: [{label, value}], height in px.
  function lineChart(data, opts) {
    opts = opts || {};
    const h = opts.height || 120;
    const w = 320;
    const pad = { l: 4, r: 4, t: 10, b: 18 };
    if (!data || data.length < 2) {
      return el("div", { class: "chart-empty", text: opts.emptyText || "Not enough data yet" });
    }
    const vals = data.map(function (d) { return d.value; });
    const min = Math.min.apply(null, vals);
    const max = Math.max.apply(null, vals);
    const span = max - min || 1;
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const x = function (i) { return pad.l + (i / (data.length - 1)) * iw; };
    const y = function (v) { return pad.t + ih - ((v - min) / span) * ih; };

    let path = "", area = "";
    data.forEach(function (d, i) {
      const px = x(i), py = y(d.value);
      path += (i === 0 ? "M" : "L") + px.toFixed(1) + " " + py.toFixed(1);
    });
    area = path + "L" + x(data.length - 1).toFixed(1) + " " + (pad.t + ih) + "L" + x(0).toFixed(1) + " " + (pad.t + ih) + "Z";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "chart");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", opts.a11yLabel || "Trend chart");
    svg.style.height = h + "px";
    // Static chart SVG — path/area are computed from numeric data, never from
    // user strings. Gradient IDs are module constants.
    svg.innerHTML =
      '<defs><linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#61EB1A"/><stop offset="100%" stop-color="#61EB1A" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path class="chart-area" d="' + area + '"/>' +
      '<path class="chart-line" d="' + path + '"/>';

    // dots + last-value highlight
    const lastPt = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    lastPt.setAttribute("class", "chart-dot");
    lastPt.setAttribute("cx", x(data.length - 1));
    lastPt.setAttribute("cy", y(data[data.length - 1].value));
    lastPt.setAttribute("r", 3.5);
    svg.appendChild(lastPt);

    if (opts.formatValue && opts.showLast !== false) {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("class", "chart-label");
      t.setAttribute("x", Math.min(x(data.length - 1), w - 8));
      t.setAttribute("y", Math.max(y(data[data.length - 1].value) - 8, 10));
      t.setAttribute("text-anchor", "end");
      t.setAttribute("fill", "#61EB1A");
      t.textContent = opts.formatValue(data[data.length - 1].value);
      svg.appendChild(t);
    }
    return svg;
  }

  function sparkline(data, opts) {
    opts = opts || {};
    const w = 100, h = 28;
    if (!data || data.length < 2) return el("span", { class: "micro muted-2", text: "—" });
    const vals = data.map(function (d) { return d.value !== undefined ? d.value : d; });
    const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    const span = max - min || 1;
    let path = "";
    vals.forEach(function (v, i) {
      const px = (i / (vals.length - 1)) * (w - 4) + 2;
      const py = h - 3 - ((v - min) / span) * (h - 6);
      path += (i === 0 ? "M" : "L") + px.toFixed(1) + " " + py.toFixed(1);
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.style.width = "100%";
    svg.style.height = h + "px";
    // Static sparkline SVG — path is computed from numeric data; color defaults
    // to the accent and is only overridable by the caller with a fixed token.
    svg.innerHTML = '<path fill="none" stroke="' + (opts.color || "#61EB1A") + '" stroke-width="1.8" stroke-linecap="round" d="' + path + '"/>';
    return svg;
  }

  function progressRing(pct, label) {
    const r = 26, c = 2 * Math.PI * r;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ring");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", Math.round(pct * 100) + "% complete" + (label ? " — " + label : ""));
    // Static progress-ring SVG — geometry is computed from a numeric pct; no
    // user strings enter the markup.
    svg.innerHTML =
      '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="#262626" stroke-width="5"/>' +
      '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="#61EB1A" stroke-width="5" stroke-linecap="round" ' +
      'stroke-dasharray="' + (c * pct).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 32 32)"/>';
    return svg;
  }

  // Logo — transparent pill asset, same one used on the web header and in share
  // cards (logo/lmtlss-sharecard-embed.png). Kept consistent with the native
  // screens for the same brand shape / placement.
  const LOGO_SRC = "logo/lmtlss-sharecard-embed.png";

  function logo(size, cls) {
    size = size || 40;
    const img = document.createElement("img");
    img.src = LOGO_SRC;
    img.alt = "LMTLSS";
    img.setAttribute("width", String(size));
    img.setAttribute("height", String(size));
    img.setAttribute("loading", "lazy");
    img.style.display = "block";
    img.style.flex = "0 0 auto";
    if (cls) img.className = cls;
    return img;
  }

  window.UI = {
    el: el,
    frag: frag,
    clear: clear,
    plural: plural,
    icon: icon,
    logo: logo,
    toast: toast,
    sheet: sheet,
    closeSheet: closeSheet,
    confirmSheet: confirmSheet,
    lineChart: lineChart,
    sparkline: sparkline,
    progressRing: progressRing
  };
})();
