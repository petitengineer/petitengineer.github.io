(function () {
  const html = document.documentElement;
  const THEME_KEY = "petitengineer-theme";

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  }

  function applyTheme(theme) {
    html.setAttribute("data-theme", theme === "light" ? "light" : "dark");
    try {
      localStorage.setItem(THEME_KEY, theme === "light" ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }

  const stored = getStoredTheme();
  applyTheme(stored === "light" || stored === "dark" ? stored : "dark");

  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const body = document.body;
  const terminalDock = document.getElementById("terminal-dock");
  const commandEl1 = document.getElementById("typed-command-1");
  const outputEl1 = document.getElementById("terminal-output-1");
  const cursorPrompt1 = document.getElementById("term-cursor-1");
  const afterIntro = document.getElementById("terminal-after-intro");
  const profileCard = document.getElementById("profile-card");
  const aboutLong = document.getElementById("about-more");
  const projectsSection = document.getElementById("projects");
  const scrollCue = document.getElementById("scroll-cue");

  const command1 = "render ~/site/profile.html";
  const command2 = "open ~/site/projects";
  const command3 = "cat ~/site/about.md";

  /** @type {{ text: string; wrapClass?: string; accent?: boolean }[]} */
  const outputLines1 = [
    { text: "// Generating profile card…", accent: true },
    { text: "ok — profile mounted" },
    { text: "" },
    { text: "↓ Scroll down for projects & full bio", wrapClass: "hl-scroll" },
  ];

  /** @type {{ text: string; wrapClass?: string; accent?: boolean }[]} */
  const outputLines2 = [
    { text: "Scanning workspace…", accent: true },
    { text: "" },
    { text: "projects/  README.md  (newest first in grid)" },
    { text: "" },
    { text: "// Mounting project grid…", accent: true },
  ];

  /** @type {{ text: string; wrapClass?: string; accent?: boolean }[]} */
  const outputLines3 = [
    { text: "Loading biography…", accent: true },
    { text: "" },
    { text: "// Rendering about section…", accent: true },
  ];

  const scrollListenerOpts = { passive: true };

  let terminalDismissed = false;
  let terminalMinimized = false;
  let introDone = false;
  let profileExecuted = false;
  let projectsExecuted = false;
  let aboutExecuted = false;

  /** @type {HTMLElement | null} */
  let commandEl2 = null;
  /** @type {HTMLElement | null} */
  let commandEl3 = null;
  /** @type {HTMLElement | null} */
  let outputEl2 = null;
  /** @type {HTMLElement | null} */
  let outputEl3 = null;

  let scrollRaf = 0;
  let aboutPhaseActive = false;
  /** Document scrollY where the about command begins advancing */
  let aboutScrollStart = 0;
  let terminalStickToBottom = true;
  let terminalScrollFromScript = false;

  const MOBILE_LAYOUT_MQ = window.matchMedia("(max-width: 768px)");
  const PROJECTS_SCROLL_RATIO = 0.32;
  const ABOUT_SCROLL_RATIO = 0.36;
  const TYPING_LAG_EXPONENT = 1.5;
  const PX_PER_COMMAND_CHAR = 14;

  function scrollChunk(ratio) {
    return window.innerHeight * ratio;
  }

  /** Minimum scroll distance so a command can fully type before its section appears */
  function commandScrollRange(command, ratio) {
    return Math.max(scrollChunk(ratio), command.length * PX_PER_COMMAND_CHAR, 280);
  }

  function syncScrollRunways() {
    const projectsPx = commandScrollRange(command2, PROJECTS_SCROLL_RATIO);
    const aboutRangePx = commandScrollRange(command3, ABOUT_SCROLL_RATIO);

    document.documentElement.style.setProperty("--scroll-runway", `${projectsPx}px`);
    document.documentElement.style.setProperty("--about-scroll-range", `${aboutRangePx}px`);
  }

  function getMaxScrollY() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  /** Scroll progress: always requires ~`range` px of movement when possible */
  function scrollRangeProgress(scrollY, start, range) {
    const dist = Math.max(0, scrollY - start);
    const maxScroll = getMaxScrollY();
    const available = Math.max(0, maxScroll - start);
    if (available <= 0) {
      return 0;
    }
    const effectiveRange = available < range ? available : range;
    return clamp01(dist / effectiveRange);
  }

  /** Typing lags behind scroll — more wheel movement per character */
  function typingProgress(scrollProgress) {
    return clamp01(Math.pow(scrollProgress, TYPING_LAG_EXPONENT));
  }

  function isMobileLayout() {
    return MOBILE_LAYOUT_MQ.matches;
  }

  function terminalStickSlack() {
    return isMobileLayout() ? 72 : 28;
  }

  function getTerminalBody() {
    return document.getElementById("terminal-body");
  }

  function scrollTerminalToBottom() {
    const el = getTerminalBody();
    if (!el || !terminalStickToBottom) return;

    terminalScrollFromScript = true;
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = maxTop;

    if (isMobileLayout()) {
      el.scrollTo({ top: maxTop, left: 0, behavior: "auto" });
      const tail =
        el.querySelector("#terminal-after-intro .terminal__line:last-child") ||
        el.querySelector(".terminal__line:last-child") ||
        el.lastElementChild;
      if (tail && typeof tail.scrollIntoView === "function") {
        tail.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }

    requestAnimationFrame(() => {
      terminalScrollFromScript = false;
    });
  }

  function afterTerminalUpdate() {
    requestAnimationFrame(() => {
      scrollTerminalToBottom();
      if (isMobileLayout()) {
        requestAnimationFrame(scrollTerminalToBottom);
      }
    });
  }

  function initTerminalAutoScroll() {
    const el = getTerminalBody();
    if (!el) return;

    el.addEventListener(
      "scroll",
      () => {
        if (terminalScrollFromScript) return;
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        terminalStickToBottom = dist < terminalStickSlack();
      },
      { passive: true }
    );

    const afterIntroEl = document.getElementById("terminal-after-intro");
    const resizeObserver = new ResizeObserver(() => {
      if (terminalStickToBottom) {
        scrollTerminalToBottom();
      }
    });
    resizeObserver.observe(el);
    if (afterIntroEl) {
      resizeObserver.observe(afterIntroEl);
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        () => {
          if (terminalStickToBottom) {
            scrollTerminalToBottom();
          }
        },
        { passive: true }
      );
    }
  }

  /** When pinned to latest output, wheel on the terminal also scrolls the page */
  function initTerminalWheelPassthrough() {
    const dock = document.getElementById("terminal-dock");
    const body = getTerminalBody();
    if (!dock || !body) return;

    dock.addEventListener(
      "wheel",
      (e) => {
        if (terminalDismissed || terminalMinimized) return;

        const maxScroll = getMaxScrollY();
        const canPageScrollDown = window.scrollY < maxScroll - 1;
        const canPageScrollUp = window.scrollY > 1;

        if (e.deltaY > 0 && terminalStickToBottom && canPageScrollDown) {
          window.scrollBy({ top: e.deltaY, left: 0, behavior: "auto" });
          scheduleScrollUpdate();
          return;
        }

        if (e.deltaY < 0 && body.scrollTop <= 0 && canPageScrollUp) {
          window.scrollBy({ top: e.deltaY, left: 0, behavior: "auto" });
          scheduleScrollUpdate();
        }
      },
      { passive: true }
    );
  }

  function clamp01(n) {
    return Math.min(1, Math.max(0, n));
  }

  function setTerminalBusy(busy) {
    if (terminalDock) {
      terminalDock.setAttribute("data-busy", busy ? "true" : "false");
    }
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function typeText(el, text, perChar) {
    return new Promise((resolve) => {
      if (!el) {
        resolve();
        return;
      }
      let i = 0;
      function step() {
        if (terminalDismissed) {
          resolve();
          return;
        }
        if (i <= text.length) {
          el.textContent = text.slice(0, i);
          i += 1;
          afterTerminalUpdate();
          setTimeout(step, perChar);
        } else {
          afterTerminalUpdate();
          resolve();
        }
      }
      step();
    });
  }

  function backspaceText(el, text, perChar) {
    return new Promise((resolve) => {
      if (!el) {
        resolve();
        return;
      }
      let i = text.length;
      function step() {
        if (terminalDismissed) {
          resolve();
          return;
        }
        if (i >= 0) {
          el.textContent = text.slice(0, i);
          i -= 1;
          afterTerminalUpdate();
          setTimeout(step, perChar);
        } else {
          afterTerminalUpdate();
          resolve();
        }
      }
      step();
    });
  }

  function setCommandProgress(el, command, progress) {
    if (!el) return;
    const len = Math.round(clamp01(progress) * command.length);
    el.textContent = command.slice(0, len);
    afterTerminalUpdate();
  }

  function flushOutputLines(outputEl, lines) {
    if (!outputEl || outputEl.dataset.flushed === "true") return;
    outputEl.dataset.flushed = "true";
    outputEl.textContent = "";
    for (const line of lines) {
      if (line.text === "") {
        outputEl.appendChild(document.createTextNode("\n"));
        continue;
      }
      const lineEl = document.createElement("div");
      if (line.wrapClass) {
        lineEl.innerHTML = `<span class="${line.wrapClass}">${escapeHtml(line.text)}</span>`;
      } else if (line.accent) {
        lineEl.innerHTML = `<span class="hl-accent">${escapeHtml(line.text)}</span>`;
      } else {
        lineEl.textContent = line.text;
      }
      outputEl.appendChild(lineEl);
    }
    afterTerminalUpdate();
  }

  function ensureIdleRow() {
    let row = document.getElementById("terminal-idle-row");
    if (!row && afterIntro) {
      row = document.createElement("div");
      row.className = "terminal__idle-row";
      row.id = "terminal-idle-row";
      row.innerHTML = '<span class="terminal__cursor terminal__cursor--idle" aria-hidden="true"></span>';
      afterIntro.appendChild(row);
    }
    if (afterIntro) {
      afterIntro.hidden = false;
    }
    afterTerminalUpdate();
    return row;
  }

  function moveIdleRowToEnd() {
    const row = document.getElementById("terminal-idle-row");
    if (row && afterIntro) {
      afterIntro.appendChild(row);
    }
    afterTerminalUpdate();
  }

  function setIdleRowVisible(visible) {
    const row = document.getElementById("terminal-idle-row");
    if (row) {
      row.style.display = visible ? "flex" : "none";
    }
  }

  function hideScrollCue() {
    if (scrollCue) {
      scrollCue.classList.add("is-hidden");
    }
  }

  function revealProfile() {
    if (profileExecuted || !profileCard) return;
    profileExecuted = true;
    profileCard.classList.remove("profile-card--pending");
    profileCard.classList.add("is-revealed");
    requestAnimationFrame(() => {
      requestAnimationFrame(updateScrollState);
    });
  }

  function ensureProjectsPrompt() {
    if (!afterIntro || document.getElementById("terminal-prompt-2")) return;

    afterIntro.hidden = false;

    const p2 = document.createElement("p");
    p2.className = "terminal__line terminal__line--prompt";
    p2.id = "terminal-prompt-2";
    p2.innerHTML =
      '<span class="terminal__user">visitor</span><span class="terminal__at">@</span>' +
      '<span class="terminal__host">petitengineer</span><span class="terminal__path"> ~ %</span>' +
      '<span id="typed-command-2" class="terminal__typed"></span>' +
      '<span class="terminal__cursor terminal__cursor--prompt" id="term-cursor-2" aria-hidden="true"></span>';
    afterIntro.appendChild(p2);

    outputEl2 = document.createElement("pre");
    outputEl2.className = "terminal__output";
    outputEl2.id = "terminal-output-2";
    afterIntro.appendChild(outputEl2);

    commandEl2 = document.getElementById("typed-command-2");
    moveIdleRowToEnd();
    afterTerminalUpdate();
  }

  function ensureAboutPrompt() {
    if (!afterIntro || document.getElementById("terminal-prompt-3")) return;

    const p3 = document.createElement("p");
    p3.className = "terminal__line terminal__line--prompt";
    p3.id = "terminal-prompt-3";
    p3.innerHTML =
      '<span class="terminal__user">visitor</span><span class="terminal__at">@</span>' +
      '<span class="terminal__host">petitengineer</span><span class="terminal__path"> ~ %</span>' +
      '<span id="typed-command-3" class="terminal__typed"></span>' +
      '<span class="terminal__cursor terminal__cursor--prompt" id="term-cursor-3" aria-hidden="true"></span>';
    afterIntro.appendChild(p3);

    outputEl3 = document.createElement("pre");
    outputEl3.className = "terminal__output";
    outputEl3.id = "terminal-output-3";
    afterIntro.appendChild(outputEl3);

    commandEl3 = document.getElementById("typed-command-3");
    moveIdleRowToEnd();
    afterTerminalUpdate();
  }

  function getProjectsBottom() {
    if (!projectsSection || !projectsExecuted) return 0;
    return projectsSection.offsetTop + projectsSection.offsetHeight;
  }

  /** Document Y just below the last project card */
  function getLastProjectBottom() {
    if (!projectsSection || !projectsExecuted) {
      return getProjectsBottom();
    }
    const lastCard = projectsSection.querySelector(".project-grid .project-card:last-child");
    if (!lastCard) {
      return getProjectsBottom();
    }
    return window.scrollY + lastCard.getBoundingClientRect().bottom;
  }

  /** Where the about command begins to type (desktop: at projects mount; mobile: past projects) */
  function getAboutScrollAnchor() {
    if (isMobileLayout()) {
      return getLastProjectBottom() + Math.max(48, window.innerHeight * 0.08);
    }
    return aboutScrollStart;
  }

  function executeProjects() {
    if (projectsExecuted || !projectsSection) return;
    projectsExecuted = true;
    aboutPhaseActive = false;

    ensureProjectsPrompt();
    if (commandEl2) {
      commandEl2.textContent = command2;
    }
    const c2 = document.getElementById("term-cursor-2");
    if (c2) {
      c2.classList.add("is-off");
    }
    if (outputEl2) {
      flushOutputLines(outputEl2, outputLines2);
    }
    afterTerminalUpdate();

    requestAnimationFrame(() => {
      body.classList.add("projects-live");
      projectsSection.classList.remove("projects--pending");
      projectsSection.classList.add("is-revealed");
      moveIdleRowToEnd();
      setIdleRowVisible(true);
      requestAnimationFrame(() => {
        syncScrollRunways();
        aboutScrollStart = window.scrollY;
        aboutPhaseActive = true;
        if (!isMobileLayout()) {
          ensureAboutPrompt();
          setIdleRowVisible(false);
        } else {
          setIdleRowVisible(true);
        }
        updateScrollState();
      });
    });
  }

  function executeAbout() {
    if (aboutExecuted) return;
    aboutExecuted = true;

    ensureAboutPrompt();
    if (commandEl3) {
      commandEl3.textContent = command3;
    }
    const c3 = document.getElementById("term-cursor-3");
    if (c3) {
      c3.classList.add("is-off");
    }
    if (outputEl3) {
      flushOutputLines(outputEl3, outputLines3);
    }
    afterTerminalUpdate();

    requestAnimationFrame(() => {
      body.classList.add("about-live");
      if (aboutLong) {
        aboutLong.classList.remove("about-long--pending");
        aboutLong.classList.add("is-revealed");
      }
      hideScrollCue();
      moveIdleRowToEnd();
      setIdleRowVisible(true);
    });
  }

  function revealAllContent() {
    terminalDismissed = true;
    terminalMinimized = false;
    body.classList.add("terminal-dismissed");
    body.classList.remove("terminal-minimized");
    hideScrollCue();

    revealProfile();
    if (!projectsExecuted) {
      executeProjects();
    }
    if (!aboutExecuted) {
      executeAbout();
    }

    aboutPhaseActive = true;
    body.classList.add("projects-live");
    body.classList.add("about-live");
    if (projectsSection) {
      projectsSection.classList.remove("projects--pending");
      projectsSection.classList.add("is-revealed");
    }
    if (aboutLong) {
      aboutLong.classList.remove("about-long--pending");
      aboutLong.classList.add("is-revealed");
    }

    window.removeEventListener("scroll", onScroll, scrollListenerOpts);
    window.removeEventListener("resize", onResize, scrollListenerOpts);
  }

  function toggleMinimize() {
    if (terminalDismissed) return;
    terminalMinimized = !terminalMinimized;
    body.classList.toggle("terminal-minimized", terminalMinimized);
  }

  let zoomGagInFlight = false;

  async function playZoomEasterEgg() {
    if (terminalDismissed || zoomGagInFlight) return;
    zoomGagInFlight = true;

    const dock = document.getElementById("terminal-dock");
    const message = "Error 404: this isn't a real terminal!";

    if (dock) {
      dock.classList.add("is-shaking");
      window.setTimeout(() => dock.classList.remove("is-shaking"), 550);
    }

    if (afterIntro) afterIntro.hidden = false;
    setIdleRowVisible(false);

    let out = document.getElementById("terminal-zoom-gag");
    if (!out && afterIntro) {
      out = document.createElement("pre");
      out.className = "terminal__output";
      out.id = "terminal-zoom-gag";
      afterIntro.appendChild(out);
    }
    if (out) {
      delete out.dataset.flushed;
      out.textContent = "";
      await typeText(out, message, 14);
      await wait(1500);
      await backspaceText(out, message, 9);
      out.remove();
    }

    moveIdleRowToEnd();
    afterTerminalUpdate();
    setIdleRowVisible(true);
    zoomGagInFlight = false;
  }

  async function runIntroSequence() {
    if (!commandEl1 || !outputEl1 || terminalDismissed) return;

    setTerminalBusy(true);
    if (cursorPrompt1) {
      cursorPrompt1.classList.remove("is-off");
    }

    const profileRevealTimer = wait(750).then(() => {
      if (!terminalDismissed) {
        revealProfile();
      }
    });

    await typeText(commandEl1, command1, 14);
    if (terminalDismissed) return;

    await wait(40);
    if (cursorPrompt1) {
      cursorPrompt1.classList.add("is-off");
    }

    flushOutputLines(outputEl1, outputLines1);
    await profileRevealTimer;

    if (terminalDismissed) return;

    introDone = true;
    aboutPhaseActive = false;
    terminalStickToBottom = true;
    ensureIdleRow();
    setIdleRowVisible(true);
    setTerminalBusy(false);
    updateScrollState();
  }

  function scheduleScrollUpdate() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      updateScrollState();
    });
  }

  function getProjectsProgress(scrollY) {
    return scrollRangeProgress(scrollY, 0, commandScrollRange(command2, PROJECTS_SCROLL_RATIO));
  }

  /** Scroll progress for about — starts as soon as projects mount, no dead runway */
  function getAboutProgress(scrollY) {
    if (!aboutPhaseActive || !projectsExecuted) {
      return 0;
    }

    const start = getAboutScrollAnchor();
    const range = commandScrollRange(command3, ABOUT_SCROLL_RATIO);
    return scrollRangeProgress(scrollY, start, range);
  }

  function applyProjectsPhase(progress) {
    const typeP = progress >= 1 ? 1 : typingProgress(progress);

    if (progress > 0.02) {
      ensureProjectsPrompt();
      setIdleRowVisible(false);
      setCommandProgress(commandEl2, command2, typeP);
      const c2 = document.getElementById("term-cursor-2");
      if (c2) {
        c2.classList.toggle("is-off", typeP >= 1);
      }
    }

    if (progress >= 1 && !projectsExecuted) {
      if (commandEl2) {
        commandEl2.textContent = command2;
      }
      const c2 = document.getElementById("term-cursor-2");
      if (c2) {
        c2.classList.add("is-off");
      }
      requestAnimationFrame(() => executeProjects());
    }
  }

  function applyAboutPhase(progress) {
    const scrollY = window.scrollY;
    const anchor = getAboutScrollAnchor();
    if (isMobileLayout() && scrollY + 2 < anchor) {
      setIdleRowVisible(true);
      return;
    }

    const typeP = progress >= 1 ? 1 : typingProgress(progress);

    ensureAboutPrompt();
    setIdleRowVisible(false);
    setCommandProgress(commandEl3, command3, typeP);
    const c3 = document.getElementById("term-cursor-3");
    if (c3) {
      c3.classList.toggle("is-off", typeP >= 1);
    }

    if (progress >= 1 && !aboutExecuted) {
      if (commandEl3) {
        commandEl3.textContent = command3;
      }
      const c3 = document.getElementById("term-cursor-3");
      if (c3) {
        c3.classList.add("is-off");
      }
      requestAnimationFrame(() => executeAbout());
    }
  }

  function updateScrollState() {
    if (terminalDismissed || !introDone || !profileExecuted) return;

    const scrollY = window.scrollY;

    if (!projectsExecuted) {
      applyProjectsPhase(getProjectsProgress(scrollY));
      return;
    }

    if (!aboutExecuted) {
      applyAboutPhase(getAboutProgress(scrollY));
    }

    if (isMobileLayout() && terminalStickToBottom) {
      scrollTerminalToBottom();
    }
  }

  function onScroll() {
    scheduleScrollUpdate();
  }

  function onResize() {
    syncScrollRunways();
    scheduleScrollUpdate();
    if (terminalStickToBottom) {
      scrollTerminalToBottom();
    }
  }

  function scrollMarginTop(el) {
    const v = parseFloat(getComputedStyle(el).scrollMarginTop);
    return Number.isFinite(v) ? v : 0;
  }

  function scrollSectionIntoView(el, extra = 0) {
    const run = () => {
      const top = el.getBoundingClientRect().top + window.scrollY - scrollMarginTop(el) - extra;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }

  function jumpToSection(id) {
    if (id === "profile") {
      revealProfile();
    } else if (id === "projects" || id === "projects-list") {
      revealProfile();
      if (!projectsExecuted) {
        executeProjects();
      }
    } else if (id === "about-more") {
      revealProfile();
      if (!projectsExecuted) {
        executeProjects();
      }
      if (!aboutExecuted) {
        executeAbout();
      }
    }

    const targetId = id === "projects-list" ? "projects" : id;
    const target = document.getElementById(targetId);
    if (!target) return;

    const extraScroll = id === "about-more" ? 48 : 0;
    const scrollDelay = id === "about-more" ? 420 : id === "projects" || id === "projects-list" ? 120 : 0;

    const doScroll = () => scrollSectionIntoView(target, extraScroll);

    if (id === "about-more" && !target.classList.contains("is-revealed")) {
      const observer = new MutationObserver(() => {
        if (target.classList.contains("is-revealed")) {
          observer.disconnect();
          setTimeout(doScroll, 80);
        }
      });
      observer.observe(target, { attributes: true, attributeFilter: ["class"] });
      setTimeout(() => {
        observer.disconnect();
        doScroll();
      }, scrollDelay);
      return;
    }

    if (scrollDelay) {
      setTimeout(doScroll, scrollDelay);
    } else {
      doScroll();
    }
  }

  function initNavJumps() {
    document.querySelectorAll(".nav-link--jump").forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (!href || !href.startsWith("#")) return;
        e.preventDefault();
        jumpToSection(href.slice(1));
      });
    });
  }

  function initChromeButtons() {
    const btnClose = document.getElementById("terminal-btn-close");
    const btnMin = document.getElementById("terminal-btn-minimize");
    const btnZoom = document.getElementById("terminal-btn-zoom");

    if (btnClose) {
      btnClose.addEventListener("click", revealAllContent);
    }
    if (btnMin) {
      btnMin.addEventListener("click", toggleMinimize);
    }
    if (btnZoom) {
      btnZoom.addEventListener("click", playZoomEasterEgg);
    }
  }

  /** @type {HTMLElement | null} */
  let navPromptEl = null;
  /** @type {HTMLElement | null} */
  let navCommandEl = null;
  /** @type {HTMLElement | null} */
  let navOutputEl = null;
  let projectNavInFlight = false;

  function ensureNavPrompt() {
    if (!afterIntro) return null;
    afterIntro.hidden = false;
    setIdleRowVisible(false);

    if (!navPromptEl) {
      navPromptEl = document.createElement("p");
      navPromptEl.className = "terminal__line terminal__line--prompt";
      navPromptEl.id = "terminal-prompt-nav";
      navPromptEl.innerHTML =
        '<span class="terminal__user">visitor</span><span class="terminal__at">@</span>' +
        '<span class="terminal__host">petitengineer</span><span class="terminal__path"> ~ %</span>' +
        '<span id="typed-command-nav" class="terminal__typed"></span>' +
        '<span class="terminal__cursor terminal__cursor--prompt" id="term-cursor-nav" aria-hidden="true"></span>';
      afterIntro.appendChild(navPromptEl);

      navOutputEl = document.createElement("pre");
      navOutputEl.className = "terminal__output";
      navOutputEl.id = "terminal-output-nav";
      afterIntro.appendChild(navOutputEl);
    }

    navCommandEl = document.getElementById("typed-command-nav");
    moveIdleRowToEnd();
    afterTerminalUpdate();
    return navCommandEl;
  }

  /**
   * Types goto into the home terminal, then navigates to the projects page
   * (which runs the same render + goto sequence as a TOC click).
   * @param {string} projectSlug
   * @param {string} url
   */
  async function navigateToProject(projectSlug, url) {
    if (!projectSlug || !url || projectNavInFlight) return;
    projectNavInFlight = true;

    if (terminalDismissed || !introDone) {
      window.location.href = url;
      projectNavInFlight = false;
      return;
    }

    const command = `goto "${projectSlug}"`;
    const cmdEl = ensureNavPrompt();
    const cursor = document.getElementById("term-cursor-nav");

    if (navOutputEl) {
      delete navOutputEl.dataset.flushed;
    }
    if (cmdEl) cmdEl.textContent = "";
    if (cursor) cursor.classList.remove("is-off");

    await typeText(cmdEl, command, 12);
    if (terminalDismissed) {
      window.location.href = url;
      projectNavInFlight = false;
      return;
    }

    if (cursor) cursor.classList.add("is-off");
    if (navOutputEl) {
      flushOutputLines(navOutputEl, [{ text: "// Navigating to project…", accent: true }]);
    }

    await wait(1500);
    window.location.href = url;
    projectNavInFlight = false;
  }

  window.navigateToProject = navigateToProject;
  window.isTerminalDismissed = () => terminalDismissed;

  async function boot() {
    syncScrollRunways();
    initChromeButtons();
    initNavJumps();
    initTerminalAutoScroll();
    initTerminalWheelPassthrough();
    MOBILE_LAYOUT_MQ.addEventListener("change", onResize);
    window.addEventListener("scroll", onScroll, scrollListenerOpts);
    window.addEventListener("resize", onResize, scrollListenerOpts);
    await runIntroSequence();
    if (!terminalDismissed) {
      updateScrollState();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
