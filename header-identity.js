/**
 * Keeps the header name and domain exactly the same width, with no clipped glyphs.
 */
(function () {
  const ROOT = ".site-header__identity";

  function measureWidth(el) {
    return Math.ceil(el.getBoundingClientRect().width);
  }

  function resetInline(el) {
    el.style.width = "";
    el.style.letterSpacing = "";
  }

  /** Spread extra horizontal space across characters (single-line labels). */
  function stretchToWidth(el, targetPx) {
    el.style.letterSpacing = "0px";
    let w = measureWidth(el);
    if (w >= targetPx) return;

    const chars = (el.textContent || "").trim().length;
    if (chars <= 1) return;

    const gap = (targetPx - w) / (chars - 1);
    el.style.letterSpacing = `${gap}px`;
  }

  function syncIdentity(identity) {
    const brand = identity.querySelector(".brand");
    const name = identity.querySelector(".site-header__name");
    if (!brand || !name) return;

    resetInline(brand);
    resetInline(name);

    const brandW = measureWidth(brand);
    const nameW = measureWidth(name);
    let targetW = Math.max(brandW, nameW);

    brand.style.width = `${targetW}px`;
    name.style.width = `${targetW}px`;

    stretchToWidth(brand, targetW);

    if (name.scrollWidth > name.clientWidth + 1) {
      targetW = name.scrollWidth;
      brand.style.width = `${targetW}px`;
      name.style.width = `${targetW}px`;
      stretchToWidth(brand, targetW);
    }
  }

  function syncAll() {
    document.querySelectorAll(ROOT).forEach(syncIdentity);
  }

  function init() {
    syncAll();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(syncAll);
      document.querySelectorAll(`${ROOT} .brand, ${ROOT} .site-header__name`).forEach((el) =>
        observer.observe(el)
      );
    }

    window.addEventListener("resize", syncAll);
    document.fonts?.ready?.then(syncAll);

    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => requestAnimationFrame(syncAll));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
