import { LEVELS, isUnlocked } from "./game/campaign.js";

const overlay = document.getElementById("overlay");
const help = document.getElementById("help");

const ONE_PLAYER_HELP =
  "<kbd>W A S D</kbd> bewegen · <kbd>F</kbd> Stoß halten und loslassen · <kbd>G</kbd> Stemmen · <kbd>H</kbd> Ausweichen · <kbd>Esc</kbd> Pause";
const TWO_PLAYER_HELP =
  "Spieler 1: <kbd>W A S D</kbd> <kbd>F</kbd> <kbd>G</kbd> <kbd>H</kbd> · Spieler 2: Pfeiltasten <kbd>,</kbd> <kbd>.</kbd> <kbd>-</kbd> · <kbd>Esc</kbd> Pause";

function show(html, actions) {
  overlay.innerHTML = html;
  overlay.hidden = false;
  for (const button of overlay.querySelectorAll("button[data-action]")) {
    button.addEventListener("click", () => actions[button.dataset.action](button.dataset.value));
  }
  overlay.querySelector("button:enabled")?.focus();
}

function buttons(entries) {
  const items = entries.map(([action, label]) => `<button data-action="${action}">${label}</button>`);
  return `<div class="buttons">${items.join("")}</div>`;
}

export function hideOverlay() {
  overlay.hidden = true;
  overlay.innerHTML = "";
}

export function setHelp(mode) {
  help.innerHTML = mode === "versus" ? TWO_PLAYER_HELP : mode === "campaign" ? ONE_PLAYER_HELP : "";
}

export function showMenu({ muted, onCampaign, onVersus, onSound }) {
  const sound = muted ? "Sound: aus" : "Sound: an";
  show(
    `<h1>sumoDuell</h1>
     <p>Stoß den anderen von der Plattform. Wer Schwung hat, ist stark, kommt aber schwer zum Stehen.</p>
     ${buttons([["campaign", "Kampagne"], ["versus", "Zwei Spieler"], ["sound", sound]])}`,
    { campaign: onCampaign, versus: onVersus, sound: onSound },
  );
}

function levelCard(entry, progress) {
  const open = isUnlocked(progress, entry.level);
  const beaten = entry.level <= progress.beaten;
  const color = open ? entry.body : "#4c4258";
  return `<button data-action="level" data-value="${entry.level}" ${open ? "" : "disabled"}>
    <span class="swatch" style="background:${color}"></span>
    <span>${entry.level}. ${open ? entry.name : "Gesperrt"}</span>
    <small>${beaten ? "Besiegt" : open ? entry.style : "Erst Level davor schlagen"}</small>
  </button>`;
}

export function showCampaign({ progress, onLevel, onBack }) {
  show(
    `<h2>Kampagne</h2>
     <div class="levels">${LEVELS.map((entry) => levelCard(entry, progress)).join("")}</div>
     ${buttons([["back", "Zurück"]])}`,
    { level: (value) => onLevel(Number(value)), back: onBack },
  );
}

export function showDialog(title, text, entries) {
  const actions = Object.fromEntries(entries.map(([action, , run]) => [action, run]));
  show(`<h2>${title}</h2><p>${text}</p>${buttons(entries)}`, actions);
}

// Pfeiltasten springen in Menüs von Knopf zu Knopf.
window.addEventListener("keydown", (event) => {
  if (overlay.hidden) return;
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.code];
  if (!step) return;
  event.preventDefault();
  const items = [...overlay.querySelectorAll("button:enabled")];
  const next = (items.indexOf(document.activeElement) + step + items.length) % items.length;
  items[next]?.focus();
});
