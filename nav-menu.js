/**
 * Mobile hamburger menu: open/close panel, backdrop, tap-outside, escape.
 */
(function () {
  const nav = document.querySelector(".site-nav");
  const toggle = document.getElementById("nav-menu-toggle");
  const panel = document.getElementById("site-nav-panel");
  const backdrop = document.querySelector("[data-nav-backdrop]");

  if (!nav || !toggle || !panel) return;

  const mobileMq = window.matchMedia("(max-width: 768px)");
  const navHome = nav;

  function isMobile() {
    return mobileMq.matches;
  }

  function isOpen() {
    return nav.classList.contains("is-open");
  }

  function setBackdropVisible(visible) {
    if (!backdrop) return;
    if (visible) {
      document.body.appendChild(backdrop);
      backdrop.hidden = false;
    } else {
      backdrop.hidden = true;
      if (backdrop.parentNode === document.body) {
        navHome.appendChild(backdrop);
      }
    }
  }

  function closeMenu() {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-menu-open");
    setBackdropVisible(false);
  }

  function openMenu() {
    if (!isMobile()) return;
    nav.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("nav-menu-open");
    setBackdropVisible(true);
  }

  function isInsideMenu(target) {
    if (!(target instanceof Node)) return false;
    return panel.contains(target) || toggle.contains(target);
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!isMobile()) return;
    if (isOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  backdrop?.addEventListener("click", (e) => {
    e.preventDefault();
    closeMenu();
  });

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!isMobile() || !isOpen()) return;
      if (isInsideMenu(e.target)) return;
      closeMenu();
    },
    true
  );

  panel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (isMobile()) closeMenu();
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      closeMenu();
    }
  });

  mobileMq.addEventListener("change", () => {
    if (!isMobile()) closeMenu();
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) closeMenu();
  });
})();
