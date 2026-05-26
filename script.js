(function () {
  "use strict";

  const canvas = document.querySelector("#scribble-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colors = ["#9f31ff", "#04d9ff", "#4d20ff", "#f3ecff", "#1a072f"];
  const TAU = Math.PI * 2;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let start = performance.now();
  let motes = [];

  function random(seed) {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.floor(clamp((width * height) / 13000, 54, 130));
    motes = Array.from({ length: count }, (_, i) => ({
      seed: i + 1,
      radius: lerp(90, Math.max(width, height) * 0.72, random(i + 3)),
      speed: lerp(0.08, 0.42, random(i + 7)),
      angle: random(i + 11) * TAU,
      size: lerp(0.65, 2.8, random(i + 17)),
      color: colors[Math.floor(random(i + 23) * (colors.length - 1))]
    }));
  }

  function jitter(seed, amount, time, axis) {
    const a = Math.sin(seed * 4.71 + time * (1.3 + axis * 0.23));
    const b = Math.sin(seed * 12.93 + time * (2.1 + axis * 0.37));
    return (a * 0.62 + b * 0.38) * amount;
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    return {
      x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
      y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
    };
  }

  function makeCurve(p0, p1, p2, p3, steps) {
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      points.push(cubicPoint(p0, p1, p2, p3, i / steps));
    }
    return points;
  }

  function scribblePolyline(points, options) {
    const {
      color,
      alpha = 1,
      width: lineWidth = 1,
      passes = 3,
      shake = 2,
      time = 0,
      seed = 1,
      close = false,
      glow = false
    } = options;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowBlur = glow ? lineWidth * 4 : 0;
    ctx.shadowColor = color;

    for (let pass = 0; pass < passes; pass += 1) {
      ctx.beginPath();
      points.forEach((point, i) => {
        const s = seed + pass * 101 + i * 0.37;
        const x = point.x + jitter(s, shake, time, 0);
        const y = point.y + jitter(s, shake, time, 1);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      if (close) {
        ctx.closePath();
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  function eyeShape(cx, cy, eyeWidth, eyeHeight) {
    const left = { x: cx - eyeWidth / 2, y: cy };
    const right = { x: cx + eyeWidth / 2, y: cy };
    const upper = makeCurve(
      left,
      { x: cx - eyeWidth * 0.24, y: cy - eyeHeight * 1.12 },
      { x: cx + eyeWidth * 0.23, y: cy - eyeHeight * 1.06 },
      right,
      32
    );
    const lower = makeCurve(
      right,
      { x: cx + eyeWidth * 0.24, y: cy + eyeHeight * 0.78 },
      { x: cx - eyeWidth * 0.23, y: cy + eyeHeight * 0.82 },
      left,
      32
    );
    return { upper, lower, outline: upper.concat(lower) };
  }

  function clipEye(shape) {
    ctx.beginPath();
    shape.outline.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.clip();
  }

  function drawEye(cx, cy, scale, open, time, side) {
    const pulse = 1 + Math.sin(time * 5 + side) * 0.018;
    const eyeWidth = scale * 1.18 * pulse;
    const eyeHeight = scale * (0.035 + open * 0.27);
    const shape = eyeShape(cx, cy, eyeWidth, eyeHeight);
    const glow = easeInOut((open - 0.2) / 0.8);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, eyeWidth * 0.48);
    fill.addColorStop(0, `rgba(243, 236, 255, ${0.22 * glow})`);
    fill.addColorStop(0.42, `rgba(4, 217, 255, ${0.13 * glow})`);
    fill.addColorStop(1, "rgba(159, 49, 255, 0)");
    ctx.fillStyle = fill;
    ctx.beginPath();
    shape.outline.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    scribblePolyline(shape.outline, {
      color: "#f3ecff",
      alpha: 0.68 + glow * 0.2,
      width: Math.max(1.3, scale * 0.018),
      passes: 5,
      shake: scale * 0.012,
      time,
      seed: 50 + side,
      close: true,
      glow: true
    });
    scribblePolyline(shape.outline, {
      color: side < 0 ? "#9f31ff" : "#04d9ff",
      alpha: 0.75,
      width: Math.max(1.1, scale * 0.012),
      passes: 6,
      shake: scale * 0.026,
      time: time * 1.25,
      seed: 140 + side,
      close: true
    });

    ctx.save();
    clipEye(shape);
    ctx.globalCompositeOperation = "screen";

    const irisRadius = scale * (0.075 + open * 0.13);
    const pupilRadius = irisRadius * 0.42;
    const irisX = cx + Math.sin(time * 0.86 + side) * scale * 0.026;
    const irisY = cy + Math.cos(time * 1.06 + side) * scale * 0.012;

    for (let ring = 0; ring < 22; ring += 1) {
      const angle = (ring / 22) * TAU + time * 0.18 * side;
      const points = [];
      for (let i = 0; i <= 14; i += 1) {
        const r = lerp(pupilRadius * 0.8, irisRadius, i / 14);
        const wobble = Math.sin(i * 1.9 + ring + time * 5) * scale * 0.006;
        points.push({
          x: irisX + Math.cos(angle + i * 0.016) * (r + wobble),
          y: irisY + Math.sin(angle + i * 0.016) * (r + wobble)
        });
      }
      scribblePolyline(points, {
        color: ring % 2 ? "#04d9ff" : "#9f31ff",
        alpha: 0.42 + open * 0.22,
        width: Math.max(0.7, scale * 0.006),
        passes: 1,
        shake: scale * 0.005,
        time,
        seed: ring + side * 99,
        glow: true
      });
    }

    ctx.fillStyle = "#030009";
    ctx.shadowBlur = scale * 0.14;
    ctx.shadowColor = "#9f31ff";
    ctx.beginPath();
    ctx.arc(irisX, irisY, pupilRadius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(243, 236, 255, 0.86)";
    ctx.beginPath();
    ctx.arc(irisX - pupilRadius * 0.38, irisY - pupilRadius * 0.42, pupilRadius * 0.18, 0, TAU);
    ctx.fill();

    ctx.restore();

    const lashCount = 13;
    for (let i = 0; i < lashCount; i += 1) {
      const p = shape.upper[Math.floor((i / (lashCount - 1)) * (shape.upper.length - 1))];
      const lean = (i / (lashCount - 1) - 0.5) * scale * 0.12;
      const lash = [
        p,
        {
          x: p.x + lean + jitter(i + side * 8, scale * 0.015, time, 0),
          y: p.y - scale * (0.07 + random(i + side * 22) * 0.08) * open
        }
      ];
      scribblePolyline(lash, {
        color: i % 3 === 0 ? "#04d9ff" : "#9f31ff",
        alpha: 0.48 * open,
        width: Math.max(0.75, scale * 0.006),
        passes: 2,
        shake: scale * 0.01,
        time,
        seed: 500 + i + side
      });
    }
  }

  function drawBackground(time, open) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = reduceMotion ? "#020107" : `rgba(2, 1, 7, ${open < 0.95 ? 0.74 : 0.22})`;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const core = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.7);
    core.addColorStop(0, `rgba(159, 49, 255, ${0.06 + open * 0.22})`);
    core.addColorStop(0.24, `rgba(4, 217, 255, ${0.03 + open * 0.11})`);
    core.addColorStop(0.72, "rgba(77, 32, 255, 0.04)");
    core.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 18; i += 1) {
      const x = width * random(i + 90) + Math.sin(time * 0.25 + i) * width * 0.06;
      const y = height * random(i + 190) + Math.cos(time * 0.21 + i) * height * 0.05;
      const radius = lerp(90, 280, random(i + 290)) * (0.65 + open);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, i % 2 ? "rgba(4, 217, 255, 0.09)" : "rgba(159, 49, 255, 0.11)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }

  function drawScribbleStorm(time, open) {
    const centerX = width * 0.5;
    const centerY = height * 0.47;
    const active = easeInOut((open - 0.28) / 0.72);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    motes.forEach((mote, index) => {
      const spin = mote.angle + time * mote.speed * (index % 2 ? -1 : 1);
      const radius = mote.radius * (0.32 + active * 0.76);
      const baseX = centerX + Math.cos(spin) * radius * (0.86 + random(mote.seed) * 0.22);
      const baseY = centerY + Math.sin(spin * 0.78) * radius * (0.48 + random(mote.seed + 4) * 0.34);
      const points = [];
      const segments = 10 + Math.floor(random(mote.seed + 9) * 13);

      for (let i = 0; i <= segments; i += 1) {
        const p = i / segments;
        const curl = spin + p * TAU * (0.18 + random(mote.seed + 13) * 0.34);
        const wave = Math.sin(time * 3.6 + i * 1.7 + mote.seed) * (9 + active * 22);
        points.push({
          x: baseX + Math.cos(curl) * p * wave + jitter(mote.seed + i, 8 + active * 16, time, 0),
          y: baseY + Math.sin(curl * 1.4) * p * wave + jitter(mote.seed + i, 8 + active * 16, time, 1)
        });
      }

      scribblePolyline(points, {
        color: mote.color,
        alpha: (0.12 + random(mote.seed + 5) * 0.34) * active,
        width: mote.size,
        passes: 1 + Math.floor(random(mote.seed + 6) * 3),
        shake: 3 + active * 8,
        time,
        seed: mote.seed * 13,
        glow: index % 4 === 0
      });
    });

    for (let ring = 0; ring < 7; ring += 1) {
      const points = [];
      const radius = Math.min(width, height) * (0.22 + ring * 0.075) * (0.68 + active * 0.46);
      const segments = 80;
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * TAU + time * (0.04 + ring * 0.01) * (ring % 2 ? -1 : 1);
        const jag = Math.sin(a * (7 + ring) + time * 2.5) * (5 + active * 18);
        points.push({
          x: centerX + Math.cos(a) * (radius + jag),
          y: centerY + Math.sin(a) * (radius * 0.55 + jag * 0.75)
        });
      }

      scribblePolyline(points, {
        color: ring % 2 ? "#04d9ff" : "#9f31ff",
        alpha: (0.06 + ring * 0.018) * active,
        width: 1.1 + ring * 0.18,
        passes: 2,
        shake: 2.5 + ring * 0.6,
        time,
        seed: 800 + ring,
        close: true,
        glow: true
      });
    }
    ctx.restore();
  }

  function drawOpeningSlashes(time, open) {
    const flash = 1 - easeInOut((time - 1.1) / 2.7);
    if (flash <= 0) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 32; i += 1) {
      const y = height * random(i + 321);
      const x = width * random(i + 421);
      const length = lerp(width * 0.08, width * 0.34, random(i + 521)) * flash;
      const points = [];
      for (let p = 0; p < 9; p += 1) {
        points.push({
          x: x + p * length * 0.12 + jitter(i * 5 + p, 20, time, 0),
          y: y + Math.sin(p + time * 6 + i) * 18 + jitter(i * 7 + p, 10, time, 1)
        });
      }
      scribblePolyline(points, {
        color: i % 2 ? "#4d20ff" : "#04d9ff",
        alpha: 0.18 * flash * (0.3 + open),
        width: 1.2 + random(i + 8) * 2.2,
        passes: 2,
        shake: 4,
        time,
        seed: 1200 + i,
        glow: true
      });
    }
    ctx.restore();
  }

  function drawFrame(now) {
    const elapsed = reduceMotion ? 4.2 : (now - start) / 1000;
    const open = reduceMotion ? 1 : easeInOut((elapsed - 0.45) / 2.35);
    const scale = clamp(Math.min(width, height) * 0.33, 135, 330);
    const gap = clamp(width * 0.19, scale * 0.92, scale * 1.35);
    const y = height * 0.46 + Math.sin(elapsed * 0.72) * 5;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(elapsed, open);
    drawOpeningSlashes(elapsed, open);
    drawScribbleStorm(elapsed, open);

    drawEye(width * 0.5 - gap * 0.5, y, scale, open, elapsed, -1);
    drawEye(width * 0.5 + gap * 0.5, y, scale, open, elapsed, 1);

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, Math.min(width, height) * 0.1, width * 0.5, height * 0.48, Math.max(width, height) * 0.72);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(0.64, "rgba(60,0,120,0.2)");
    vignette.addColorStop(1, "rgba(0,0,0,0.95)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    if (!reduceMotion) {
      requestAnimationFrame(drawFrame);
    }
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(drawFrame);
})();
