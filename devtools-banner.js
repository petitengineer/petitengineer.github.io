/*
 * Le savoir pèse peu : accumulez-en autant que vous pouvez.
 * Knowledge weighs little; carry all that you can.
 *
 * (Canadian Iron Ring — Braille dot art: see iron-ring-art.txt)
 *
 * Fièrement canadien
 * Proudly Canadian
 */

(function () {
  const quote = [
    "Le savoir pèse peu : accumulez-en autant que vous pouvez.",
    "Knowledge weighs little; carry all that you can.",
  ].join("\n");
  const footer = ["Fièrement canadien", "Proudly Canadian"].join("\n");

  function show(art) {
    console.log(
      `%c${quote}\n\n${art}\n\n${footer}`,
      "font-family: monospace; line-height: 1.1; font-size: 8px;"
    );
  }

  fetch("./iron-ring-art.txt")
    .then((res) => (res.ok ? res.text() : Promise.reject()))
    .then(show)
    .catch(() => show("(Iron ring art: open page source HTML comment to view.)"));
})();
