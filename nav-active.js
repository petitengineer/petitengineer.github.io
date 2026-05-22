/**
 * Highlights Profile on the home page and Projects on the projects page (static, not scroll-based).
 */
(function () {
  const links = document.querySelectorAll(".site-nav [data-nav-section]");
  if (!links.length) return;

  const isProjectsPage = document.body.classList.contains("page-projects");
  const activeSection = isProjectsPage ? "projects" : "profile";

  links.forEach((link) => {
    const match = link.dataset.navSection === activeSection;
    link.classList.toggle("is-active", match);
    if (match) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
})();
