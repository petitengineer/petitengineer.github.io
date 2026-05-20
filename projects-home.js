/**
 * Populates the home page project grid and handles terminal goto navigation to projects.
 */
(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  async function renderHomeProjectGrid() {
    const grid = document.getElementById("project-grid");
    if (!grid || !window.ProjectsRegistry) return;

    try {
      const projects = await window.ProjectsRegistry.loadProjectsSorted();
      if (!projects.length) return;

      grid.innerHTML = projects
        .map((p) => {
          const href = `projects.html#${encodeURIComponent(p.slug)}`;
          const thumb = p.thumb ? escapeAttr(p.thumb) : "./assets/project-placeholder-1.svg";
          const title = escapeHtml(p.title);
          const tagline = p.tagline
            ? `<span class="project-card__tagline">${escapeHtml(p.tagline)}</span>`
            : "";
          return `<li>
            <a class="project-card" href="${href}" data-project-slug="${escapeAttr(p.slug)}" aria-label="${title}">
              <img src="${thumb}" alt="" width="640" height="360" loading="lazy" />
              <span class="project-card__body">
                <span class="project-card__title">${title}</span>
                ${tagline}
              </span>
            </a>
          </li>`;
        })
        .join("");
    } catch (err) {
      console.warn("Could not load project manifest:", err);
    }
  }

  function initProjectCardNavigation() {
    const grid = document.getElementById("project-grid");
    if (!grid) return;

    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".project-card");
      if (!card) return;

      const slug = card.getAttribute("data-project-slug");
      const href = card.getAttribute("href");
      if (!slug || !href) return;

      e.preventDefault();

      if (typeof window.isTerminalDismissed === "function" && window.isTerminalDismissed()) {
        window.location.href = href;
        return;
      }

      if (typeof window.navigateToProject === "function") {
        window.navigateToProject(slug, href);
      } else {
        window.location.href = href;
      }
    });
  }

  function boot() {
    renderHomeProjectGrid();
    initProjectCardNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
