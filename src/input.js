// event.code meint die Taste selbst: "Slash" liegt auf dem deutschen Layout auf "-".
const BINDINGS = [
  { up: "KeyW", left: "KeyA", down: "KeyS", right: "KeyD", charge: "KeyF", brace: "KeyG", dodge: "KeyH" },
  { up: "ArrowUp", left: "ArrowLeft", down: "ArrowDown", right: "ArrowRight", charge: "Comma", brace: "Period", dodge: "Slash" },
];

const GAME_KEYS = new Set(BINDINGS.flatMap((binding) => Object.values(binding)));

// Die Satzzeichen zählen auch dann, wenn sie auf einem anderen Layout woanders liegen.
const SYMBOLS = { ",": "Comma", ".": "Period", "-": "Slash" };

function keyOf(event) {
  return SYMBOLS[event.key] ?? event.code;
}

// Tastatur und Touch steuern gemeinsam denselben Ringer.
export function combineInputs(a, b) {
  const useB = a.x === 0 && a.y === 0;
  return {
    x: useB ? b.x : a.x,
    y: useB ? b.y : a.y,
    charge: a.charge || b.charge,
    brace: a.brace || b.brace,
    dodge: a.dodge || b.dodge,
  };
}

export function createKeyboard() {
  const pressed = new Set();
  const keyboard = {
    active: false,
    read(player) {
      const keys = BINDINGS[player];
      return {
        x: Number(pressed.has(keys.right)) - Number(pressed.has(keys.left)),
        y: Number(pressed.has(keys.down)) - Number(pressed.has(keys.up)),
        charge: pressed.has(keys.charge),
        brace: pressed.has(keys.brace),
        dodge: pressed.has(keys.dodge),
      };
    },
  };

  window.addEventListener("keydown", (event) => {
    const key = keyOf(event);
    if (!GAME_KEYS.has(key) || !keyboard.active) return;
    event.preventDefault();
    pressed.add(key);
  });
  window.addEventListener("keyup", (event) => pressed.delete(keyOf(event)));
  window.addEventListener("blur", () => pressed.clear());

  return keyboard;
}
