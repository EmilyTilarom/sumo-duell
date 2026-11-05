export const STEPS_PER_SECOND = 60;

export function createWorld() {
  return {
    step: 0,
    ring: { x: 400, y: 400, radius: 320 },
  };
}

export function stepWorld(world) {
  world.step += 1;
}
