(function () {
  const html = document.documentElement;
  const THEME_KEY = "petitengineer-theme";
  const MOBILE_LAYOUT_MQ = window.matchMedia("(max-width: 768px)");
  const TOC_BUBBLE_MQ = window.matchMedia("(max-width: 1100px)");
  const SCROLL_RATIO = 0.34;
  const TYPING_LAG_EXPONENT = 1.5;
  const PX_PER_COMMAND_CHAR = 14;
  /** Shorter intro runway so the first project command completes after a small scroll */
  const INTRO_SCROLL_VH = 0.22;

  const body = document.body;
  const terminalDock = document.getElementById("terminal-dock");
  const commandEl1 = document.getElementById("typed-command-1");
  const outputEl1 = document.getElementById("terminal-output-1");
  const cursorPrompt1 = document.getElementById("term-cursor-1");
  const afterIntro = document.getElementById("terminal-after-intro");
  const mountEl = document.getElementById("projects-mount");
  const tocList = document.getElementById("projects-toc-list");
  const tocFab = document.getElementById("projects-toc-fab");
  const tocPanel = document.getElementById("projects-toc-panel");
  const scrollCue = document.getElementById("scroll-cue");
  const introSection = document.getElementById("projects-intro");

  /** @type {{ command: string, outputLines: {text: string, accent?: boolean, wrapClass?: string}[], section: HTMLElement | null, executed: boolean, scrollStart: number }[]} */
  let phases = [];
  let currentPhase = 0;
  let introDone = false;
  let terminalDismissed = false;
  let terminalMinimized = false;
  let terminalStickToBottom = true;
  let terminalScrollFromScript = false;
  let scrollRaf = 0;

  /** @type {HTMLElement[]} */
  let projectSections = [];
  let activeTocSlug = "";

  function isMobileLayout() {
    return MOBILE_LAYOUT_MQ.matches;
  }

  function terminalStickSlack() {
    return isMobileLayout() ? 72 : 28;
  }

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

  function clamp01(n) {
    return Math.min(1, Math.max(0, n));
  }

  function scrollChunk(ratio) {
    return window.innerHeight * ratio;
  }

  function commandScrollRange(command, ratio) {
    return Math.max(scrollChunk(ratio), command.length * PX_PER_COMMAND_CHAR, 280);
  }

  function getMaxScrollY() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function scrollRangeProgress(scrollY, start, range) {
    const dist = Math.max(0, scrollY - start);
    const maxScroll = getMaxScrollY();
    if (scrollY >= maxScroll - 1 && dist > 0) {
      return 1;
    }
    const available = Math.max(0, maxScroll - start);
    if (available <= 0) {
      return dist > 0 ? 1 : 0;
    }
    const effectiveRange = available < range ? available : range;
    return clamp01(dist / effectiveRange);
  }

  function typingProgress(scrollProgress) {
    return clamp01(Math.pow(scrollProgress, TYPING_LAG_EXPONENT));
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
    const ro = new ResizeObserver(() => {
      if (terminalStickToBottom) scrollTerminalToBottom();
    });
    ro.observe(el);
    if (afterIntro) ro.observe(afterIntro);

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        () => {
          if (terminalStickToBottom) scrollTerminalToBottom();
        },
        { passive: true }
      );
    }
  }

  function initTerminalWheelPassthrough() {
    const dock = document.getElementById("terminal-dock");
    const termBody = getTerminalBody();
    if (!dock || !termBody) return;

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

        if (e.deltaY < 0 && termBody.scrollTop <= 0 && canPageScrollUp) {
          window.scrollBy({ top: e.deltaY, left: 0, behavior: "auto" });
          scheduleScrollUpdate();
        }
      },
      { passive: true }
    );
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
    return String(s)
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
    outputEl.innerHTML = lines
      .map((line) => {
        const cls = [line.accent ? "hl-accent" : "", line.wrapClass || ""].filter(Boolean).join(" ");
        return `<span class="terminal__line${cls ? ` ${cls}` : ""}">${escapeHtml(line.text)}</span>`;
      })
      .join("\n");
    afterTerminalUpdate();
  }

  /** Document-space geometry (offsetTop breaks inside nested layout). */
  function getDocRect(el) {
    if (!el) {
      return { top: 0, bottom: 0, height: 0 };
    }
    const r = el.getBoundingClientRect();
    return {
      top: window.scrollY + r.top,
      bottom: window.scrollY + r.bottom,
      height: r.height,
    };
  }

  function getSectionBottom(el) {
    return getDocRect(el).bottom;
  }

  function getViewportBottom(scrollY) {
    return scrollY + window.innerHeight;
  }

  /** Section whose scroll position drives typing for this phase (null = intro runway only). */
  function getScrollSectionForPhase(phaseIndex) {
    if (phaseIndex <= 0) return null;
    return projectSections[phaseIndex - 1] || null;
  }

  /**
   * Scroll progress (0–1). Intro uses the invisible runway below the heading.
   * While reading project N, type phases[N + 1] (the command that reveals project N + 1).
   */
  function getPostScrollProgress(phaseIndex, scrollY) {
    const vh = window.innerHeight;
    const viewBottom = getViewportBottom(scrollY);

    if (phaseIndex === 0) {
      const nudge = document.querySelector(".scroll-nudge--projects-intro");
      if (!nudge) return 0;
      const nudgeRect = getDocRect(nudge);
      const readStart = nudgeRect.top - vh * 0.08;
      const readEnd = nudgeRect.bottom;
      if (viewBottom < readStart) return 0;
      if (viewBottom >= readEnd) return 1;
      return clamp01((viewBottom - readStart) / Math.max(readEnd - readStart, 1));
    }

    const post = getScrollSectionForPhase(phaseIndex);
    if (!post || !post.classList.contains("is-revealed")) return 0;

    const rect = getDocRect(post);
    const readStart = rect.top + vh * 0.12;
    const readEnd = rect.bottom - vh * 0.06;

    if (viewBottom < readStart) return 0;
    if (viewBottom >= readEnd) return 1;
    return clamp01((viewBottom - readStart) / Math.max(readEnd - readStart, 1));
  }

  function syncIntroRunway(command) {
    const px = Math.max(
      command.length * PX_PER_COMMAND_CHAR,
      window.innerHeight * INTRO_SCROLL_VH,
      160
    );
    document.documentElement.style.setProperty("--scroll-runway-projects-intro", `${px}px`);
  }

  function syncPhasePadding() {
    document.documentElement.style.removeProperty("--projects-phase-padding");
  }

  function setTocActive(slug) {
    if (!tocList) return;
    const next = slug || "";
    if (next === activeTocSlug) return;
    activeTocSlug = next;
    tocList.querySelectorAll("a").forEach((a) => {
      a.classList.toggle("is-active", next !== "" && a.dataset.slug === next);
    });
  }

  /** Highlight the revealed project that occupies the most of the viewport. */
  function updateTocFromScroll() {
    if (!tocList) return;

    const revealed = projectSections.filter((sec) => sec.classList.contains("is-revealed"));
    if (!revealed.length) {
      setTocActive("");
      return;
    }

    const viewTop = window.scrollY;
    const viewBottom = viewTop + window.innerHeight;
    let bestSlug = "";
    let bestVisible = 0;

    for (const sec of revealed) {
      const rect = getDocRect(sec);
      const visible = Math.min(rect.bottom, viewBottom) - Math.max(rect.top, viewTop);
      if (visible > bestVisible) {
        bestVisible = visible;
        bestSlug = sec.dataset.slug || "";
      }
    }

    setTocActive(bestVisible > 0 ? bestSlug : "");
  }

  function typesetProjectMath(el) {
    const prose = el && el.querySelector(".project-detail__prose");
    const targets = prose ? [prose] : el ? [el] : [];
    if (!targets.length || !window.MathJax || !window.MathJax.typesetPromise) {
      return Promise.resolve();
    }
    return window.MathJax.typesetPromise(targets);
  }

  function revealSection(el, slug, revealedIndex) {
    if (!el) return;
    el.classList.remove("project-detail--pending");
    el.classList.add("is-revealed");

    const afterLayout = () => {
      body.classList.add("projects-phase-live");
      syncPhasePadding();
      updateTocFromScroll();
      scheduleScrollUpdate();
    };

    typesetProjectMath(el).then(afterLayout).catch(afterLayout);
  }

  function revealAllProjects() {
    terminalDismissed = true;
    body.classList.add("terminal-dismissed", "projects-all-live");
    hideScrollCue();
    projectSections.forEach((sec) => {
      sec.classList.remove("project-detail--pending");
      sec.classList.add("is-revealed");
    });
    const proseBlocks = projectSections
      .map((sec) => sec.querySelector(".project-detail__prose"))
      .filter(Boolean);
    if (proseBlocks.length && window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise(proseBlocks).catch(() => {});
    }
    updateTocFromScroll();
  }

  function hideScrollCue() {
    if (scrollCue) scrollCue.classList.add("is-hidden");
  }

  /** @type {HTMLElement | null} */
  let idleRow = null;

  function ensureIdleRow() {
    if (!afterIntro) return;
    let row = document.getElementById("terminal-idle-row");
    if (!row) {
      row = document.createElement("div");
      row.className = "terminal__idle-row";
      row.id = "terminal-idle-row";
      row.innerHTML = '<span class="terminal__cursor terminal__cursor--idle" aria-hidden="true"></span>';
      afterIntro.appendChild(row);
    }
    idleRow = row;
  }

  function setIdleRowVisible(show) {
    ensureIdleRow();
    if (!idleRow) return;
    idleRow.style.display = show ? "flex" : "none";
  }

  function moveIdleRowToEnd() {
    if (idleRow && afterIntro) {
      afterIntro.appendChild(idleRow);
    }
  }

  /**
   * @param {number} phaseIndex
   * @returns {{ prompt: HTMLElement, commandEl: HTMLElement, outputEl: HTMLElement, cursor: HTMLElement | null }}
   */
  function ensurePhasePrompt(phaseIndex) {
    if (!afterIntro) {
      throw new Error("terminal-after-intro missing");
    }
    const id = phaseIndex + 2;
    let prompt = document.getElementById(`terminal-prompt-${id}`);
    if (!prompt) {
      prompt = document.createElement("p");
      prompt.className = "terminal__line terminal__line--prompt";
      prompt.id = `terminal-prompt-${id}`;
      prompt.innerHTML =
        '<span class="terminal__user">visitor</span><span class="terminal__at">@</span>' +
        '<span class="terminal__host">petitengineer</span><span class="terminal__path"> ~ %</span>' +
        `<span id="typed-command-${id}" class="terminal__typed"></span>` +
        `<span class="terminal__cursor terminal__cursor--prompt" id="term-cursor-${id}" aria-hidden="true"></span>`;
      afterIntro.appendChild(prompt);

      const output = document.createElement("pre");
      output.className = "terminal__output";
      output.id = `terminal-output-${id}`;
      afterIntro.appendChild(output);
    }

    const commandEl = document.getElementById(`typed-command-${id}`);
    const outputEl = document.getElementById(`terminal-output-${id}`);
    const cursor = document.getElementById(`term-cursor-${id}`);
    moveIdleRowToEnd();
    afterTerminalUpdate();
    return { prompt, commandEl, outputEl, cursor };
  }

  function executePhase(phaseIndex) {
    const phase = phases[phaseIndex];
    if (!phase || phase.executed) return;
    phase.executed = true;

    const revealIndex = phase.revealIndex ?? phaseIndex;
    const section = projectSections[revealIndex];
    if (section) {
      revealSection(section, section.dataset.slug, revealIndex);
    }

    const { commandEl, cursor, outputEl } = getPromptForPhase(phaseIndex);
    if (commandEl) commandEl.textContent = phase.command;
    if (cursor) cursor.classList.add("is-off");
    if (outputEl) {
      delete outputEl.dataset.flushed;
    }
    flushOutputLines(outputEl, phase.outputLines);

    if (phaseIndex + 1 < phases.length) {
      phases[phaseIndex + 1].scrollStart = window.scrollY;
      currentPhase = phaseIndex + 1;
    } else {
      hideScrollCue();
    }

    setIdleRowVisible(true);

    requestAnimationFrame(() => {
      syncPhasePadding();
      updateScrollState();
    });
  }

  function getPromptForPhase(phaseIndex) {
    if (phaseIndex === 0) {
      return { commandEl: commandEl1, cursor: cursorPrompt1, outputEl: outputEl1 };
    }
    return ensurePhasePrompt(phaseIndex);
  }

  function applyActivePhase() {
    if (terminalDismissed || !introDone) return;

    const phase = phases[currentPhase];
    if (!phase || phase.executed) return;

    const scrollY = window.scrollY;
    const progress = getPostScrollProgress(currentPhase, scrollY);

    if (progress <= 0) {
      setIdleRowVisible(true);
      return;
    }

    setIdleRowVisible(false);
    const { commandEl, cursor } = getPromptForPhase(currentPhase);
    const typeP = clamp01(progress);

    setCommandProgress(commandEl, phase.command, typeP);
    if (cursor) {
      cursor.classList.remove("is-off");
    }

    if (progress >= 1) {
      if (commandEl) commandEl.textContent = phase.command;
      if (cursor) cursor.classList.add("is-off");
      requestAnimationFrame(() => executePhase(currentPhase));
    }
  }

  function updateScrollState() {
    applyActivePhase();
    updateTocFromScroll();
    if (isMobileLayout() && terminalStickToBottom) {
      scrollTerminalToBottom();
    }
  }

  function scheduleScrollUpdate() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      updateScrollState();
    });
  }

  function onScroll() {
    scheduleScrollUpdate();
  }

  function onResize() {
    if (phases[0]) {
      syncIntroRunway(phases[0].command);
    }
    syncPhasePadding();
    scheduleScrollUpdate();
    if (terminalStickToBottom) scrollTerminalToBottom();
  }

  async function runIntro() {
    if (!commandEl1 || !outputEl1) return;
    setTerminalBusy(true);
    if (afterIntro) afterIntro.hidden = false;

    if (outputEl1) {
      outputEl1.textContent = "";
      delete outputEl1.dataset.flushed;
    }
    if (commandEl1) commandEl1.textContent = "";
    if (cursorPrompt1) cursorPrompt1.classList.remove("is-off");

    introDone = true;
    terminalStickToBottom = true;
    setTerminalBusy(false);
    ensureIdleRow();
    setIdleRowVisible(true);
    if (phases[0]) {
      phases[0].scrollStart = 0;
      syncIntroRunway(phases[0].command);
    }
    currentPhase = 0;
    syncPhasePadding();
    requestAnimationFrame(() => {
      requestAnimationFrame(updateScrollState);
    });
  }

  function closeTocPanel() {
    if (!tocPanel || !tocFab) return;
    tocPanel.hidden = true;
    tocFab.setAttribute("aria-expanded", "false");
    tocPanel.classList.remove("is-open");
  }

  function openTocPanel() {
    if (!tocPanel || !tocFab) return;
    tocPanel.hidden = false;
    tocFab.setAttribute("aria-expanded", "true");
    tocPanel.classList.add("is-open");
  }

  function initTocUi() {
    if (!tocFab || !tocPanel) return;

    tocFab.addEventListener("click", () => {
      const open = tocFab.getAttribute("aria-expanded") === "true";
      if (open) {
        closeTocPanel();
      } else {
        openTocPanel();
      }
    });

    document.addEventListener("click", (e) => {
      if (!TOC_BUBBLE_MQ.matches) return;
      if (tocPanel.hidden) return;
      const t = e.target;
      if (t instanceof Node && (tocPanel.contains(t) || tocFab.contains(t))) return;
      closeTocPanel();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeTocPanel();
    });
  }

  function buildToc(projects) {
    if (!tocList) return;
    tocList.innerHTML = projects
      .map(
        (p) =>
          `<li><a href="#${escapeHtml(p.slug)}" data-slug="${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></li>`
      )
      .join("");

    tocList.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        closeTocPanel();
        jumpToProject(link.dataset.slug || "");
      });
    });
  }

  /** @type {HTMLElement | null} */
  let jumpPromptEl = null;
  /** @type {HTMLElement | null} */
  let jumpCommandEl = null;
  /** @type {HTMLElement | null} */
  let jumpOutputEl = null;
  let jumpInFlight = false;

  function ensureJumpPrompt() {
    if (!afterIntro) return null;
    afterIntro.hidden = false;
    setIdleRowVisible(false);

    if (!jumpPromptEl) {
      jumpPromptEl = document.createElement("p");
      jumpPromptEl.className = "terminal__line terminal__line--prompt";
      jumpPromptEl.id = "terminal-prompt-jump";
      jumpPromptEl.innerHTML =
        '<span class="terminal__user">visitor</span><span class="terminal__at">@</span>' +
        '<span class="terminal__host">petitengineer</span><span class="terminal__path"> ~ %</span>' +
        '<span id="typed-command-jump" class="terminal__typed"></span>' +
        '<span class="terminal__cursor terminal__cursor--prompt" id="term-cursor-jump" aria-hidden="true"></span>';
      afterIntro.appendChild(jumpPromptEl);

      jumpOutputEl = document.createElement("pre");
      jumpOutputEl.className = "terminal__output";
      jumpOutputEl.id = "terminal-output-jump";
      afterIntro.appendChild(jumpOutputEl);
    }

    jumpCommandEl = document.getElementById("typed-command-jump");
    moveIdleRowToEnd();
    afterTerminalUpdate();
    return jumpCommandEl;
  }

  const RENDER_TYPE_MS = 9;
  const RENDER_GAP_MS = 220;

  async function playRenderPhaseTerminal(phaseIndex) {
    const phase = phases[phaseIndex];
    if (!phase || phase.executed || terminalDismissed) return;

    if (afterIntro) afterIntro.hidden = false;
    setIdleRowVisible(false);

    const { commandEl, cursor } = getPromptForPhase(phaseIndex);
    if (commandEl) commandEl.textContent = "";
    if (cursor) cursor.classList.remove("is-off");

    await typeText(commandEl, phase.command, RENDER_TYPE_MS);
    if (terminalDismissed || phase.executed) return;

    executePhase(phaseIndex);
    await wait(RENDER_GAP_MS);
  }

  async function playRenderSequenceThrough(targetIdx) {
    for (let i = 0; i <= targetIdx; i += 1) {
      if (terminalDismissed) return;
      await playRenderPhaseTerminal(i);
    }
  }

  async function playGotoSequence(slug) {
    if (terminalDismissed) return;

    const command = `goto "${slug}"`;
    const cmdEl = ensureJumpPrompt();
    const cursor = document.getElementById("term-cursor-jump");

    if (jumpOutputEl) delete jumpOutputEl.dataset.flushed;
    if (cmdEl) cmdEl.textContent = "";
    if (cursor) cursor.classList.remove("is-off");

    setIdleRowVisible(false);
    await typeText(cmdEl, command, 12);
    if (terminalDismissed) return;

    if (cursor) cursor.classList.add("is-off");
    if (jumpOutputEl) {
      flushOutputLines(jumpOutputEl, [{ text: "// Navigating to project…", accent: true }]);
    }

    await wait(1500);
  }

  function finishJumpToProject(slug) {
    const idx = projectSections.findIndex((s) => s.dataset.slug === slug);
    if (idx < 0) return;

    for (let i = 0; i <= idx; i += 1) {
      if (phases[i]) {
        phases[i].executed = true;
      }
      revealSection(projectSections[i], projectSections[i].dataset.slug, i);
    }

    currentPhase = Math.min(idx + 1, phases.length - 1);
    const next = phases[currentPhase];
    if (next && !next.executed) {
      next.scrollStart = window.scrollY;
    }

    const target =
      document.getElementById(`project-${slug}`) ||
      projectSections[idx] ||
      document.getElementById(slug);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (idx >= projectSections.length - 1) {
      hideScrollCue();
    }
    syncPhasePadding();
    updateTocFromScroll();
    updateScrollState();
  }

  async function jumpToProject(slug) {
    if (terminalDismissed) {
      finishJumpToProject(slug);
      return;
    }

    if (jumpInFlight) return;

    const idx = projectSections.findIndex((s) => s.dataset.slug === slug);
    if (idx < 0) return;

    jumpInFlight = true;
    setTerminalBusy(true);

    try {
      await playRenderSequenceThrough(idx);
      if (terminalDismissed) return;

      await playGotoSequence(slug);
      if (terminalDismissed) return;

      finishJumpToProject(slug);
    } finally {
      jumpInFlight = false;
      setTerminalBusy(false);
    }
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

  function initChromeButtons() {
    const btnClose = document.getElementById("terminal-btn-close");
    const btnMin = document.getElementById("terminal-btn-minimize");
    const btnZoom = document.getElementById("terminal-btn-zoom");
    if (btnClose) btnClose.addEventListener("click", revealAllProjects);
    if (btnMin) {
      btnMin.addEventListener("click", () => {
        if (terminalDismissed) return;
        terminalMinimized = !terminalMinimized;
        body.classList.toggle("terminal-minimized", terminalMinimized);
      });
    }
    if (btnZoom) {
      btnZoom.addEventListener("click", () => playZoomEasterEgg());
    }
  }

  async function loadProjectFragments(projects) {
    if (!mountEl) return;
    mountEl.innerHTML = "";
    projectSections = [];

    for (const meta of projects) {
      const res = await fetch(meta.page);
      if (!res.ok) continue;
      const htmlText = await res.text();
      const wrap = document.createElement("div");
      wrap.innerHTML = htmlText.trim();
      const section = wrap.querySelector(".project-detail");
      if (!section) continue;
      mountEl.appendChild(section);
      projectSections.push(section);
    }
  }

  function buildPhases(projects) {
    phases = projects.map((p, i) => ({
      command: p.command,
      revealIndex: i,
      outputLines: [
        { text: `// Rendering ${p.title}…`, accent: true },
        { text: "ok — section mounted" },
        { text: "" },
        {
          text:
            i < projects.length - 1 ? "↓ Scroll for next project" : "↓ End of project index",
          wrapClass: "hl-scroll",
        },
      ],
      section: projectSections[i],
      executed: false,
      scrollStart: 0,
    }));
  }

  async function boot() {
    if (!window.ProjectsRegistry || !mountEl) return;

    initChromeButtons();
    initTerminalAutoScroll();
    initTerminalWheelPassthrough();
    initTocUi();
    MOBILE_LAYOUT_MQ.addEventListener("change", onResize);
    TOC_BUBBLE_MQ.addEventListener("change", closeTocPanel);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    try {
      const projects = await window.ProjectsRegistry.loadProjectsSorted();
      await loadProjectFragments(projects);
      document.querySelectorAll(".project-scroll-runway").forEach((el) => el.remove());
      buildToc(projects);
      buildPhases(projects);
      if (phases[0]) {
        syncIntroRunway(phases[0].command);
      }

      const hash = window.location.hash.replace(/^#/, "");
      if (!TOC_BUBBLE_MQ.matches && tocPanel) {
        tocPanel.hidden = false;
      }

      await runIntro();
      if (hash) {
        if (terminalDismissed) {
          finishJumpToProject(hash);
        } else {
          jumpToProject(hash);
        }
      }
    } catch (err) {
      console.error(err);
      if (mountEl) {
        mountEl.innerHTML = "<p class=\"projects-load-error\">Could not load projects. Check manifest and page files.</p>";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
