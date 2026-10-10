(() => {
  const emblem = document.querySelector(".emblem");
  if (!emblem) return;

  const still = emblem.querySelector(".emblem-still");
  const crystal = emblem.querySelector(".emblem-crystal");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const darkMode = window.matchMedia("(prefers-color-scheme: dark)");
  const svgNamespace = "http://www.w3.org/2000/svg";

  // 每 24 秒绕竖直的 Y 轴转一圈；所有图形均在本地绘制。
  const revolutionSeconds = 24;
  const perspective = 420;
  const initialAngle = Math.PI / 8;
  let currentAngle = initialAngle;
  let palette;

  function updatePalette() {
    const style = getComputedStyle(emblem);
    const color = name => {
      const hex = style.getPropertyValue(name).trim().slice(1);
      return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
    };
    palette = { shadow: color("--gem-shadow"), gold: color("--gold"), highlight: color("--gem-highlight") };
  }

  function facetColor(light) {
    const start = light < 0.5 ? palette.shadow : palette.gold;
    const end = light < 0.5 ? palette.gold : palette.highlight;
    const blend = light < 0.5 ? light * 2 : (light - 0.5) * 2;
    return `rgb(${start.map((value, i) => Math.round(value + (end[i] - value) * blend)).join(",")})`;
  }

  function makeGem(container, points, polygons) {
    const faces = polygons.map(indices => {
      const path = document.createElementNS(svgNamespace, "path");
      path.setAttribute("fill", "currentColor");
      path.setAttribute("stroke-width", "0.7");
      path.setAttribute("stroke-linejoin", "round");
      container.appendChild(path);
      return { indices, path };
    });
    return { container, points, faces };
  }

  // 阶梯式切工：宽阔的透明台面、倒角和前后切面组成同一颗水晶。
  function makeCutGem(container) {
    const points = [];
    for (const [width, height, bevel, depth] of [[18, 32, 5, 10], [26, 42, 8, 3], [26, 42, 8, -3], [14, 28, 5, -13]]) {
      points.push(
        [-width + bevel, -height, depth], [width - bevel, -height, depth],
        [width, -height + bevel, depth], [width, height - bevel, depth],
        [width - bevel, height, depth], [-width + bevel, height, depth],
        [-width, height - bevel, depth], [-width, -height + bevel, depth],
      );
    }
    const ring = (level, index) => level * 8 + index % 8;
    const polygons = [[0, 1, 2, 3, 4, 5, 6, 7], [31, 30, 29, 28, 27, 26, 25, 24]];
    for (let level = 0; level < 3; level++) {
      for (let i = 0; i < 8; i++) {
        polygons.push([ring(level, i), ring(level + 1, i), ring(level + 1, i + 1), ring(level, i + 1)]);
      }
    }
    return makeGem(container, points, polygons);
  }

  const body = makeCutGem(emblem.querySelector(".crystal-body"));

  // 真正的三维坐标旋转：高度保持固定，左右与前后位置随转角改变。
  function rotate([x, y, z], angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [x * cosine + z * sine, y, z * cosine - x * sine];
  }

  function project([x, y, z]) {
    const scale = perspective / (perspective - z);
    return `${(60 + x * scale).toFixed(3)} ${(60 + y * scale).toFixed(3)}`;
  }

  function renderGem(gem, angle) {
    const vertices = gem.points.map(point => rotate(point, angle));
    const faces = gem.faces.map(face => {
      const corners = face.indices.map(index => vertices[index]);
      const [a, b, c] = corners;
      const u = b.map((value, i) => value - a[i]);
      const v = c.map((value, i) => value - a[i]);
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const length = Math.hypot(...normal);
      const light = 0.18 + 0.82 * Math.max(0, (-0.45 * normal[0] - 0.25 * normal[1] + 0.86 * normal[2]) / length);
      const facing = Math.max(0, normal[2] / length);
      face.path.setAttribute("d", `M${corners.map(project).join("L")}Z`);
      face.path.setAttribute("fill", facetColor(0.65 + light * 0.3));
      // 台面保持通透，较窄的切面接住柔和反光；背面的棱线仍可透视。
      const reflection = face.indices.length > 4 ? 0.085 : 0.18;
      face.path.setAttribute("fill-opacity", 0.012 + Math.pow(light, 6) * reflection + facing * 0.012);
      face.path.setAttribute("stroke", facetColor(0.6 + light * 0.35));
      face.path.setAttribute("stroke-opacity", 0.08 + facing * 0.29 + Math.pow(light, 3) * 0.34);
      return { path: face.path, depth: corners.reduce((sum, point) => sum + point[2], 0) / corners.length };
    });
    // 先绘制背面的切面，再绘制正面，形成珠宝的立体层次。
    faces.sort((a, b) => a.depth - b.depth).forEach(face => gem.container.appendChild(face.path));
  }

  let frame = 0;
  let startedAt = 0;

  function tick(time) {
    currentAngle = initialAngle + ((time - startedAt) / (revolutionSeconds * 1000)) * Math.PI * 2;
    renderGem(body, currentAngle);
    frame = requestAnimationFrame(tick);
  }

  function updateMotion() {
    cancelAnimationFrame(frame);
    still.setAttribute("visibility", "hidden");
    crystal.setAttribute("visibility", "visible");
    currentAngle = initialAngle;
    renderGem(body, currentAngle);
    if (!reducedMotion.matches) {
      startedAt = performance.now();
      tick(startedAt);
    }
  }

  reducedMotion.addEventListener("change", updateMotion);
  darkMode.addEventListener("change", () => {
    updatePalette();
    renderGem(body, currentAngle);
  });
  updatePalette();
  updateMotion();
})();
