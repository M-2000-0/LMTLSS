/* LMTLSS app — navigation, routing, boot. */

(function () {
  "use strict";

  const el = UI.el;

  const TABS = [
    { id: "home", label: "Home", icon: "home" },
    { id: "train", label: "Train", icon: "train" },
    { id: "progress", label: "Progress", icon: "progress" },
    { id: "coach", label: "Coach", icon: "coach" },
    { id: "profile", label: "Profile", icon: "profile" }
  ];

  const SCREENS = {
    home: function () { return window.HomeScreen; },
    train: function () { return window.TrainScreen; },
    progress: function () { return window.ProgressScreen; },
    coach: function () { return window.CoachScreen; },
    profile: function () { return window.ProfileScreen; }
  };

  let currentTab = "home";
  let mainEl = null;
  let navEl = null;

  function go(tab, params) {
    if (!SCREENS[tab]) tab = "home";
    if (currentTab === "train" && tab !== "train" && window.TrainScreen.teardown) {
      window.TrainScreen.teardown();
    }
    currentTab = tab;
    renderNav();
    renderScreen(params || {});
    // move focus for screen-reader users without scrolling weirdly
    mainEl.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function rerender() {
    renderScreen({});
  }

  function renderScreen(params) {
    const builder = SCREENS[currentTab];
    if (builder() && builder().render) {
      builder().render(mainEl, { go: go }, params);
    }
  }

  function renderNav() {
    UI.clear(navEl);
    TABS.forEach(function (t) {
      const btn = el("button", {
        class: "nav-item",
        "aria-current": currentTab === t.id ? "page" : null,
        onclick: function () { go(t.id); }
      }, [
        UI.icon(t.icon),
        el("span", { text: t.label }),
        el("span", { class: "nav-dot", "aria-hidden": "true" })
      ]);
      navEl.appendChild(btn);
    });
  }

  /* ---------- Boot ---------- */

  function boot() {
    mainEl = document.getElementById("main");
    navEl = document.getElementById("bottom-nav");
    const state = Store.get();

    if (!state.profile) {
      showWelcome();
      return;
    }

    // restore an in-flight session if one was saved
    renderNav();
    go(state.activeSession ? "train" : "home");
  }

  function showWelcome() {
    UI.clear(navEl);
    navEl.style.display = "none";
    UI.clear(mainEl);

    const wrap = el("div", { class: "onboarding" }, [
      el("div", { class: "onboarding-top" }, [
        el("span", { class: "wordmark" }, ["LMTLSS", el("span", { class: "dot", text: "." })])
      ]),
      el("div", { class: "onboarding-body", style: "display:flex;flex-direction:column;justify-content:center" }, [
        el("p", { class: "eyebrow accent", text: "Your performance. Without limits." }),
        el("h1", { style: "font-size:var(--fs-hero);font-weight:800;letter-spacing:-0.03em;line-height:1.02;margin-top:12px" }, [
          "The operating system ",
          el("br"), "for human performance."
        ]),
        el("p", { class: "lede mt-4", text: "One place to train, understand your performance, and improve across sports. Strength and running to start — built on an architecture that scales to everything else." }),
        el("div", { class: "stack mt-8" }, [
          el("button", {
            class: "btn btn-primary btn-lg btn-block",
            onclick: function () { startFresh(); }
          }, ["Set up my profile", UI.icon("chevron")]),
          el("button", {
            class: "btn btn-secondary btn-block",
            onclick: function () {
              Store.seedDemo();
              navEl.style.display = "";
              UI.toast("Loaded 10 weeks of clearly-labeled demo data. Delete it any time in Profile.");
              go("home");
            }
          }, ["Explore with demo data"])
        ]),
        el("p", { class: "micro muted-2 mt-6", text: "Everything stays on this device. No account, no tracking." })
      ])
    ]);
    mainEl.appendChild(wrap);
  }

  function startFresh() {
    navEl.style.display = "";
    UI.clear(mainEl);
    Onboarding.run(mainEl, function () {
      renderNav();
      go("home");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.App = { go: go, rerender: rerender };
})();
