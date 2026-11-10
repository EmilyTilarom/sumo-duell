const STICK_RANGE = 56;
const DEADZONE = 0.15;
const BUTTONS = [
  ["dodge", "Ausweichen"],
  ["brace", "Stemmen"],
  ["charge", "Stoß"],
];

function isTouchFirst() {
  return window.matchMedia("(pointer: coarse)").matches;
}

// Virtueller Joystick links, drei Halteknöpfe rechts. Jeder Finger wird über seine pointerId verfolgt.
export function createTouchControls(root, { onPause }) {
  root.innerHTML = `
    <div class="stick-zone"><div class="stick"><div class="knob"></div></div></div>
    <div class="pads">${BUTTONS.map(([action, label]) => `<button type="button" data-hold="${action}">${label}</button>`).join("")}</div>
    <button type="button" class="pause" aria-label="Pause">II</button>`;

  const zone = root.querySelector(".stick-zone");
  const stick = root.querySelector(".stick");
  const knob = root.querySelector(".knob");
  const state = { x: 0, y: 0, charge: false, brace: false, dodge: false };
  const held = new Map();
  let stickPointer = null;
  let origin = null;
  let enabled = isTouchFirst();
  let wanted = false;

  function resetStick() {
    stickPointer = null;
    state.x = 0;
    state.y = 0;
    knob.style.transform = "";
    stick.style.left = "";
    stick.style.top = "";
  }

  function moveStick(event) {
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    const length = Math.hypot(dx, dy);
    const scale = length > STICK_RANGE ? STICK_RANGE / length : 1;
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    const strength = Math.min(1, length / STICK_RANGE);
    const active = strength > DEADZONE && length > 0;
    state.x = active ? (dx / length) * strength : 0;
    state.y = active ? (dy / length) * strength : 0;
  }

  zone.addEventListener("pointerdown", (event) => {
    if (stickPointer !== null) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    origin = { x: event.clientX, y: event.clientY };
    const box = zone.getBoundingClientRect();
    stick.style.left = `${event.clientX - box.left}px`;
    stick.style.top = `${event.clientY - box.top}px`;
    moveStick(event);
  });

  for (const button of root.querySelectorAll("[data-hold]")) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      held.set(event.pointerId, button);
      state[button.dataset.hold] = true;
      button.classList.add("down");
    });
  }

  root.querySelector(".pause").addEventListener("click", () => onPause());
  root.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("pointermove", (event) => {
    if (event.pointerId === stickPointer) moveStick(event);
  });

  function release(event) {
    if (event.pointerId === stickPointer) resetStick();
    const button = held.get(event.pointerId);
    if (!button) return;
    held.delete(event.pointerId);
    if (![...held.values()].includes(button)) {
      state[button.dataset.hold] = false;
      button.classList.remove("down");
    }
  }
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);

  // Ein Gerät mit Maus und Touchscreen zeigt die Steuerung erst nach der ersten Berührung.
  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" || enabled) return;
    enabled = true;
    root.hidden = !wanted;
  });

  function releaseAll() {
    resetStick();
    held.clear();
    for (const [action] of BUTTONS) state[action] = false;
    for (const button of root.querySelectorAll("[data-hold]")) button.classList.remove("down");
  }

  return {
    get enabled() {
      return enabled;
    },
    read: () => ({ ...state }),
    setVisible(visible) {
      wanted = visible;
      root.hidden = !(visible && enabled);
      if (!visible) releaseAll();
    },
  };
}
