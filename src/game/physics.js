export const DRAG = 0.978;
export const MOVE_ACCEL = 0.07;
export const RESTITUTION = 0.15;

export function integrate(body, ax, ay, drag) {
  body.vx = (body.vx + ax) * drag;
  body.vy = (body.vy + ay) * drag;
  body.x += body.vx;
  body.y += body.vy;
}

export function isOverlapping(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y) < a.radius + b.radius;
}

// Einheitsvektor von a nach b. Liegen beide exakt aufeinander, gilt die x-Achse.
export function normalBetween(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  return distance === 0 ? { x: 1, y: 0 } : { x: dx / distance, y: dy / distance };
}

// Schiebt zwei überlappende Körper auseinander, der leichtere weicht weiter.
export function separate(a, b, massA, massB) {
  const n = normalBetween(a, b);
  const depth = a.radius + b.radius - Math.hypot(b.x - a.x, b.y - a.y);
  if (depth <= 0) return;
  const shareA = massB / (massA + massB);
  a.x -= n.x * depth * shareA;
  a.y -= n.y * depth * shareA;
  b.x += n.x * depth * (1 - shareA);
  b.y += n.y * depth * (1 - shareA);
}

// Stoß entlang der Verbindungslinie. Gibt die Geschwindigkeit zurück, mit der beide aufeinandertrafen.
export function bounce(a, b, massA, massB, restitution = RESTITUTION) {
  const n = normalBetween(a, b);
  const closing = (a.vx - b.vx) * n.x + (a.vy - b.vy) * n.y;
  if (closing <= 0) return 0;
  const impulse = ((1 + restitution) * closing) / (1 / massA + 1 / massB);
  a.vx -= (impulse / massA) * n.x;
  a.vy -= (impulse / massA) * n.y;
  b.vx += (impulse / massB) * n.x;
  b.vy += (impulse / massB) * n.y;
  return closing;
}
