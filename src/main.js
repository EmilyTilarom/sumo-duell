import { createAudio } from "./audio.js";
import { createAi, thinkAi } from "./game/ai.js";
import { LEVELS, loadProgress, recordWin, saveProgress } from "./game/campaign.js";
import { STEPS_PER_SECOND, createWorld, stepWorld } from "./game/world.js";
import { createKeyboard } from "./input.js";
import { createRenderer } from "./render.js";
import { hideOverlay, setHelp, showCampaign, showDialog, showMenu } from "./ui.js";

const STEP_MS = 1000 / STEPS_PER_SECOND;
// Nach einem Tab-Wechsel nicht alle verpassten Schritte nachholen.
const MAX_FRAME_MS = 250;
const MUTE_KEY = "sumoDuell.muted";
const PLAYER_ONE = { body: "#e4483c", belt: "#fff0d0", hair: "bun" };
const PLAYER_TWO = { body: "#3f86e8", belt: "#ffe08a", hair: "band" };

const storage = window.localStorage;
const renderer = createRenderer(document.getElementById("game"));
const keyboard = createKeyboard();
const audio = createAudio();
audio.muted = storage.getItem(MUTE_KEY) === "1";

let progress = loadProgress(storage);
let session = null;
let paused = false;
let lastTime = performance.now();
let accumulator = 0;

function openMenu() {
  session = null;
  keyboard.active = false;
  setHelp(null);
  showMenu({
    muted: audio.muted,
    onCampaign: () => {
      audio.unlock();
      openCampaign();
    },
    onVersus: () => {
      audio.unlock();
      startVersus();
    },
    onSound: () => {
      audio.muted = !audio.muted;
      storage.setItem(MUTE_KEY, audio.muted ? "1" : "0");
      openMenu();
    },
  });
}

function openCampaign() {
  session = null;
  keyboard.active = false;
  setHelp(null);
  showCampaign({ progress, onLevel: startLevel, onBack: openMenu });
}

function beginSession(next) {
  session = next;
  paused = false;
  keyboard.active = true;
  hideOverlay();
  setHelp(next.mode);
  document.activeElement?.blur();
}

function startVersus() {
  beginSession({
    mode: "versus",
    world: createWorld(),
    labels: { names: ["Spieler 1", "Spieler 2"], looks: [PLAYER_ONE, PLAYER_TWO] },
    controllers: [() => keyboard.read(0), () => keyboard.read(1)],
  });
}

function startLevel(level) {
  const entry = LEVELS[level - 1];
  const ai = createAi(entry.ai, Date.now() >>> 0);
  beginSession({
    mode: "campaign",
    level,
    world: createWorld({ masses: [1, entry.mass] }),
    labels: { names: ["Du", entry.name], looks: [PLAYER_ONE, entry] },
    controllers: [() => keyboard.read(0), (world) => thinkAi(ai, world, 1)],
  });
}

function finishMatch() {
  const { mode, level, world, labels } = session;
  keyboard.active = false;
  const winner = world.matchWinner;
  const score = `${world.scores[0]} : ${world.scores[1]}`;

  if (mode === "versus") {
    showDialog(`${labels.names[winner]} gewinnt`, `Endstand ${score}`, [
      ["again", "Noch ein Match", startVersus],
      ["menu", "Hauptmenü", openMenu],
    ]);
    return;
  }

  if (winner !== 0) {
    showDialog("Verloren", `${labels.names[1]} bleibt stehen. Endstand ${score}`, [
      ["again", "Nochmal", () => startLevel(level)],
      ["list", "Levelauswahl", openCampaign],
    ]);
    return;
  }

  progress = recordWin(progress, level);
  saveProgress(storage, progress);
  if (level === LEVELS.length) {
    showDialog("Kampagne geschafft", `${labels.names[1]} ist besiegt. Alle zehn Level sind geschafft!`, [
      ["list", "Levelauswahl", openCampaign],
      ["menu", "Hauptmenü", openMenu],
    ]);
    return;
  }
  showDialog("Gewonnen", `${labels.names[1]} ist besiegt. Level ${level + 1} ist frei.`, [
    ["next", "Nächstes Level", () => startLevel(level + 1)],
    ["list", "Levelauswahl", openCampaign],
  ]);
}

function pause() {
  paused = true;
  keyboard.active = false;
  showDialog("Pause", "Das Match wartet auf dich.", [
    ["resume", "Weiter", resume],
    ["quit", "Match beenden", session.mode === "campaign" ? openCampaign : openMenu],
  ]);
}

function resume() {
  paused = false;
  keyboard.active = true;
  hideOverlay();
  document.activeElement?.blur();
}

function advance() {
  const { world, controllers } = session;
  stepWorld(world, controllers.map((control) => control(world)));
  for (const event of world.events) {
    audio.play(event.type);
    renderer.onEvent(event);
  }
  if (world.phase === "matchEnd") finishMatch();
}

function frame(now) {
  accumulator += Math.min(now - lastTime, MAX_FRAME_MS);
  lastTime = now;

  while (accumulator >= STEP_MS) {
    accumulator -= STEP_MS;
    if (session && !paused && session.world.phase !== "matchEnd") advance();
  }

  renderer.draw(session?.world ?? null, session?.labels ?? null, now);
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (event.code !== "Escape" || !session || session.world.phase === "matchEnd") return;
  if (paused) resume();
  else pause();
});

if (import.meta.env.DEV) {
  window.__sumo = { advance, get session() { return session; } };
}

openMenu();
requestAnimationFrame(frame);
