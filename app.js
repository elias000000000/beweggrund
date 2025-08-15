/* ==========================================================================
   app.js – Praxis Ildo Fisch
   Ziel: Sanfte, professionelle Interaktionen und Animationen
   Architektur:
   - Utilities (Helper, Easing, Debounce/Throttle)
   - Feature Initializer (Smooth Scroll, ScrollSpy, Observers, Parallax)
   - Form Handling (Kontakt mit mailto)
   - Progressive Enhancements (Lazy-Map, External Links, Debug)
   - Accessibility (prefers-reduced-motion)
   ========================================================================== */

/* ==========================================================================
   0) STRICT MODE
   ========================================================================== */
"use strict";

/* ==========================================================================
   1) UTILITIES
   ========================================================================== */

/**
 * Shorthands for query selectors.
 */
function $(selector, scope) {
  return (scope || document).querySelector(selector);
}
function $all(selector, scope) {
  return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
}

/**
 * Type-safe no-op function for placeholders.
 */
function noop() {}

/**
 * Clamp a numeric value within a min/max range.
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Easing functions – used to make animations feel more natural.
 */
const Easing = {
  easeOutCubic: function (t) {
    return 1 - Math.pow(1 - t, 3);
  },
  easeInOutQuad: function (t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },
  easeOutExpo: function (t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }
};

/**
 * Throttle – ensure a function does not run more often than every N ms.
 */
function throttle(fn, wait) {
  let inThrottle = false;
  let lastArgs = null;

  return function throttled(/* args... */) {
    lastArgs = arguments;
    if (!inThrottle) {
      fn.apply(this, lastArgs);
      inThrottle = true;
      window.setTimeout(function () {
        inThrottle = false;
        if (lastArgs !== null) {
          fn.apply(this, lastArgs);
          lastArgs = null;
        }
      }, wait);
    }
  };
}

/**
 * Debounce – delay execution until N ms have elapsed since last call.
 */
function debounce(fn, wait) {
  let timeoutId = null;
  return function debounced(/* args... */) {
    const context = this;
    const args = arguments;
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(function () {
      fn.apply(context, args);
    }, wait);
  };
}

/**
 * Detect external links (different host).
 */
function isExternalLink(anchor) {
  try {
    const url = new URL(anchor.href, window.location.href);
    return url.host !== window.location.host;
  } catch (err) {
    return false;
  }
}

/**
 * Read boolean dataset prop safely (e.g., data-once="false").
 */
function readBoolDataset(el, key, defaultValue) {
  const raw = el.dataset[key];
  if (raw == null) return defaultValue;
  if (raw === "" || raw === "true") return true;
  if (raw === "false") return false;
  return defaultValue;
}

/**
 * Prefers-reduced-motion media query.
 */
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ==========================================================================
   2) GLOBAL STATE
   ========================================================================== */

const AppState = {
  observers: {
    text: null,
    image: null,
    stagger: null
  },
  scroll: {
    y: 0,
    lastY: 0,
    vh: window.innerHeight,
    ticking: false
  },
  parallax: {
    enabled: true,
    heroBg: null,
    current: 0
  },
  sections: [],
  navLinks: [],
  reduceMotion: prefersReducedMotion()
};

/* ==========================================================================
   3) INTERSECTION OBSERVERS
   ========================================================================== */

/**
 * Create a robust observer with optional rootMargin/threshold.
 */
function createObserver(callback, options) {
  const defaultOptions = {
    root: null,
    rootMargin: "0px 0px -10% 0px",
    threshold: [0, 0.15, 0.35, 0.6, 0.85, 1]
  };
  const opts = Object.assign({}, defaultOptions, options || {});
  try {
    return new IntersectionObserver(callback, opts);
  } catch (err) {
    // Fallback: if IO is not supported, mark everything visible.
    console.warn("IntersectionObserver unsupported, applying fallback:", err);
    return {
      observe: function (el) {
        window.requestAnimationFrame(function () {
          el.classList.add("is-visible");
        });
      },
      unobserve: noop,
      disconnect: noop
    };
  }
}

/**
 * Observe all text elements intended to slide in from the right.
 * Elements must have the class ".animate-slide-right".
 * Optional: data-delay to add animation delay (e.g., "320ms").
 * Optional: data-once="false" to allow re-triggering.
 */
function initTextObserver() {
  AppState.observers.text = createObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      const el = entry.target;
      const revealOnce = readBoolDataset(el, "once", true);

      if (entry.isIntersecting) {
        el.classList.add("is-visible");
        if (revealOnce) {
          observer.unobserve(el);
        }
      } else {
        // If not revealOnce, remove visible to re-trigger on re-entry.
        if (!revealOnce) {
          el.classList.remove("is-visible");
        }
      }
    });
  }, {
    rootMargin: "0px 0px -12% 0px",
    threshold: 0.2
  });

  const textTargets = $all(".animate-slide-right");
  textTargets.forEach(function (node) {
    AppState.observers.text.observe(node);
  });
}

/**
 * Observe all images intended to fade in.
 * Elements must have the class ".animate-fade-in".
 * Images appear a little earlier than text via rootMargin.
 */
function initImageObserver() {
  AppState.observers.image = createObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      const el = entry.target;
      const revealOnce = readBoolDataset(el, "once", true);

      if (entry.isIntersecting) {
        el.classList.add("is-visible");
        // Decode images asap for smooth transition
        if (el.tagName === "IMG" && typeof el.decode === "function") {
          el.decode().catch(noop);
        }
        if (revealOnce) {
          observer.unobserve(el);
        }
      } else {
        if (!revealOnce) {
          el.classList.remove("is-visible");
        }
      }
    });
  }, {
    rootMargin: "0px 0px -6% 0px",
    threshold: 0.12
  });

  const imgTargets = $all(".animate-fade-in, img.fade-in-image");
  imgTargets.forEach(function (node) {
    AppState.observers.image.observe(node);
  });
}

/**
 * Observe containers that should stagger their children.
 * Container must have attribute [data-stagger].
 * CSS übernimmt die Staffelung per nth-child; wir setzen nur .is-visible.
 */
function initStaggerObserver() {
  AppState.observers.stagger = createObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      const el = entry.target;
      const revealOnce = readBoolDataset(el, "once", true);

      if (entry.isIntersecting) {
        el.classList.add("is-visible");
        if (revealOnce) observer.unobserve(el);
      } else {
        if (!revealOnce) el.classList.remove("is-visible");
      }
    });
  }, {
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.15
  });

  const staggerGroups = $all("[data-stagger]");
  staggerGroups.forEach(function (node) {
    AppState.observers.stagger.observe(node);
  });
}

/* ==========================================================================
   4) SMOOTH SCROLL
   ========================================================================== */

/**
 * Attaches smooth scrolling to all anchor links that reference an in-page ID.
 * Honors prefers-reduced-motion.
 */
function initSmoothScroll() {
  const anchors = $all('a[href^="#"]:not([href="#"])');

  anchors.forEach(function (anchor) {
    anchor.addEventListener("click", function (event) {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const id = href.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      event.preventDefault();

      if (AppState.reduceMotion) {
        target.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ==========================================================================
   5) SCROLLSPY (optional – funktioniert nur, wenn es eine Nav mit Links gibt)
   ========================================================================== */

function initScrollSpy() {
  // Suche eine sichtbare Navigationsleiste – falls keine existiert, einfach auslassen
  const nav = $("nav");
  if (!nav) {
    return; // Keine Navigation vorhanden – Feature überspringen
  }

  const links = $all('nav a[href^="#"]:not([href="#"])', nav);
  if (links.length === 0) {
    return;
  }

  AppState.navLinks = links;

  // Liste der Sections aufbauen
  const sections = links
    .map(function (link) {
      const id = (link.getAttribute("href") || "").slice(1);
      const el = document.getElementById(id);
      return el ? { id: id, el: el } : null;
    })
    .filter(Boolean);

  AppState.sections = sections;

  // IntersectionObserver für Sections
  const spyObserver = createObserver(function (entries) {
    entries.forEach(function (entry) {
      const id = entry.target.getAttribute("id");
      if (!id) return;

      const corresponding = links.find(function (l) {
        return (l.getAttribute("href") || "").slice(1) === id;
      });

      if (!corresponding) return;

      if (entry.isIntersecting) {
        links.forEach(function (l) { l.classList.remove("active"); });
        corresponding.classList.add("active");
      }
    });
  }, {
    rootMargin: "-40% 0px -50% 0px",
    threshold: 0.01
  });

  sections.forEach(function (s) {
    spyObserver.observe(s.el);
  });
}

/* ==========================================================================
   6) PARALLAX IM HERO (dezent, professionell)
   ========================================================================== */

function initParallax() {
  const bg = $(".hero-bg");
  if (!bg) {
    AppState.parallax.enabled = false;
    return;
  }
  AppState.parallax.heroBg = bg;

  // Sanfter Tick via requestAnimationFrame
  function updateParallax() {
    AppState.scroll.ticking = false;

    // Faktor: je nach Scrollposition leicht skalieren / verschieben
    // sehr dezent gehalten, damit es professionell bleibt
    const maxTranslate = 18; // px
    const progress = clamp(AppState.scroll.y / (AppState.scroll.vh || 1), 0, 1);
    const eased = Easing.easeOutCubic(progress);
    const translate = lerp(0, maxTranslate, eased);

    // Minimale skalierung, um Kanten zu vermeiden
    const scale = 1.02;

    if (AppState.parallax.enabled && !AppState.reduceMotion) {
      bg.style.transform = "translate3d(0," + translate.toFixed(3) + "px,0) scale(" + scale + ")";
    } else {
      bg.style.transform = "none";
    }
  }

  function onScroll() {
    AppState.scroll.y = window.scrollY || window.pageYOffset || 0;
    if (!AppState.scroll.ticking) {
      AppState.scroll.ticking = true;
      window.requestAnimationFrame(updateParallax);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll(); // Initial
}

/* ==========================================================================
   7) EXTERNE LINKS ABSICHERN
   ========================================================================== */

function initExternalLinks() {
  const anchors = $all("a[href]");
  anchors.forEach(function (a) {
    if (isExternalLink(a)) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
  });
}

/* ==========================================================================
   8) GOOGLE MAP – LAZY LOAD (per data-src)
   ========================================================================== */

function initLazyMap() {
  const map = $("#map-embed");
  if (!map) return;

  // Falls das iframe via data-src konfiguriert wurde, erst bei Sichtbarkeit laden.
  const dataSrc = map.getAttribute("data-src");
  if (!dataSrc) return;

  const mapObserver = createObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        map.setAttribute("src", dataSrc);
        observer.unobserve(map);
      }
    });
  }, {
    rootMargin: "100px 0px",
    threshold: 0.01
  });

  mapObserver.observe(map);
}

/* ==========================================================================
   9) FORM: KONTAKT – VALIDIERUNG + MAILTO-FALLBACK
   ========================================================================== */

function initContactForm() {
  const form = $("#contact-form");
  if (!form) return;

  const nameField = $("#field-name");
  const vornameField = $("#field-vorname");
  const emailField = $("#field-email");
  const datetimeField = $("#field-datetime");
  const msgField = $("#field-message");
  const infoBox = $("#form-info");

  function setInfo(message, type) {
    if (!infoBox) return;
    infoBox.textContent = message;
    infoBox.className = "form-hint " + (type || "");
  }

  function validateEmail(value) {
    // genügsamer Regex, bewusst simpel
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(value).toLowerCase());
  }

  function validateRequired(value) {
    return value != null && String(value).trim().length > 0;
  }

  function buildMailto() {
    const to = "ildo.fisch@beweggrund.li";
    const subject = encodeURIComponent("Terminanfrage über Website – " + (nameField.value || "").trim() + " " + (vornameField.value || "").trim());
    const parts = [];

    parts.push("Name: " + (nameField.value || "").trim());
    parts.push("Vorname: " + (vornameField.value || "").trim());
    parts.push("E-Mail: " + (emailField.value || "").trim());
    if (datetimeField && datetimeField.value) {
      parts.push("Wunschtermin: " + datetimeField.value);
    }
    parts.push("");
    parts.push("Nachricht:");
    parts.push((msgField.value || "").trim());

    const body = encodeURIComponent(parts.join("\n"));
    return "mailto:" + to + "?subject=" + subject + "&body=" + body;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    // Grundvalidierung
    const isNameOk = validateRequired(nameField.value);
    const isVornameOk = validateRequired(vornameField.value);
    const isEmailOk = validateEmail(emailField.value);
    const isMessageOk = validateRequired(msgField.value);

    if (!isNameOk || !isVornameOk || !isEmailOk || !isMessageOk) {
      setInfo("Bitte füllen Sie alle Pflichtfelder korrekt aus (Name, Vorname, gültige E-Mail, Nachricht).", "error");
      return;
    }

    // mailto-URL aufbauen und öffnen
    const mailtoUrl = buildMailto();

    // Schutz vor Popup-Blockern: erst Info, dann navigate
    setInfo("E-Mail-Programm wird geöffnet…", "ok");

    // win.location direkt setzten, damit auch Mobilgeräte es übernehmen
    window.location.href = mailtoUrl;
  });

  // Kleine Live-Validierung
  const liveValidate = debounce(function () {
    if (emailField.value && !validateEmail(emailField.value)) {
      emailField.setCustomValidity("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
    } else {
      emailField.setCustomValidity("");
    }
  }, 180);

  emailField.addEventListener("input", liveValidate);
}

/* ==========================================================================
   10) PAGE REVEAL – HERO CONTENT
   ========================================================================== */

function revealHero() {
  const hero = $(".hero-content");
  if (!hero) return;

  // Kleine Startverzögerung, damit der Hintergrund schon steht
  window.setTimeout(function () {
    hero.classList.add("is-visible");
    // Falls innerhalb des heros bereits animierbare Kindelemente sind:
    const innerAnim = $all(".animate-slide-right, .animate-fade-in", hero);
    innerAnim.forEach(function (el, idx) {
      // Nur falls nicht schon sichtbar
      if (!el.classList.contains("is-visible")) {
        const delayBase = 120 + idx * 80;
        el.style.animationDelay = delayBase + "ms";
        el.classList.add("is-visible");
      }
    });
  }, 150);
}

/* ==========================================================================
   11) AUTO-ANIMATIONSZUWEISUNG (Falls HTML nur Semantik hat)
   ========================================================================== */

function autoAssignAnimationClasses() {
  // Für Bilder, die keine Klasse haben, aber in figure/hero liegen:
  const figures = $all("figure img, .figure img, .image-col img");
  figures.forEach(function (img) {
    if (!img.classList.contains("animate-fade-in")) {
      img.classList.add("animate-fade-in", "delay-1");
    }
  });

  // Für Textblöcke in .text-col die noch keine Klasse haben:
  const textBlocks = $all(".text-col > *:not(figure):not(img)");
  textBlocks.forEach(function (node, index) {
    // Nur elementare Container (p, h2, h3, ul, div)
    if (!node.classList.contains("animate-slide-right")) {
      node.classList.add("animate-slide-right");

      // Texte sollen etwas später erscheinen als Bilder
      // Wir setzen eine Verzögerung je nach Position
      const delayMs = 320 + index * 80;
      node.style.animationDelay = delayMs + "ms";
    }
  });
}

/* ==========================================================================
   12) RESIZE-HANDLING
   ========================================================================== */

function initResizeHandling() {
  const onResize = debounce(function () {
    AppState.scroll.vh = window.innerHeight;
  }, 150);

  window.addEventListener("resize", onResize);
}

/* ==========================================================================
   13) ACCESSIBILITY – REDUCED MOTION
   ========================================================================== */

function initReducedMotionWatcher() {
  try {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = function (ev) {
      AppState.reduceMotion = ev.matches;
      // Bei Reduzierung alle laufenden Effekte zurücksetzen
      if (AppState.reduceMotion) {
        // Parallax stoppen
        if (AppState.parallax.heroBg) {
          AppState.parallax.heroBg.style.transform = "none";
        }
        // Sichtbar schalten, ohne Animationsklassen
        $all(".animate-fade-in, .animate-slide-right, [data-stagger] > *").forEach(function (el) {
          el.classList.add("is-visible");
          el.style.animation = "none";
          el.style.transition = "none";
          el.style.transform = "none";
          el.style.opacity = "1";
        });
      }
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(handler);
    }
  } catch (err) {
    // still fine
  }
}

/* ==========================================================================
   14) DEBUG-TOOLS (optional, nicht invasiv)
   ========================================================================== */

const Debug = {
  showObserverBoxes: false,
  toggleOutlines: function () {
    Debug.showObserverBoxes = !Debug.showObserverBoxes;
    document.documentElement.classList.toggle("debug-outlines", Debug.showObserverBoxes);
  },
  forceRevealAll: function () {
    $all(".animate-fade-in, .animate-slide-right, [data-stagger]").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }
};

// Optionaler Debug-Style bei Bedarf:
(function injectDebugCss() {
  const style = document.createElement("style");
  style.setAttribute("data-debug-style", "true");
  style.textContent =
    ".debug-outlines *{outline:1px dashed rgba(183,200,15,.45)}" +
    ".debug-outlines .hero-section{outline:2px solid rgba(183,200,15,.8)}";
  document.head.appendChild(style);
})();

/* ==========================================================================
   15) INITIALIZE – DOMContentLoaded
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
  // 1) Grundlegendes
  AppState.scroll.vh = window.innerHeight;

  // 2) Progressive Verbesserungen
  initExternalLinks();
  initSmoothScroll();
  initScrollSpy();             // greift nur, wenn Nav existiert
  initParallax();
  initLazyMap();
  initContactForm();
  initResizeHandling();
  initReducedMotionWatcher();

  // 3) Animationen
  //    – zuerst Auto-Klassen setzen, falls im HTML nicht alles markiert wurde
  autoAssignAnimationClasses();

  //    – dann Observer initialisieren
  initImageObserver();         // Bilder zeigen zuerst
  initTextObserver();          // Texte erscheinen etwas später
  initStaggerObserver();       // Gruppen Staffelung

  // 4) Hero sichtbar machen
  revealHero();

  // 5) Global verfügbar machen (z. B. im Dev-Tools)
  window.PraxisApp = {
    state: AppState,
    debug: Debug
  };
});

/* ==========================================================================
   16) SAFETY NET – Falls irgendetwas schiefgeht, hier leise Fehler abfangen
   ========================================================================== */

window.addEventListener("error", function (evt) {
  // Intentionell schlank gehalten; keine Alerts, um UX nicht zu stören.
  // Man könnte hier logging an einen Endpunkt senden.
  // console.error("Global error captured:", evt.message, evt.filename, evt.lineno);
});

window.addEventListener("unhandledrejection", function (evt) {
  // console.error("Unhandled promise rejection:", evt.reason);
});
