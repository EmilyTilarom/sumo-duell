import { EXHAUSTED_BELOW, MAX_STAMINA } from "./game/actions.js";
import { RING_RADIUS, ROUND_STEPS } from "./game/rules.js";

const WIDTH = 960;
const HEIGHT = 640;
const PIXEL_RATIO = 1.5;

const CENTER_X = 480;
const CENTER_Y = 372;
const SCALE = 1.12;
// Die Plattform ist in der Logik ein Kreis, erst hier wird sie zum Oval gestaucht.
const SQUASH = 0.52;
const ROCK_DEPTH = 86;

const INK = "#2a1a2e";
const FONT = '"Arial Black", Impact, sans-serif';

const POPUPS = { blocked: "Geblockt!", braceBroken: "Durchbruch!", dodged: "Daneben!", punish: "Erwischt!" };
const SHAKE = { hit: 9, punish: 15, braceBroken: 13, blocked: 5, bump: 2.5, fall: 7, shrink: 6 };

function project(x, y) {
  return { x: CENTER_X + x * SCALE, y: CENTER_Y + y * SCALE * SQUASH };
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift) => {
    const c = (value >> shift) & 255;
    return Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount));
  };
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

function paintBackdrop(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#27216a");
  sky.addColorStop(0.45, "#a23b8e");
  sky.addColorStop(0.75, "#f2715f");
  sky.addColorStop(1, "#ffc56b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let i = 0; i < 60; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + ((i * 37) % 60) / 100})`;
    ctx.fillRect((i * 173) % WIDTH, (i * 89) % 230, 2, 2);
  }

  ctx.fillStyle = "#ffe29a";
  ellipse(ctx, 730, 300, 112, 112);
  ctx.fill();
  ctx.fillStyle = "rgba(255,226,154,0.25)";
  ellipse(ctx, 730, 300, 150, 150);
  ctx.fill();

  const ridges = [
    { color: "#7d2f7e", base: 500, height: 110, wave: 0.009 },
    { color: "#55246e", base: 550, height: 80, wave: 0.014 },
    { color: "#36195a", base: 600, height: 60, wave: 0.021 },
  ];
  for (const ridge of ridges) {
    ctx.fillStyle = ridge.color;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 12) {
      const y = ridge.base - Math.abs(Math.sin(x * ridge.wave) + 0.5 * Math.sin(x * ridge.wave * 2.3)) * ridge.height;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.fill();
  }
}

function drawCloud(ctx, x, y, size) {
  ctx.fillStyle = "rgba(255,236,220,0.82)";
  for (const [dx, dy, r] of [[-1.2, 0.1, 0.55], [-0.4, -0.3, 0.8], [0.5, -0.15, 0.65], [1.25, 0.15, 0.45]]) {
    ellipse(ctx, x + dx * size, y + dy * size, r * size * 1.2, r * size * 0.75);
    ctx.fill();
  }
}

function drawFloatingRock(ctx, x, y, size) {
  ctx.fillStyle = "#4a2a63";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size * 0.45, y + size * 0.7);
  ctx.lineTo(x + size * 0.05, y + size * 1.2);
  ctx.lineTo(x - size * 0.5, y + size * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#7fb069";
  ellipse(ctx, x, y, size, size * 0.26);
  ctx.fill();
  ctx.stroke();
}

function drawPlatform(ctx, radius, bob) {
  const rx = radius * SCALE;
  const ry = rx * SQUASH;
  const y = CENTER_Y + bob;
  const depth = ROCK_DEPTH * (radius / RING_RADIUS);

  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";

  const rock = ctx.createLinearGradient(0, y, 0, y + ry + depth);
  rock.addColorStop(0, "#8a5a3c");
  rock.addColorStop(1, "#3f2440");
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(CENTER_X - rx, y);
  ctx.quadraticCurveTo(CENTER_X - rx * 0.92, y + ry + depth * 0.25, CENTER_X - rx * 0.5, y + ry + depth * 0.55);
  ctx.lineTo(CENTER_X - rx * 0.22, y + ry + depth * 0.72);
  ctx.lineTo(CENTER_X, y + ry + depth);
  ctx.lineTo(CENTER_X + rx * 0.26, y + ry + depth * 0.66);
  ctx.lineTo(CENTER_X + rx * 0.55, y + ry + depth * 0.5);
  ctx.quadraticCurveTo(CENTER_X + rx * 0.93, y + ry + depth * 0.22, CENTER_X + rx, y);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#b5733f";
  ellipse(ctx, CENTER_X, y + 16 * (radius / RING_RADIUS), rx, ry);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e8c98a";
  ellipse(ctx, CENTER_X, y, rx, ry);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f2dba6";
  ellipse(ctx, CENTER_X, y, rx * 0.86, ry * 0.86);
  ctx.fill();

  ctx.lineWidth = 7;
  ctx.strokeStyle = "#a9833e";
  ctx.setLineDash([16, 9]);
  ellipse(ctx, CENTER_X, y, rx * 0.9, ry * 0.9);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(169,131,62,0.7)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CENTER_X + side * rx * 0.13, y - ry * 0.12);
    ctx.lineTo(CENTER_X + side * rx * 0.13, y + ry * 0.12);
    ctx.stroke();
  }
}

function drawHair(ctx, kind, r, away, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  if (kind === "bun") {
    ellipse(ctx, 0, -r * 1.05, r * 0.3, r * 0.24);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "spikes" || kind === "crown") {
    for (const angle of [-0.6, -0.2, 0.2, 0.6]) {
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 0.92);
      ctx.lineTo(0, -r * 1.3);
      ctx.lineTo(r * 0.15, -r * 0.92);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else if (kind === "band") {
    ctx.lineWidth = r * 0.16;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, away ? 1.2 * Math.PI : 1.13 * Math.PI, away ? 1.8 * Math.PI : 1.87 * Math.PI);
    ctx.stroke();
  } else if (kind === "stem" || kind === "leaf") {
    ctx.lineWidth = r * 0.13;
    ctx.strokeStyle = "#5a3a1e";
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.92);
    ctx.lineTo(r * 0.07, -r * 1.22);
    ctx.stroke();
    if (kind === "leaf") {
      ctx.fillStyle = "#3f9e4a";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(r * 0.34, -r * 1.14, r * 0.28, r * 0.13, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

// Feste Punkte, damit Muster beim Zeichnen nicht flackern.
const SPOTS = [[-0.7, -0.5], [-0.3, -0.75], [0.25, -0.7], [0.7, -0.45], [-0.85, 0], [-0.5, 0.15], [0, -0.1], [0.5, 0.1], [0.85, 0.05], [-0.65, 0.55], [-0.2, 0.5], [0.25, 0.6], [0.65, 0.55], [0, 0.85]];

function drawPattern(ctx, pattern, r) {
  if (pattern === "stripes") {
    ctx.strokeStyle = "#1f6b35";
    ctx.lineWidth = r * 0.14;
    for (const bend of [-0.9, -0.45, 0, 0.45, 0.9]) {
      ctx.beginPath();
      ctx.moveTo(bend * r * 0.5, -r);
      ctx.quadraticCurveTo(bend * r * 1.5, 0, bend * r * 0.5, r);
      ctx.stroke();
    }
  } else if (pattern === "grid") {
    ctx.strokeStyle = "rgba(150,90,20,0.75)";
    ctx.lineWidth = 3;
    for (let offset = -2; offset <= 2; offset += 0.5) {
      ctx.beginPath();
      ctx.moveTo(offset * r - r, -r);
      ctx.lineTo(offset * r + r, r);
      ctx.moveTo(offset * r + r, -r);
      ctx.lineTo(offset * r - r, r);
      ctx.stroke();
    }
  } else {
    const style = { pores: ["rgba(120,70,0,0.35)", 0.035], fuzz: ["rgba(40,22,10,0.5)", 0.05], seeds: ["#2a1a2e", 0.05] }[pattern];
    ctx.fillStyle = style[0];
    for (const [x, y] of SPOTS) {
      ellipse(ctx, x * r, y * r, r * style[1], r * style[1]);
      ctx.fill();
    }
  }
}

function drawFlag(ctx, flag, r) {
  if (flag.emblem) {
    ctx.fillStyle = flag.base;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = flag.mark;
    if (flag.emblem === "disc") {
      ellipse(ctx, 0, r * 0.1, r * 0.48, r * 0.48);
      ctx.fill();
    } else {
      ctx.fillRect(-r * 0.56, -r * 0.1, r * 1.12, r * 0.36);
      ctx.fillRect(-r * 0.18, -r * 0.48, r * 0.36, r * 1.12);
    }
    return;
  }
  const band = (r * 2) / flag.colors.length;
  flag.colors.forEach((color, i) => {
    ctx.fillStyle = color;
    if (flag.dir === "h") ctx.fillRect(-r, -r + band * i, r * 2, band + 1);
    else ctx.fillRect(-r + band * i, -r, band + 1, r * 2);
  });
}

function drawCoin(ctx, coin, r) {
  ctx.strokeStyle = coin.rim;
  ctx.lineWidth = r * 0.12;
  ellipse(ctx, 0, 0, r * 0.84, r * 0.82);
  ctx.stroke();
  ctx.font = `${r * (coin.text.length > 3 ? 0.3 : 0.36)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.fillStyle = "#fff8e0";
  ctx.strokeText(coin.text, 0, r * 0.68);
  ctx.fillText(coin.text, 0, r * 0.68);
}

function drawFace(ctx, f, r, lookX, lookY) {
  const faceX = lookX * r * 0.42;
  const faceY = lookY * r * 0.18 - r * 0.12;
  const hurt = f.state === "staggered" || f.out;
  const angry = f.state === "charging" || f.state === "rushing";

  for (const side of [-1, 1]) {
    const eyeX = faceX + side * r * 0.3;
    if (hurt) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(eyeX - 6, faceY - 6);
      ctx.lineTo(eyeX + 6, faceY + 6);
      ctx.moveTo(eyeX + 6, faceY - 6);
      ctx.lineTo(eyeX - 6, faceY + 6);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ellipse(ctx, eyeX, faceY, r * 0.15, r * 0.17);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ellipse(ctx, eyeX + lookX * r * 0.06, faceY + lookY * r * 0.05, r * 0.07, r * 0.08);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(eyeX - side * r * 0.2, faceY - r * (angry ? 0.3 : 0.25));
    ctx.lineTo(eyeX + side * r * 0.14, faceY - r * (angry ? 0.14 : 0.27));
    ctx.stroke();
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (hurt || angry) ellipse(ctx, faceX, faceY + r * 0.36, r * 0.15, r * 0.12);
  else ctx.arc(faceX, faceY + r * 0.24, r * 0.17, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

function drawBody(ctx, f, look, r, stepPhase) {
  const lookX = Math.cos(f.facing);
  const lookY = Math.sin(f.facing);
  const away = lookY < -0.55;

  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.fillStyle = shade(look.body, -0.2);
  for (const side of [-1, 1]) {
    const lift = Math.max(0, Math.sin(stepPhase + (side > 0 ? 0 : Math.PI))) * 8;
    ellipse(ctx, side * r * 0.55, -r * 0.1 - lift, r * 0.34, r * 0.24);
    ctx.fill();
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(0, -r);

  const reach = f.state === "rushing" || f.state === "charging" ? 1.28 : f.state === "bracing" ? 1.15 : 1.02;
  ctx.fillStyle = shade(look.body, -0.1);
  for (const side of [-1, 1]) {
    const handX = side * r * reach * (0.6 + 0.4 * (1 - Math.abs(lookX))) + lookX * r * 0.45;
    const handY = r * 0.1 + lookY * r * 0.32;
    if (!away) continue;
    ellipse(ctx, handX, handY, r * 0.3, r * 0.26);
    ctx.fill();
    ctx.stroke();
  }

  ellipse(ctx, 0, 0, r, r * 0.98);
  ctx.fillStyle = look.body;
  ctx.fill();

  ctx.save();
  ctx.clip();
  if (look.flag) drawFlag(ctx, look.flag, r);
  if (look.pattern) drawPattern(ctx, look.pattern, r);
  ctx.fillStyle = look.flag ? "rgba(255,255,255,0.2)" : shade(look.body, 0.28);
  ellipse(ctx, lookX * r * 0.25 - r * 0.15, -r * 0.3, r * 0.55, r * 0.42);
  ctx.fill();
  if (look.belt) {
    ctx.fillStyle = look.belt;
    ctx.fillRect(-r, r * 0.34, r * 2, r * 0.34);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(-r - 2, r * 0.34, r * 2 + 4, r * 0.34);
  }
  if (look.coin) drawCoin(ctx, look.coin, r);
  ctx.restore();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ellipse(ctx, 0, 0, r, r * 0.98);
  ctx.stroke();

  drawHair(ctx, look.hair, r, away, look.hair === "bun" ? INK : look.hair === "crown" ? "#3f9e4a" : look.belt);
  if (!away) drawFace(ctx, f, r, lookX, lookY);

  ctx.lineWidth = 5;
  ctx.fillStyle = shade(look.body, -0.1);
  for (const side of [-1, 1]) {
    const handX = side * r * reach * (0.6 + 0.4 * (1 - Math.abs(lookX))) + lookX * r * 0.45;
    const handY = r * 0.1 + lookY * r * 0.32;
    if (away) continue;
    ellipse(ctx, handX, handY, r * 0.3, r * 0.26);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSkinPreview(canvas, look) {
  const ctx = canvas.getContext("2d");
  const r = canvas.width * 0.34;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height * 0.93);
  drawBody(ctx, { state: "idle", facing: Math.PI / 2, out: false }, look, r, 0);
  ctx.restore();
}

function stretchFor(f, now) {
  const pulse = Math.sin(now * 0.05);
  switch (f.state) {
    case "charging":
      return { sx: 1.05 + 0.1 * f.charge, sy: 0.97 - 0.09 * f.charge, tilt: pulse * 0.02 * f.charge };
    case "rushing":
      return { sx: 1.08, sy: 0.92, tilt: Math.cos(f.facing) * 0.28 };
    case "bracing":
      return { sx: 1.17, sy: 0.86, tilt: 0 };
    case "dodging":
      return { sx: 0.88, sy: 1.08, tilt: 0 };
    case "staggered":
      return { sx: 1, sy: 1, tilt: Math.sin(now * 0.03) * 0.2 };
    default:
      return { sx: 1, sy: 1, tilt: 0 };
  }
}

export function createRenderer(canvas) {
  canvas.width = WIDTH * PIXEL_RATIO;
  canvas.height = HEIGHT * PIXEL_RATIO;
  const ctx = canvas.getContext("2d");

  const backdrop = document.createElement("canvas");
  backdrop.width = canvas.width;
  backdrop.height = canvas.height;
  const backdropCtx = backdrop.getContext("2d");
  backdropCtx.scale(PIXEL_RATIO, PIXEL_RATIO);
  paintBackdrop(backdropCtx);

  let shake = 0;
  let notices = [];
  let particles = [];
  let popups = [];
  let trails = [];
  let lastDraw = 0;

  function burst(x, y, count, colors, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.4 + Math.random() * 0.6);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity * 0.6 - 1,
        life: 1,
        size: 3 + Math.random() * 6,
        color: colors[i % colors.length],
      });
    }
  }

  function onEvent(event) {
    shake = Math.max(shake, SHAKE[event.type] ?? 0);
    if (POPUPS[event.type]) {
      const at = project(event.x, event.y);
      popups.push({ text: POPUPS[event.type], x: at.x, y: at.y - 110, life: 1 });
    }
    if (event.x === undefined) return;
    const at = project(event.x, event.y);
    if (event.type === "hit" || event.type === "punish" || event.type === "braceBroken") {
      burst(at.x, at.y - 45, 24, ["#fff4b0", "#ffb03a", "#ff6a3c"], 7);
    } else if (event.type === "blocked") {
      burst(at.x, at.y - 45, 12, ["#bfe6ff", "#ffffff"], 5);
    } else if (event.type === "rush" || event.type === "dodge" || event.type === "bump") {
      burst(at.x, at.y, 10, ["#e6cf9e", "#c9a56b"], 3.5);
    } else if (event.type === "fall") {
      burst(at.x, at.y, 16, ["#e6cf9e", "#b5733f"], 4.5);
    }
  }

  function updateEffects(dt) {
    const frames = dt / (1000 / 60);
    shake *= Math.pow(0.86, frames);
    for (const p of particles) {
      p.x += p.vx * frames;
      p.y += p.vy * frames;
      p.vy += 0.12 * frames;
      p.life -= 0.03 * frames;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const popup of popups) {
      popup.y -= 0.7 * frames;
      popup.life -= 0.018 * frames;
    }
    popups = popups.filter((popup) => popup.life > 0);
    for (const trail of trails) trail.life -= 0.09 * frames;
    trails = trails.filter((trail) => trail.life > 0);
  }

  function drawScenery(now) {
    ctx.drawImage(backdrop, 0, 0, WIDTH, HEIGHT);
    const drift = now * 0.008;
    drawCloud(ctx, ((drift * 0.7 + 140) % (WIDTH + 240)) - 120, 150, 42);
    drawCloud(ctx, ((drift * 1.1 + 640) % (WIDTH + 240)) - 120, 225, 30);
    drawCloud(ctx, ((drift * 0.45 + 380) % (WIDTH + 240)) - 120, 95, 24);
    drawFloatingRock(ctx, 88, 300 + Math.sin(now * 0.0011) * 8, 40);
    drawFloatingRock(ctx, 882, 455 + Math.sin(now * 0.0009 + 2) * 10, 54);
    drawFloatingRock(ctx, 176, 505 + Math.sin(now * 0.0013 + 1) * 6, 26);
  }

  function drawFighter(f, look, tag, bob, now) {
    const at = project(f.x, f.y);
    const r = f.radius * SCALE;
    const fallDrop = f.fall * f.fall * 0.14;

    if (f.state === "dodging" || f.state === "rushing") trails.push({ x: at.x, y: at.y + bob, r, life: 0.6 });

    if (!f.out) {
      ctx.fillStyle = "rgba(42,26,46,0.32)";
      ellipse(ctx, at.x, at.y + bob, r * 1.05, r * 0.46);
      ctx.fill();
    }

    if (f.state === "bracing") {
      ctx.strokeStyle = "rgba(120,205,255,0.85)";
      ctx.lineWidth = 5;
      ellipse(ctx, at.x, at.y + bob, r * 1.35, r * 0.68);
      ctx.stroke();
    }

    if (!f.out) {
      const tipX = at.x + Math.cos(f.facing) * r * 1.5;
      const tipY = at.y + bob + Math.sin(f.facing) * r * 1.5 * SQUASH;
      ctx.fillStyle = f.state === "charging" && f.charge >= 1 ? "#ff5a36" : "rgba(42,26,46,0.45)";
      ellipse(ctx, tipX, tipY, 8, 5);
      ctx.fill();
    }

    const { sx, sy, tilt } = stretchFor(f, now);
    ctx.save();
    ctx.translate(at.x, at.y + bob + fallDrop);
    ctx.rotate(tilt + (f.out ? f.fall * 0.09 : 0));
    ctx.scale(sx, sy);
    drawBody(ctx, f, look, r, (f.x + f.y) * 0.05);
    ctx.restore();

    if (f.state === "charging") {
      ctx.lineWidth = 8;
      ctx.strokeStyle = f.charge >= 1 ? "#ff5a36" : "#ffc23d";
      ctx.beginPath();
      ctx.arc(at.x, at.y + bob - r * 2.45, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.charge);
      ctx.stroke();
    }

    if (!f.out && tag) {
      ctx.font = `15px ${FONT}`;
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = INK;
      ctx.fillStyle = "#fff4dc";
      ctx.strokeText(tag, at.x, at.y + bob - r * 2.3);
      ctx.fillText(tag, at.x, at.y + bob - r * 2.3);
    }
  }

  function drawTrails() {
    for (const trail of trails) {
      ctx.fillStyle = `rgba(255,244,220,${trail.life * 0.3})`;
      ellipse(ctx, trail.x, trail.y - trail.r, trail.r, trail.r);
      ctx.fill();
    }
  }

  // Ringer 1 und 3 links, 2 und 4 rechts, jeweils untereinander.
  function drawPanel(index, name, f, wins) {
    const left = index % 2 === 0;
    const top = Math.floor(index / 2) * 68;
    const x = left ? 20 : WIDTH - 300;
    ctx.save();
    ctx.translate(0, top);
    ctx.globalAlpha = f.out ? 0.5 : 1;
    ctx.fillStyle = "rgba(29,21,48,0.72)";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, 14, 280, 62, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font = `18px ${FONT}`;
    ctx.textAlign = left ? "left" : "right";
    ctx.fillStyle = "#fff4dc";
    ctx.fillText(name, left ? x + 14 : x + 266, 38);

    const barX = x + 14;
    ctx.fillStyle = "#3a2c50";
    ctx.fillRect(barX, 50, 252, 14);
    ctx.fillStyle = f.stamina < EXHAUSTED_BELOW ? "#ff5a36" : "#7fe08a";
    const width = 252 * (f.stamina / MAX_STAMINA);
    ctx.fillRect(left ? barX : barX + 252 - width, 50, width, 14);
    ctx.strokeStyle = "#fff4dc";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, 50, 252, 14);

    for (let i = 0; i < 2; i += 1) {
      const pipX = left ? x + 300 + i * 26 : x - 20 - i * 26;
      ctx.fillStyle = i < wins ? "#f4b63f" : "rgba(29,21,48,0.6)";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ellipse(ctx, pipX, 30, 10, 10);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function outlinedText(text, x, y, size, color = "#f4b63f") {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.lineWidth = size / 6;
    ctx.strokeStyle = INK;
    ctx.fillStyle = color;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  function drawClock(world) {
    const remaining = Math.ceil((ROUND_STEPS - world.roundStep) / 60);
    if (remaining > 0) outlinedText(String(remaining), WIDTH / 2, 56, 34, remaining <= 10 ? "#ff8a5c" : "#fff4dc");
    else outlinedText("Plattform schrumpft!", WIDTH / 2, 56, 24, "#ff8a5c");
  }

  function drawBanner(world, labels) {
    if (world.phase === "countdown") {
      const count = Math.ceil(world.phaseTimer / 50);
      outlinedText(`Runde ${world.round}`, WIDTH / 2, 230, 44, "#fff4dc");
      outlinedText(String(count), WIDTH / 2, 320, 96);
    } else if (world.phase === "fight" && world.roundStep < 45) {
      outlinedText("Los!", WIDTH / 2, 300, 96, "#ff8a5c");
    } else if (world.phase === "roundEnd") {
      if (world.roundWinner === "draw") {
        outlinedText("Unentschieden", WIDTH / 2, 270, 54);
        outlinedText("Die Runde wird wiederholt", WIDTH / 2, 320, 24, "#fff4dc");
      } else {
        outlinedText("Ring-out!", WIDTH / 2, 270, 66);
        outlinedText(`Runde für ${labels.teamNames[world.roundWinner]}`, WIDTH / 2, 320, 26, "#fff4dc");
      }
    }
  }

  function notify(text) {
    notices.push({ text, until: performance.now() + 4500 });
  }

  function drawNotices(now) {
    notices = notices.filter((notice) => notice.until > now);
    notices.forEach((notice, i) => outlinedText(notice.text, WIDTH / 2, HEIGHT - 26 - i * 30, 20, "#fff4dc"));
  }

  function draw(world, labels, now) {
    updateEffects(Math.min(now - lastDraw, 100));
    lastDraw = now;

    ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
    drawScenery(now);

    const bob = Math.sin(now * 0.0016) * 4;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    if (!world) {
      drawPlatform(ctx, RING_RADIUS, bob);
      ctx.restore();
      return;
    }

    const order = world.fighters.map((f, i) => ({ f, i })).sort((a, b) => a.f.y - b.f.y);
    const tag = (i) => labels.tags?.[i] ?? null;
    for (const { f, i } of order) if (f.out && f.y < 0) drawFighter(f, labels.looks[i], null, bob, now);
    drawPlatform(ctx, world.ring.radius, bob);
    drawTrails();
    for (const { f, i } of order) if (!f.out) drawFighter(f, labels.looks[i], tag(i), bob, now);
    for (const { f, i } of order) if (f.out && f.y >= 0) drawFighter(f, labels.looks[i], null, bob, now);

    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ellipse(ctx, p.x, p.y, p.size, p.size);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const popup of popups) {
      ctx.globalAlpha = Math.min(1, popup.life * 2);
      outlinedText(popup.text, popup.x, popup.y, 26, "#fff4b0");
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    world.fighters.forEach((f, i) => drawPanel(i, labels.names[i], f, world.scores[f.team]));
    drawClock(world);
    drawBanner(world, labels);
    drawNotices(now);
  }

  return { draw, onEvent, notify };
}

