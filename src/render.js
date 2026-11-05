export function render(ctx, world) {
  const { width, height } = ctx.canvas;
  const { x, y, radius } = world.ring;

  ctx.clearRect(0, 0, width, height);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#d9c49a";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#8a5a2b";
  ctx.stroke();
}
