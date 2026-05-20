/**
 * Loads project metadata from dated HTML fragments listed in projects/manifest.json.
 * Sorts by data-date (newest first) for the home grid and projects page order.
 */
(function () {
  const MANIFEST_URL = "projects/manifest.json";

  /**
   * @param {string} pagePath
   * @returns {Promise<Record<string, string>>}
   */
  async function loadProjectMeta(pagePath) {
    const res = await fetch(pagePath);
    if (!res.ok) {
      throw new Error(`Failed to load ${pagePath}: ${res.status}`);
    }
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const section = doc.querySelector(".project-detail");
    if (!section) {
      throw new Error(`No .project-detail in ${pagePath}`);
    }
    const ds = section.dataset;
    return {
      date: ds.date || "",
      slug: ds.slug || "",
      title: ds.title || "Untitled project",
      tagline: ds.tagline || "",
      thumb: ds.thumb || "",
      command: ds.command || "",
      page: pagePath,
      sectionId: section.id || `project-${ds.slug}`,
    };
  }

  /** @returns {Promise<Array<Record<string, string>>>} */
  async function loadProjectsSorted() {
    const manifestRes = await fetch(MANIFEST_URL);
    if (!manifestRes.ok) {
      throw new Error(`Failed to load manifest: ${manifestRes.status}`);
    }
    const manifest = await manifestRes.json();
    const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
    const projects = await Promise.all(pages.map((page) => loadProjectMeta(page)));
    projects.sort((a, b) => b.date.localeCompare(a.date));
    return projects;
  }

  window.ProjectsRegistry = {
    loadProjectsSorted,
    loadProjectMeta,
  };
})();
