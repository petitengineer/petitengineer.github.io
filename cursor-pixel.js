/**
 * Three sky/pink pixels in a trailing line: largest at the pointer,
 * then two smaller pixels behind. Desktop: follow cursor; mobile: follow swipes.
 */
(function () {
  const MOBILE_LAYOUT = window.matchMedia("(max-width: 768px)");
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
  const TRAIL_LERP = [0.42, 0.28];
  const DOT_CLASSES = [
    "cursor-pixel__dot cursor-pixel__dot--lead",
    "cursor-pixel__dot cursor-pixel__dot--mid",
    "cursor-pixel__dot cursor-pixel__dot--trail",
  ];

  const root = document.createElement("div");
  root.className = "cursor-pixel";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = DOT_CLASSES.map((c) => `<span class="${c}"></span>`).join("");

  const dots = [...root.children];
  const target = { x: -100, y: -100 };
  const pos = [
    { x: -100, y: -100 },
    { x: -100, y: -100 },
    { x: -100, y: -100 },
  ];
  let animating = false;

  function show() {
    root.classList.add("is-visible");
  }

  function ensureAnimating() {
    if (!animating) {
      animating = true;
      requestAnimationFrame(tick);
    }
  }

  function placeDot(dot, x, y) {
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
  }

  function snapAll(x, y) {
    target.x = x;
    target.y = y;
    for (let i = 0; i < pos.length; i += 1) {
      pos[i].x = x;
      pos[i].y = y;
      placeDot(dots[i], x, y);
    }
  }

  function setTarget(x, y) {
    target.x = x;
    target.y = y;
    show();
    ensureAnimating();
  }

  function tick() {
    const stackTrail = REDUCED_MOTION.matches;

    pos[0].x = target.x;
    pos[0].y = target.y;

    if (stackTrail) {
      for (let i = 1; i < pos.length; i += 1) {
        pos[i].x = target.x;
        pos[i].y = target.y;
      }
    } else {
      for (let i = 1; i < pos.length; i += 1) {
        const follow = pos[i - 1];
        const lerp = TRAIL_LERP[i - 1];
        pos[i].x += (follow.x - pos[i].x) * lerp;
        pos[i].y += (follow.y - pos[i].y) * lerp;
      }
    }

    for (let i = 0; i < dots.length; i += 1) {
      placeDot(dots[i], pos[i].x, pos[i].y);
    }

    requestAnimationFrame(tick);
  }

  function onPointerFollow(e) {
    if (MOBILE_LAYOUT.matches) return;
    if (e.pointerType === "touch") return;
    setTarget(e.clientX, e.clientY);
  }

  function onMouseFollow(e) {
    if (MOBILE_LAYOUT.matches) return;
    setTarget(e.clientX, e.clientY);
  }

  function touchPoint(e) {
    return e.touches[0] || e.changedTouches[0] || null;
  }

  function onTouchStart(e) {
    if (!MOBILE_LAYOUT.matches) return;
    const t = touchPoint(e);
    if (!t) return;
    snapAll(t.clientX, t.clientY);
    show();
    ensureAnimating();
  }

  function onTouchMove(e) {
    if (!MOBILE_LAYOUT.matches) return;
    const t = touchPoint(e);
    if (!t) return;
    setTarget(t.clientX, t.clientY);
  }

  function init() {
    if (root.parentNode) return;
    document.body.appendChild(root);

    document.addEventListener("pointermove", onPointerFollow, { passive: true });
    document.addEventListener("mousemove", onMouseFollow, { passive: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    ensureAnimating();
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
