import { createAudio } from "./audio.js";
import { createAi, thinkAi } from "./game/ai.js";
import { LEVELS, loadProgress, recordWin, saveProgress } from "./game/campaign.js";
import {
  LOSS_REWARD,
  VERSUS_REWARD,
  addCoins,
  buySkin,
  equipSkin,
  equippedLook,
  isOwned,
  loadShop,
  saveShop,
  winReward,
} from "./game/skins.js";
import { STEPS_PER_SECOND, createWorld, stepWorld } from "./game/world.js";
import { combineInputs, createKeyboard } from "./input.js";
import { createRenderer } from "./render.js";
import { createTouchControls } from "./touch.js";
import { hideOverlay, setHelp, showCampaign, showDialog, showGroupSetup, showMenu, showSkins } from "./ui.js";

const STEP_MS = 1000 / STEPS_PER_SECOND;
// Nach einem Tab-Wechsel nicht alle verpassten Schritte nachholen.
const MAX_FRAME_MS = 250;
const MUTE_KEY = "sumoDuell.muted";

const storage = window.localStorage;
const renderer = createRenderer(document.getElementById("game"));
const keyboard = createKeyboard();
const audio = createAudio();
const touch = createTouchControls(document.getElementById("touch"), { onPause: () => togglePause() });
const playerOne = () => combineInputs(keyboard.read(0), touch.read());
audio.muted = storage.getItem(MUTE_KEY) === "1";

let progress = loadProgress(storage);
let shop = loadShop(storage);
const skinView = { player: 0, collection: "fruit" };
const groupSetup = { mode: "ffa", count: 4, humans: 1, strength: "medium" };
// Stärke der KI im Modus mit mehr Ringern, gemessen an den Kampagnen-Leveln.
const GROUP_STRENGTH = { easy: 2, medium: 5, hard: 8 };
let session = null;
let paused = false;
let lastTime = performance.now();
let accumulator = 0;

function setPlaying(playing) {
  keyboard.active = playing;
  touch.setVisible(playing);
}

// Auf Touch-Geräten im Vollbild und quer spielen, soweit der Browser das erlaubt.
function goLandscape() {
  if (!touch.enabled) return;
  const lock = () => screen.orientation?.lock?.("landscape").catch(() => {});
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) lock();
  else document.documentElement.requestFullscreen().then(lock, () => {});
}

function openMenu() {
  session = null;
  setPlaying(false);
  setHelp(null);
  showMenu({
    muted: audio.muted,
    coins: shop.coins,
    onCampaign: () => {
      audio.unlock();
      openCampaign();
    },
    onVersus: () => {
      audio.unlock();
      startVersus();
    },
    onGroup: () => {
      audio.unlock();
      openGroupSetup();
    },
    onSkins: openSkins,
    onSound: () => {
      audio.muted = !audio.muted;
      storage.setItem(MUTE_KEY, audio.muted ? "1" : "0");
      openMenu();
    },
  });
}

function openCampaign() {
  session = null;
  setPlaying(false);
  setHelp(null);
  showCampaign({ progress, onLevel: startLevel, onBack: openMenu });
}

function updateShop(next) {
  shop = next;
  saveShop(storage, shop);
}

function reward(amount) {
  updateShop(addCoins(shop, amount));
  return `+${amount} Münzen`;
}

function openSkins() {
  showSkins({
    shop,
    progress,
    ...skinView,
    onPlayer: (player) => {
      skinView.player = player;
      openSkins();
    },
    onCollection: (collection) => {
      skinView.collection = collection;
      openSkins();
    },
    onPick: (id) => {
      const paid = isOwned(shop, progress, id) ? shop : buySkin(shop, progress, id);
      updateShop(equipSkin(paid, progress, skinView.player, id));
      openSkins();
    },
    onBack: openMenu,
  });
}

function openGroupSetup() {
  showGroupSetup({
    setup: groupSetup,
    onChange: (key, value) => {
      groupSetup[key] = value;
      openGroupSetup();
    },
    onStart: startGroup,
    onBack: openMenu,
  });
}

function startGroup() {
  const { mode, count, humans, strength } = groupSetup;
  const teams = mode === "team" ? [0, ...Array(count - 1).fill(1)] : [...Array(count).keys()];
  const level = GROUP_STRENGTH[strength];
  const names = [];
  const looks = [];
  const controllers = [];
  for (let i = 0; i < count; i += 1) {
    if (i < humans) {
      names.push(`Spieler ${i + 1}`);
      looks.push(equippedLook(shop, progress, i));
      controllers.push(i === 0 ? playerOne : () => keyboard.read(1));
      continue;
    }
    // Jeder KI-Platz trägt das Aussehen eines anderen Kampagnen-Gegners, gespielt wird mit der gewählten Stärke.
    const opponent = LEVELS[(level + i * 3) % LEVELS.length];
    const ai = createAi(LEVELS[level - 1].ai, (Date.now() + i * 7919) >>> 0);
    names.push(opponent.name);
    looks.push(opponent);
    controllers.push((world) => thinkAi(ai, world, i));
  }
  const teamNames = mode === "team" ? [names[0], "Team"] : names;
  const tags = names.map((_, i) => (i < humans ? (humans === 1 ? "Du" : `P${i + 1}`) : null));
  beginSession({
    mode: "group",
    humans,
    world: createWorld({ masses: Array(count).fill(1), teams }),
    labels: { names, teamNames, looks, tags },
    controllers,
  });
}

function beginSession(next) {
  session = next;
  paused = false;
  setPlaying(true);
  hideOverlay();
  setHelp(next.humans);
  document.activeElement?.blur();
  goLandscape();
}

function startVersus() {
  const names = ["Spieler 1", "Spieler 2"];
  beginSession({
    mode: "versus",
    humans: 2,
    world: createWorld(),
    labels: { names, teamNames: names, looks: [equippedLook(shop, progress, 0), equippedLook(shop, progress, 1)] },
    controllers: [playerOne, () => keyboard.read(1)],
  });
}

function startLevel(level) {
  const entry = LEVELS[level - 1];
  const ai = createAi(entry.ai, Date.now() >>> 0);
  const names = ["Du", entry.name];
  beginSession({
    mode: "campaign",
    humans: 1,
    level,
    world: createWorld({ masses: [1, entry.mass] }),
    labels: { names, teamNames: names, looks: [equippedLook(shop, progress, 0), entry], tags: ["Du", null] },
    controllers: [playerOne, (world) => thinkAi(ai, world, 1)],
  });
}

function finishMatch() {
  const { mode, level, world, labels } = session;
  setPlaying(false);
  const winner = world.matchWinner;
  const score = world.scores.join(" : ");

  if (mode !== "campaign") {
    showDialog(`${labels.teamNames[winner]} gewinnt`, `Endstand ${score} · ${reward(VERSUS_REWARD)}`, [
      ["again", "Noch ein Match", mode === "versus" ? startVersus : startGroup],
      ["menu", "Hauptmenü", openMenu],
    ]);
    return;
  }

  if (winner !== 0) {
    showDialog("Verloren", `${labels.names[1]} bleibt stehen. Endstand ${score} · ${reward(LOSS_REWARD)}`, [
      ["again", "Nochmal", () => startLevel(level)],
      ["list", "Levelauswahl", openCampaign],
    ]);
    return;
  }

  const coins = reward(winReward(level, level > progress.beaten));
  progress = recordWin(progress, level);
  saveProgress(storage, progress);
  if (level === LEVELS.length) {
    showDialog("Kampagne geschafft", `${labels.names[1]} ist besiegt. Alle zehn Level sind geschafft! ${coins}`, [
      ["list", "Levelauswahl", openCampaign],
      ["menu", "Hauptmenü", openMenu],
    ]);
    return;
  }
  showDialog("Gewonnen", `${labels.names[1]} ist besiegt. Level ${level + 1} ist frei. ${coins}`, [
    ["next", "Nächstes Level", () => startLevel(level + 1)],
    ["list", "Levelauswahl", openCampaign],
  ]);
}

function pause() {
  paused = true;
  setPlaying(false);
  showDialog("Pause", "Das Match wartet auf dich.", [
    ["resume", "Weiter", resume],
    ["quit", "Match beenden", session.mode === "campaign" ? openCampaign : openMenu],
  ]);
}

function resume() {
  paused = false;
  setPlaying(true);
  hideOverlay();
  document.activeElement?.blur();
}

function togglePause() {
  if (!session || session.world.phase === "matchEnd") return;
  if (paused) resume();
  else pause();
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
  if (event.code === "Escape") togglePause();
});

if (import.meta.env.DEV) {
  window.__sumo = { advance, get session() { return session; } };
}

openMenu();
requestAnimationFrame(frame);
