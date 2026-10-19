/* LMTLSS share cards — activity → shareable visual.

   Two halves:
   - PURE half (composeCard, trimRoute, projectRoute, escapeXML, toSVG):
     no DOM, no globals beyond Domain formatters — testable in the harness.
   - BROWSER half (renderPreview, exportPNG, shareCard): DOM only, called
     from screens, never from the pure half.

   Honesty rules (same invariant as the app):
   - Cards render ONLY what the session actually recorded. A run without a
     stored route gets a typographic card — never a fabricated map line.
   - Manual/estimated distances keep their provenance label on the card.
   - Route rendering machinery exists (project/trim) and is exercised by
     tests with synthetic fixtures, but stays inert until real GPS data
     lands in sessions. */

(function () {
  "use strict";

  /* ---------- Pure composition ---------- */

  function escapeXML(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  /* Build a card spec from a real logged session. opts: {unit, isPR, achievement} */
  function composeCard(session, opts) {
    opts = opts || {};
    const unit = opts.unit || "metric";
    const stats = [];
    let provenance = null;

    if (session.sport === "running") {
      if (session.distanceM) stats.push({ label: "Distance", value: Domain.fmtDist(session.distanceM, unit) });
      if (session.durationSec) stats.push({ label: "Time", value: Domain.fmtDur(session.durationSec) });
      if (session.distanceM && session.durationSec) {
        stats.push({ label: "Pace", value: Domain.fmtPace(session.durationSec / (session.distanceM / 1000)) + "/km" });
      }
      if (session.distanceSource === "manual" || session.distanceSource === "manual-estimate") {
        provenance = "Distance manually entered — no GPS connected";
      }
    } else if (session.sport === "strength") {
      let volume = 0, sets = 0;
      (session.exercises || []).forEach(function (e) {
        (e.sets || []).forEach(function (st) {
          if (st.done === false) return;
          sets++;
          volume += (st.load || 0) * (st.reps || 0);
        });
      });
      stats.push({ label: "Volume", value: Domain.fmt(volume) + " kg" });
      stats.push({ label: "Sets", value: String(sets) });
      if (session.durationSec) stats.push({ label: "Time", value: Domain.fmtDurHuman(session.durationSec) });
    } else {
      // Sports with their own vocabulary (boxing rounds, golf holes, archery
      // arrows) render exactly the metrics they recorded — nothing invented.
      Domain.activityMetrics(session, unit).forEach(function (m) {
        stats.push({ label: m.label, value: m.value });
      });
      provenance = "Entered manually — not measured";
    }

    return {
      kind: session.sport === "strength" ? "strength" : "run",
      title: session.title || (session.sport === "strength" ? "Strength session" : "Activity"),
      dateLabel: Domain.fmtDateFull(session.startedAt),
      stats: stats,
      provenance: provenance,
      isPR: !!opts.isPR,
      achievement: opts.achievement || null,   // {label} for milestone cards
      route: session.route || null             // [{lat, lon}, ...] when GPS exists
    };
  }

  /* ---------- Route machinery (inert until real GPS data exists) ---------- */

  function haversineM(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  /* Privacy: trim a buffer (meters) off both ends of a route so start/finish
     (typically home) never appear on an exported card. Returns null when too
     few points remain — the card then renders without a route. */
  function trimRoute(coords, bufferM) {
    if (!coords || coords.length < 3) return null;
    const buf = typeof bufferM === "number" ? bufferM : 200;
    let start = 0, end = coords.length - 1;
    let acc = 0;
    while (start < end && acc < buf) { acc += haversineM(coords[start], coords[start + 1]); start++; }
    acc = 0;
    while (end > start && acc < buf) { acc += haversineM(coords[end], coords[end - 1]); end--; }
    if (end - start < 2) return null;
    return coords.slice(start, end + 1);
  }

  /* Equirectangular projection into a w×h box with padding. Returns SVG path
     data plus projected start/end for markers. */
  function projectRoute(coords, w, h, pad) {
    if (!coords || coords.length < 2) return null;
    const p = typeof pad === "number" ? pad : 40;
    const lats = coords.map(function (c) { return c.lat; });
    const lons = coords.map(function (c) { return c.lon; });
    const minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    const minLon = Math.min.apply(null, lons), maxLon = Math.max.apply(null, lons);
    const spanLat = Math.max(maxLat - minLat, 1e-6);
    const spanLon = Math.max(maxLon - minLon, 1e-6);
    const scale = Math.min((w - 2 * p) / spanLon, (h - 2 * p) / spanLat);
    const offX = (w - spanLon * scale) / 2, offY = (h - spanLat * scale) / 2;
    const pts = coords.map(function (c) {
      return {
        x: offX + (c.lon - minLon) * scale,
        y: h - (offY + (c.lat - minLat) * scale)   // flip Y: north up
      };
    });
    const d = pts.map(function (q, i) {
      return (i ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1);
    }).join(" ");
    return { path: d, start: pts[0], end: pts[pts.length - 1] };
  }

  /* ---------- SVG builder (string template; ALL user data escaped) ---------- */

  const W = 1080, H = 1350;

  function toSVG(card, opts) {
    opts = opts || {};
    const accent = "#61EB1A", canvas = "#000000", white = "#FFFFFF", muted = "#A3A3A3", surface = "#111111";
    const parts = [];

    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">');
    parts.push('<rect width="' + W + '" height="' + H + '" fill="' + canvas + '"/>');

    // Wordmark
    parts.push('<text x="80" y="120" font-family="system-ui, sans-serif" font-size="40" font-weight="800" letter-spacing="6" fill="' + white + '">LMTLSS<tspan fill="' + accent + '">.</tspan></text>');

    // Route block — ONLY when real coordinates exist
    const route = card.route ? projectRoute(card.route, W - 160, 560, 40) : null;
    if (route) {
      parts.push('<rect x="80" y="180" width="' + (W - 160) + '" height="560" rx="24" fill="' + surface + '"/>');
      parts.push('<g transform="translate(80,180)">');
      parts.push('<path d="' + route.path + '" fill="none" stroke="' + accent + '" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>');
      parts.push('<circle cx="' + route.start.x.toFixed(1) + '" cy="' + route.start.y.toFixed(1) + '" r="12" fill="' + white + '"/>');
      parts.push('<circle cx="' + route.end.x.toFixed(1) + '" cy="' + route.end.y.toFixed(1) + '" r="14" fill="' + accent + '"/>');
      parts.push('</g>');
    } else if (card.isPR) {
      // Achievement badge replaces the route block on PR cards without routes
      parts.push('<rect x="80" y="180" width="' + (W - 160) + '" height="560" rx="24" fill="' + surface + '"/>');
      parts.push('<text x="' + (W / 2) + '" y="430" text-anchor="middle" font-family="system-ui, sans-serif" font-size="150">🏆</text>');
      parts.push('<text x="' + (W / 2) + '" y="540" text-anchor="middle" font-family="system-ui, sans-serif" font-size="44" font-weight="800" fill="' + accent + '" letter-spacing="4">PERSONAL RECORD</text>');
    } else {
      // Typographic panel — honest empty state, no fabricated map
      parts.push('<rect x="80" y="180" width="' + (W - 160) + '" height="560" rx="24" fill="' + surface + '"/>');
      parts.push('<text x="' + (W / 2) + '" y="470" text-anchor="middle" font-family="system-ui, sans-serif" font-size="200" font-weight="800" fill="' + accent + '">' +
        escapeXML(card.kind === "strength" ? "STRENGTH" : "RUN") + '</text>');
    }

    // Title + date
    parts.push('<text x="80" y="830" font-family="system-ui, sans-serif" font-size="64" font-weight="800" fill="' + white + '">' + escapeXML(card.title) + '</text>');
    parts.push('<text x="80" y="890" font-family="system-ui, sans-serif" font-size="34" fill="' + muted + '">' + escapeXML(card.dateLabel) + '</text>');

    // Stats row
    let x = 80;
    card.stats.slice(0, 3).forEach(function (st) {
      parts.push('<text x="' + x + '" y="1030" font-family="system-ui, sans-serif" font-size="68" font-weight="800" fill="' + white + '">' + escapeXML(st.value) + '</text>');
      parts.push('<text x="' + x + '" y="1080" font-family="system-ui, sans-serif" font-size="28" fill="' + muted + '" letter-spacing="2">' + escapeXML(st.label.toUpperCase()) + '</text>');
      x += Math.floor((W - 160) / Math.min(card.stats.length, 3));
    });

    // Provenance label — always on the card when distance was manual
    if (card.provenance) {
      parts.push('<text x="80" y="1180" font-family="system-ui, sans-serif" font-size="26" fill="' + muted + '">' + escapeXML(card.provenance) + '</text>');
    }
    if (card.achievement && card.achievement.label) {
      parts.push('<text x="80" y="1180" font-family="system-ui, sans-serif" font-size="30" font-weight="700" fill="' + accent + '">' + escapeXML(card.achievement.label) + '</text>');
    }

    // Footer rule + tagline
    parts.push('<rect x="80" y="1240" width="' + (W - 160) + '" height="3" fill="' + accent + '"/>');
    parts.push('<text x="80" y="1300" font-family="system-ui, sans-serif" font-size="28" fill="' + muted + '" letter-spacing="3">YOUR PERFORMANCE. WITHOUT LIMITS.</text>');
    parts.push('</svg>');
    return parts.join("\n");
  }

  /* ---------- Browser half: preview / export / share ---------- */

  function renderPreview(container, svgString) {
    container.innerHTML = svgString;   // static template; user data escaped in toSVG
    const svg = container.querySelector("svg");
    if (svg) { svg.style.width = "100%"; svg.style.height = "auto"; svg.style.borderRadius = "16px"; }
  }

  function svgToPNGBlob(svgString, cb) {
    const img = new Image();
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      canvas.toBlob(function (blob) { cb(blob); }, "image/png");
    };
    img.onerror = function () { cb(null); };
    img.src = url;
  }

  function exportPNG(svgString, filename) {
    svgToPNGBlob(svgString, function (blob) {
      if (!blob) { UI.toast("Couldn't render the card image.", { error: true }); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "lmtlss-card.png";
      a.click();
      URL.revokeObjectURL(url);
      UI.toast("Card saved as PNG.");
    });
  }

  function shareCard(svgString, caption, filename) {
    svgToPNGBlob(svgString, function (blob) {
      if (!blob) { UI.toast("Couldn't render the card image.", { error: true }); return; }
      const file = new File([blob], filename || "lmtlss-card.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text: caption || "" })
          .catch(function (e) { if (e && e.name !== "AbortError") exportPNG(svgString, filename); });
      } else {
        exportPNG(svgString, filename);   // no native share on this platform — save instead, honestly
      }
    });
  }

  window.ShareCards = {
    composeCard: composeCard,
    trimRoute: trimRoute,
    projectRoute: projectRoute,
    haversineM: haversineM,
    escapeXML: escapeXML,
    toSVG: toSVG,
    renderPreview: renderPreview,
    exportPNG: exportPNG,
    shareCard: shareCard,
    WIDTH: W,
    HEIGHT: H
  };
})();
