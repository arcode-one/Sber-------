// Фоновые линии в стиле Сбер: лента из тонких кривых с перекрутом.
// Каждая линия — кубическая Безье, контрольные точки интерполируются между
// двумя краями ленты A и B; если края пересекаются, лента «перекручивается».
const r = n => Math.round(n * 10) / 10;
const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

function ribbon(A, B, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const P = A.map((p, k) => lerp(p, B[k], t));
    const op = r(0.35 + 0.65 * Math.sin(t * Math.PI));
    out.push(`<path d="M${r(P[0][0])} ${r(P[0][1])}C${r(P[1][0])} ${r(P[1][1])} ${r(P[2][0])} ${r(P[2][1])} ${r(P[3][0])} ${r(P[3][1])}" stroke-opacity="${op}"/>`);
  }
  return out.join('');
}

const grad = (id, x1, y1, x2, y2) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
  `<stop offset="0" stop-color="#96DD12"/><stop offset=".35" stop-color="#21A038"/>` +
  `<stop offset=".7" stop-color="#3FE0B1"/><stop offset="1" stop-color="#05C1F5"/></linearGradient>`;

// Справа внизу: лента входит снизу и уходит в правый край, перекрут посередине
const brA = [[420, 800], [700, 620], [900, 420], [1200, 240]];
const brB = [[860, 800], [720, 520], [1000, 600], [1200, 520]];
const br = `<svg class="decor__lines decor__lines--br" viewBox="0 0 1200 800" preserveAspectRatio="xMaxYMax meet" fill="none">` +
  `<defs>${grad('dl-br', 420, 800, 1200, 240)}</defs>` +
  `<g stroke="url(#dl-br)" stroke-width="1.25">${ribbon(brA, brB, 26)}</g></svg>`;

// Слева вверху: узкая лента у края, обходит логотип снизу и не заходит на текст шапки
const tlA = [[30, 0], [0, 220], [330, 380], [0, 660]];
const tlB = [[0, 0], [120, 300], [250, 560], [0, 860]];
const tl = `<svg class="decor__lines decor__lines--tl" viewBox="0 0 280 880" preserveAspectRatio="xMinYMin meet" fill="none">` +
  `<defs>${grad('dl-tl', 0, 860, 260, 0)}</defs>` +
  `<g stroke="url(#dl-tl)" stroke-width="1.25">${ribbon(tlA, tlB, 18)}</g></svg>`;

process.stdout.write(
`  <!-- Фон: ленты из линий в стиле Сбер (сгенерированы, цвета — шкалы Nova) -->
  <div class="decor" aria-hidden="true">
    ${tl}
    ${br}
  </div>
`);
