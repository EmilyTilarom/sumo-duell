import { createWorld, stepWorld, STEPS_PER_SECOND } from "./game/world.js";
import { render } from "./render.js";

const STEP_MS = 1000 / STEPS_PER_SECOND;
// Nach einem Tab-Wechsel nicht alle verpassten Schritte nachholen.
const MAX_FRAME_MS = 250;

const ctx = document.getElementById("game").getContext("2d");
const world = createWorld();

let lastTime = performance.now();
let accumulator = 0;

function frame(now) {
  accumulator += Math.min(now - lastTime, MAX_FRAME_MS);
  lastTime = now;

  while (accumulator >= STEP_MS) {
    stepWorld(world);
    accumulator -= STEP_MS;
  }

  render(ctx, world);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
