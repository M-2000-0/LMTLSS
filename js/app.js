/* LMTLSS app — navigation, routing, boot. */

(function () {
  "use strict";

  const el = UI.el;

  const TABS = [
    { id: "home", label: "Home", icon: "home" },
    { id: "train", label: "Train", icon: "train" },
    { id: "recover", label: "Recover", icon: "heart" },
    { id: "fuel", label: "Fuel", icon: "drop" },
    { id: "progress", label: "Progress", icon: "progress" },
    { id: "coach", label: "Coach", icon: "coach" },
    { id: "profile", label: "Profile", icon: "profile" }
  ];

  const SCREENS = {
    home: function () { return window.HomeScreen; },
    train: function () { return window.TrainScreen; },
    recover: function () { return window.RecoverScreen; },
    fuel: function () { return window.FuelScreen; },
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

  function bootFromRestore(target) {
    renderNav();
    go(target || (state.activeSession ? "train" : "home"));
  }

  function showWelcome() {
    UI.clear(navEl);
    navEl.style.display = "none";
    UI.clear(mainEl);

    const wrap = el("div", { class: "landing" }, [
      el("nav", { class: "landing-nav" }, [
        el("div", { class: "landing-nav-inner" }, [
          el("div", { class: "landing-brand" }, [
            el("img", {
              src: "logo/image-removebg-preview.png",
              alt: "LMTLSS",
              width: "40",
              height: "40"
            }),
            el("span", { class: "landing-brand-text" }, ["LMTLSS"])
          ]),
          el("div", { class: "landing-nav-links", id: "landing-nav-links" }, [
            el("a", { href: "#platform", text: "Platform" }),
            el("a", { href: "#sports", text: "Sports" }),
            el("a", { href: "#community", text: "Community" }),
            el("a", { href: "#progress", text: "How it works" })
          ]),
          el("button", {
            class: "landing-cta-nav",
            onclick: function () { startFresh(); },
            "aria-label": "Get early access"
          }, ["Get early access"]),
          el("button", {
            class: "landing-nav-menu",
            "aria-label": "Open menu",
            onclick: function() {
              const menu = document.getElementById('landing-mobile-menu');
              if (menu) menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
            }
          }, ["☰"])
        ]),
        el("div", { id: "landing-mobile-menu", class: "landing-mobile-menu" }, [
          el("a", { href: "#platform", text: "Platform", onclick: function(){ document.getElementById('landing-mobile-menu').style.display='none'; } }),
          el("a", { href: "#sports", text: "Sports", onclick: function(){ document.getElementById('landing-mobile-menu').style.display='none'; } }),
          el("a", { href: "#community", text: "Community", onclick: function(){ document.getElementById('landing-mobile-menu').style.display='none'; } }),
          el("a", { href: "#progress", text: "How it works", onclick: function(){ document.getElementById('landing-mobile-menu').style.display='none'; } }),
          el("button", { onclick: function(){ document.getElementById('landing-mobile-menu').style.display='none'; startFresh(); } }, ["Get early access"])
        ])
      ]),
      el("section", { class: "landing-hero" }, [
        el("div", { class: "landing-hero-inner" }, [
          el("div", { class: "landing-hero-content" }, [
            el("p", { class: "landing-eyebrow", text: "YOUR SPORT. YOUR PEOPLE. YOUR NEXT LEVEL." }),
            el("h1", { class: "landing-hero-title" }, [
              "Your athletic life.",
              el("br"),
              "One platform."
            ]),
            el("p", { class: "landing-hero-subtitle" }, [
              "One platform for the way you move. Track your activity, build consistency, share your progress, and connect with a community that keeps you moving."
            ]),
            el("div", { class: "landing-hero-actions" }, [
              el("button", {
                class: "landing-btn landing-btn-primary",
                onclick: function () { startFresh(); }
              }, ["Get early access ↗"]),
              el("button", {
                class: "landing-btn landing-btn-secondary",
                onclick: function () {
                  document.getElementById('platform').scrollIntoView({ behavior: 'smooth' });
                }
              }, ["Explore the platform"])
            ])
          ]),
          el("div", { class: "landing-hero-visual" }, [
            el("div", { class: "landing-phone-stack" }, [
              el("div", { class: "landing-phone landing-phone-1" }, [
                el("div", { class: "landing-phone-screen" }, [
                  el("div", { style: "padding:16px;color:#fff" }, [
                    el("div", { style: "font-size:9px;color:#a3a3a3;margin-bottom:8px;letter-spacing:0.1em" }, ["TODAY"]),
                    el("div", { style: "font-size:16px;font-weight:700;margin-bottom:4px" }, ["Upper Body Strength"]),
                    el("div", { style: "font-size:10px;color:#a3a3a3" }, ["45 min • 6 exercises"])
                  ])
                ])
              ]),
              el("div", { class: "landing-phone landing-phone-2" }, [
                el("div", { class: "landing-phone-screen" }, [
                  el("div", { style: "padding:16px;color:#fff" }, [
                    el("div", { style: "font-size:9px;color:#a3a3a3;margin-bottom:8px;letter-spacing:0.1em" }, ["ACTIVITY"]),
                    el("div", { style: "font-size:24px;font-weight:800;color:#61EB1A" }, ["5.21 mi"]),
                    el("div", { style: "font-size:11px;color:#a3a3a3;margin-top:4px" }, ["42:18 • 8:07/mi"])
                  ])
                ])
              ]),
              el("div", { class: "landing-phone landing-phone-3" }, [
                el("div", { class: "landing-phone-screen" }, [
                  el("div", { style: "padding:16px;color:#fff" }, [
                    el("div", { style: "font-size:9px;color:#a3a3a3;margin-bottom:8px;letter-spacing:0.1em" }, ["PROFILE"]),
                    el("div", { style: "font-size:15px;font-weight:700" }, ["Your Progress"]),
                    el("div", { style: "height:4px;background:#262626;border-radius:2px;margin-top:12px" }, [
                      el("div", { style: "height:4px;background:#61EB1A;border-radius:2px;width:68%" })
                    ]),
                    el("div", { style: "font-size:9px;color:#a3a3a3;margin-top:6px" }, ["12 week streak"])
                  ])
                ])
              ])
            ])
          ])
        ])
      ]),
      el("section", { id: "platform", class: "landing-section" }, [
        el("div", { class: "landing-section-inner" }, [
          el("div", { class: "landing-section-header" }, [
            el("h2", { class: "landing-section-title" }, ["One athletic identity. Every way you move."]),
            el("p", { class: "landing-section-subtitle" }, ["Your activities and training history, personal progress, community and sports connections, challenges and goals — all in one connected experience."])
          ]),
          el("div", { class: "landing-features-grid" }, [
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Activity tracking"]),
              el("p", { class: "landing-feature-desc" }, ["Strength training and running with real logging, history, and performance metrics."])
            ]),
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Personal performance"]),
              el("p", { class: "landing-feature-desc" }, ["Track progress over time with milestones, PRs, and insights from your own data."])
            ]),
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Social sharing"]),
              el("p", { class: "landing-feature-desc" }, ["Turn sessions into polished, shareable recaps with maps and stats."])
            ]),
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Community & goals"]),
              el("p", { class: "landing-feature-desc" }, ["Connect with others, build consistency, and chase goals together."])
            ])
          ])
        ])
      ]),
      el("section", { class: "landing-section landing-section-alt" }, [
        el("div", { class: "landing-section-inner" }, [
          el("div", { class: "landing-section-header" }, [
            el("h2", { class: "landing-section-title" }, ["Your work deserves to be seen."]),
            el("p", { class: "landing-section-subtitle" }, ["Complete an activity, review your progress, create a beautiful recap, and share it with your people."])
          ]),
          el("div", { class: "landing-share-demo" }, [
            el("div", { class: "landing-share-card" }, [
              el("div", { style: "padding:24px;color:#fff" }, [
                el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:18px" }, [
                  el("img", { src: "logo/image-removebg-preview.png", alt: "LMTLSS", width: "36", height: "36" }),
                  el("span", { style: "font-weight:700;letter-spacing:-0.01em" }, ["LMTLSS"])
                ]),
                el("div", { style: "font-size:32px;font-weight:800;color:#61EB1A;margin-bottom:6px;letter-spacing:-0.02em" }, ["5.21 mi"]),
                el("div", { style: "font-size:14px;color:#a3a3a3;margin-bottom:18px" }, ["42:18 • 8:07/mi • +47 m elevation"]),
                el("div", { style: "height:90px;background:radial-gradient(circle at 30% 50%, #1a1a1a 0%, #0a0a0a 100%);border-radius:10px;border:1px solid #262626" })
              ])
            ])
          ]),
          el("div", { style: "text-align:center;margin-top:20px" }, [
            el("span", { style: "font-size:12px;color:var(--text-muted)" }, ["Activity sharing — available in the app"])
          ])
        ])
      ]),
      el("section", { id: "sports", class: "landing-section" }, [
        el("div", { class: "landing-section-inner" }, [
          el("div", { class: "landing-section-header" }, [
            el("h2", { class: "landing-section-title" }, ["Built around sport. Not just one sport."]),
            el("p", { class: "landing-section-subtitle" }, ["LMTLSS connects strength, running, and more through activity tracking, progress, social features, and community."])
          ]),
          el("div", { class: "landing-sports-grid" }, [
            ["Running", "🏃"], ["Strength Training", "💪"], ["Cycling", "🚴"], ["Basketball", "🏀"], 
            ["Martial Arts", "🥋"], ["Swimming", "🏊"], ["Hiking", "🥾"], ["More Sports", "⚡"]
          ].map(function(sport) {
            return el("div", { class: "landing-sport-tile" }, [
              el("div", { style: "font-size:26px;margin-bottom:10px" }, [sport[1]]),
              el("div", { style: "font-weight:600;font-size:15px" }, [sport[0]])
            ]);
          })
        ])
      ]),
      el("section", { id: "progress", class: "landing-section landing-section-alt" }, [
        el("div", { class: "landing-section-inner" }, [
          el("div", { class: "landing-section-header" }, [
            el("h2", { class: "landing-section-title" }, ["Show up. Build momentum. Keep going."]),
            el("p", { class: "landing-section-subtitle" }, ["Track your training history, milestones, and consistency over time. Progress rewards showing up — without punishing rest or recovery."])
          ]),
          el("div", { class: "landing-features-grid" }, [
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Training history"]),
              el("p", { class: "landing-feature-desc" }, ["Every session logged and visible in your timeline."])
            ]),
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Milestones & PRs"]),
              el("p", { class: "landing-feature-desc" }, ["Personal records and key achievements tracked over time."])
            ]),
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Consistency"]),
              el("p", { class: "landing-feature-desc" }, ["Build momentum with a focus on showing up, not perfection."])
            ])
          ])
        ])
      ]),
      el("section", { id: "community", class: "landing-section" }, [
        el("div", { class: "landing-section-inner" }, [
          el("div", { class: "landing-section-header" }, [
            el("h2", { class: "landing-section-title" }, ["Better together. Stronger on your own terms."]),
            el("p", { class: "landing-section-subtitle" }, ["Sport can be individual, but progress doesn't have to happen in isolation."])
          ]),
          el("div", { class: "landing-community-text" }, [
            el("p", { style: "color:#a3a3a3;max-width:700px;margin:0 auto;text-align:center;line-height:1.8;font-size:17px" }, [
              "Connect with friends, follow activities, celebrate achievements, and find people who share your interests. Build consistency together on your terms."
            ])
          ]),
          el("div", { style: "text-align:center;margin-top:16px" }, [
            el("span", { style: "font-size:12px;color:var(--text-muted)" }, ["Social features available in the app"])
          ])
        ])
      ]),
      el("section", { class: "landing-section landing-section-alt" }, [
        el("div", { class: "landing-section-inner" }, [
          el("div", { class: "landing-section-header" }, [
            el("h2", { class: "landing-section-title" }, ["Your performance, connected."]),
            el("p", { class: "landing-section-subtitle" }, ["Track your way — manual entry and GPS tracking are available. More connections coming as they're built and tested."])
          ]),
          el("div", { class: "landing-features-grid" }, [
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["GPS Runs"]),
              el("p", { class: "landing-feature-desc" }, ["Record distance, time, pace, and route with shareable cards."])
            ]),
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Strength Logging"]),
              el("p", { class: "landing-feature-desc" }, ["Log sets, reps, and loads with a clean training experience."])
            ]),
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Local-first"]),
              el("p", { class: "landing-feature-desc" }, ["Your data stays on your device. Privacy-first by design."])
            ])
          ])
        ])
      ]),
      el("section", { class: "landing-cta" }, [
        el("div", { class: "landing-cta-inner" }, [
          el("h2", { class: "landing-cta-title" }, ["There is no finish line."]),
          el("p", { class: "landing-cta-subtitle" }, ["Wherever you start, whatever your sport, your next level is yours to build."]),
          el("button", {
            class: "landing-btn landing-btn-primary landing-btn-large",
            onclick: function () { startFresh(); }
          }, ["Join LMTLSS"]),
          el("button", {
            class: "landing-btn landing-btn-secondary landing-btn-large",
            style: "margin-left:12px",
            onclick: function () { 
              window.location.href = 'download.html';
            }
          }, ["Download App"])
        ])
      ]),
      el("footer", { class: "landing-footer" }, [
        el("div", { class: "landing-footer-inner" }, [
          el("div", { class: "landing-footer-brand" }, [
            el("img", { src: "logo/image-removebg-preview.png", alt: "LMTLSS", width: "32", height: "32" }),
            el("span", { style: "font-weight:700;margin-left:10px;font-size:16px" }, ["LMTLSS"])
          ]),
          el("div", { class: "landing-footer-links" }, [
            el("a", { href: "download.html", text: "Download" }),
            el("a", { href: "index.html", text: "Web App" }),
            el("a", { href: "#", text: "Privacy" }),
            el("a", { href: "#", text: "Terms" })
          ]),
          el("p", { class: "landing-footer-copy" }, ["© 2026 LMTLSS. All rights reserved."])
        ])
      ])
    ]);
    mainEl.appendChild(wrap);
  }
      el("section", { class: "landing-hero" }, [
        el("div", { class: "landing-hero-inner" }, [
          el("div", { class: "landing-hero-content" }, [
            el("p", { class: "landing-eyebrow", text: "YOUR SPORT. YOUR PEOPLE. YOUR NEXT LEVEL." }),
            el("h1", { class: "landing-hero-title" }, [
              "Your athletic life.",
              el("br"),
              "One platform."
            ]),
            el("p", { class: "landing-hero-subtitle" }, [
              "Every session moves you forward. LMTLSS brings your training, progress, and sports community together in one place across strength, running, and more."
            ]),
            el("div", { class: "landing-hero-actions" }, [
              el("button", {
                class: "landing-btn landing-btn-primary",
                onclick: function () { startFresh(); }
              }, ["Get early access ↗"]),
              el("button", {
                class: "landing-btn landing-btn-secondary",
                onclick: function () {
                  document.getElementById('platform').scrollIntoView({ behavior: 'smooth' });
                }
              }, ["Explore the platform"])
            ])
          ]),
          el("div", { class: "landing-hero-visual" }, [
            el("div", { class: "landing-phone-stack" }, [
              el("div", { class: "landing-phone landing-phone-1" }, [
                el("div", { class: "landing-phone-screen" }, [
                  el("div", { style: "padding:16px;color:#fff" }, [
                    el("div", { style: "font-size:10px;color:#a3a3a3;margin-bottom:8px" }, ["TODAY"]),
                    el("div", { style: "font-size:18px;font-weight:700;margin-bottom:4px" }, ["Upper Body Strength"]),
                    el("div", { style: "font-size:11px;color:#a3a3a3" }, ["45 min • 6 exercises"])
                  ])
                ])
              ]),
              el("div", { class: "landing-phone landing-phone-2" }, [
                el("div", { class: "landing-phone-screen" }, [
                  el("div", { style: "padding:16px;color:#fff" }, [
                    el("div", { style: "font-size:10px;color:#a3a3a3;margin-bottom:8px" }, ["ACTIVITY"]),
                    el("div", { style: "font-size:22px;font-weight:700;color:#61EB1A" }, ["5.2 mi"]),
                    el("div", { style: "font-size:12px;color:#a3a3a3;margin-top:4px" }, ["42:18 • 8:07/mi"])
                  ])
                ])
              ]),
              el("div", { class: "landing-phone landing-phone-3" }, [
                el("div", { class: "landing-phone-screen" }, [
                  el("div", { style: "padding:16px;color:#fff" }, [
                    el("div", { style: "font-size:10px;color:#a3a3a3;margin-bottom:8px" }, ["PROFILE"]),
                    el("div", { style: "font-size:16px;font-weight:700" }, ["Your Progress"]),
                    el("div", { style: "height:4px;background:#262626;border-radius:2px;margin-top:12px" }, [
                      el("div", { style: "height:4px;background:#61EB1A;border-radius:2px;width:65%" })
                    ])
                  ])
                ])
              ])
            ])
          ])
        ])
      ]),
      el("section", { id: "platform", class: "landing-section" }, [
        el("div", { class: "landing-section-inner" }, [
          el("div", { class: "landing-section-header" }, [
            el("h2", { class: "landing-section-title" }, ["One athletic identity. Every way you move."]),
            el("p", { class: "landing-section-subtitle" }, ["Your activities, training history, progress, and community — all connected in one place."])
          ]),
          el("div", { class: "landing-features-grid" }, [
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Train"]),
              el("p", { class: "landing-feature-desc" }, ["Strength sessions, running, and more. Log every set, track every mile."])
            ]),
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Track"]),
              el("p", { class: "landing-feature-desc" }, ["Performance metrics, personal records, and progress over time."])
            ]),
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Share"]),
              el("p", { class: "landing-feature-desc" }, ["Turn every session into a polished recap worth sharing."])
            ]),
            el("div", { class: "landing-feature-card" }, [
              el("h3", { class: "landing-feature-title" }, ["Connect"]),
              el("p", { class: "landing-feature-desc" }, ["Find your people. Celebrate achievements together."])
            ])
          ])
        ])
      ]),
      el("section", { class: "landing-section landing-section-alt" }, [
        el("div", { class: "landing-section-inner" }, [
          el("div", { class: "landing-section-header" }, [
            el("h2", { class: "landing-section-title" }, ["Your work deserves to be seen."]),
            el("p", { class: "landing-section-subtitle" }, ["Complete an activity, review your progress, create a beautiful recap, and share it with your people."])
          ]),
          el("div", { class: "landing-share-demo" }, [
            el("div", { class: "landing-share-card" }, [
              el("div", { style: "padding:20px;color:#fff" }, [
                el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:16px" }, [
                  el("img", { src: "logo/image-removebg-preview.png", alt: "LMTLSS", width: "32", height: "32" }),
                  el("span", { style: "font-weight:700" }, ["LMTLSS"])
                ]),
                el("div", { style: "font-size:28px;font-weight:800;color:#61EB1A;margin-bottom:4px" }, ["5.21 mi"]),
                el("div", { style: "font-size:14px;color:#a3a3a3;margin-bottom:16px" }, ["42:18 • 8:07/mi • +47m"]),
                el("div", { style: "height:80px;background:linear-gradient(90deg, #262626 0%, #1a1a1a 100%);border-radius:8px" })
              ])
            ])
          ])
        ])
      ]),
      el("section", { id: "sports", class: "landing-section" }, [
        el("div", { class: "landing-section-inner" }, [
          el("div", { class: "landing-section-header" }, [
            el("h2", { class: "landing-section-title" }, ["Built around sport. Not just one sport."]),
            el("p", { class: "landing-section-subtitle" }, ["From strength training to running and beyond. Your entire athletic life in one place."])
          ]),
          el("div", { class: "landing-sports-grid" }, [
            ["Running", "🏃"], ["Strength", "💪"], ["Cycling", "🚴"], ["Basketball", "🏀"], 
            ["Martial Arts", "🥋"], ["Swimming", "🏊"], ["Hiking", "🥾"], ["More", "➕"]
          ].map(function(sport) {
            return el("div", { class: "landing-sport-tile" }, [
              el("div", { style: "font-size:24px;margin-bottom:8px" }, [sport[1]]),
              el("div", { style: "font-weight:600" }, [sport[0]])
            ]);
          })
        ])
      ]),
      el("section", { id: "community", class: "landing-section landing-section-alt" }, [
        el("div", { class: "landing-section-inner" }, [
          el("div", { class: "landing-section-header" }, [
            el("h2", { class: "landing-section-title" }, ["Better together. Stronger on your own terms."]),
            el("p", { class: "landing-section-subtitle" }, ["Sport can be individual, but progress doesn't have to happen in isolation."])
          ]),
          el("div", { class: "landing-community-text" }, [
            el("p", { style: "color:#a3a3a3;max-width:600px;margin:0 auto;text-align:center;line-height:1.7" }, [
              "Connect with friends, follow activities, celebrate achievements, and find people who share your passion. Build consistency together without the pressure of a gym class."
            ])
          ])
        ])
      ]),
      el("section", { id: "start", class: "landing-cta" }, [
        el("div", { class: "landing-cta-inner" }, [
          el("h2", { class: "landing-cta-title" }, ["There is no finish line."]),
          el("p", { class: "landing-cta-subtitle" }, ["Wherever you start, whatever your sport, your next level is yours to build."]),
          el("button", {
            class: "landing-btn landing-btn-primary landing-btn-large",
            onclick: function () { startFresh(); }
          }, ["Join LMTLSS"]),
          el("button", {
            class: "landing-btn landing-btn-secondary landing-btn-large",
            style: "margin-left:12px",
            onclick: function () { 
              window.location.href = 'download.html';
            }
          }, ["Download App"])
        ])
      ]),
      el("footer", { class: "landing-footer" }, [
        el("div", { class: "landing-footer-inner" }, [
          el("div", { class: "landing-footer-brand" }, [
            el("img", { src: "logo/image-removebg-preview.png", alt: "LMTLSS", width: "32", height: "32" }),
            el("span", { style: "font-weight:700;margin-left:8px" }, ["LMTLSS"])
          ]),
          el("div", { class: "landing-footer-links" }, [
            el("a", { href: "download.html", text: "Download" }),
            el("a", { href: "#", text: "Privacy" }),
            el("a", { href: "#", text: "Terms" })
          ]),
          el("p", { class: "landing-footer-copy" }, ["© 2026 LMTLSS. All rights reserved."])
        ])
      ])
    ]);
    mainEl.appendChild(wrap);
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
