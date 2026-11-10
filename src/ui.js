import { LEVELS, isUnlocked } from "./game/campaign.js";
import { COLLECTIONS, SKINS, canBuy, isOwned } from "./game/skins.js";
import { drawSkinPreview } from "./render.js";

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
  (overlay.querySelector('.tabs [aria-pressed="true"]') ?? overlay.querySelector("button:enabled"))?.focus();
}

function buttons(entries) {
  const items = entries.map(([action, label]) => `<button data-action="${action}">${label}</button>`);
  return `<div class="buttons">${items.join("")}</div>`;
}

export function hideOverlay() {
  overlay.hidden = true;
  overlay.innerHTML = "";
}

export function setHelp(humans) {
  help.innerHTML = humans === 2 ? TWO_PLAYER_HELP : humans === 1 ? ONE_PLAYER_HELP : "";
}

export function showMenu({ muted, coins, onCampaign, onVersus, onGroup, onOnline, onSkins, onSound }) {
  const sound = muted ? "Sound: aus" : "Sound: an";
  show(
    `<h1>sumoDuell</h1>
     <p>Stoß den anderen von der Plattform. Wer Schwung hat, ist stark, kommt aber schwer zum Stehen.</p>
     ${buttons([["campaign", "Kampagne"], ["versus", "Zwei Spieler"], ["group", "Mehr Ringer"], ["online", "Online"], ["skins", "Skins"], ["sound", sound]])}
     <p>Münzen: ${coins}</p>`,
    { campaign: onCampaign, versus: onVersus, group: onGroup, online: onOnline, skins: onSkins, sound: onSound },
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

function tab(action, value, label, active) {
  return `<button data-action="${action}" data-value="${value}" aria-pressed="${active}">${label}</button>`;
}

function skinCard(skin, { shop, progress, player }) {
  const owned = isOwned(shop, progress, skin.id);
  const worn = shop.equipped[player] === skin.id;
  const open = owned || canBuy(shop, progress, skin.id);
  const cost = skin.unlockLevel ? `Level ${skin.unlockLevel} schlagen` : `${skin.price} Münzen`;
  return `<button data-action="pick" data-value="${skin.id}" aria-pressed="${worn}" ${open ? "" : "disabled"}>
    <canvas data-skin="${skin.id}" width="96" height="96"></canvas>
    <span>${skin.name}</span>
    <small>${worn ? "Angelegt" : owned ? "Anlegen" : cost}</small>
  </button>`;
}

export function showSkins(view) {
  const { shop, player, collection, onPlayer, onCollection, onPick, onBack } = view;
  const skins = SKINS.filter((skin) => skin.collection === collection);
  show(
    `<h2>Skins</h2>
     <p>Münzen: ${shop.coins}</p>
     <div class="tabs">${[0, 1].map((p) => tab("player", p, `Spieler ${p + 1}`, p === player)).join("")}</div>
     <div class="tabs">${COLLECTIONS.map((c) => tab("collection", c.id, c.name, c.id === collection)).join("")}</div>
     <div class="levels">${skins.map((skin) => skinCard(skin, view)).join("")}</div>
     ${buttons([["back", "Zurück"]])}`,
    { player: (value) => onPlayer(Number(value)), collection: onCollection, pick: onPick, back: onBack },
  );
  for (const canvas of overlay.querySelectorAll("canvas[data-skin]")) {
    drawSkinPreview(canvas, SKINS.find((skin) => skin.id === canvas.dataset.skin).look);
  }
}

const GROUP_OPTIONS = {
  mode: [["ffa", "Jeder gegen jeden"], ["team", "Einer gegen Team"]],
  count: [[3, "3 Ringer"], [4, "4 Ringer"]],
  humans: [[1, "1 Mensch"], [2, "2 Menschen"]],
  strength: [["easy", "KI leicht"], ["medium", "KI mittel"], ["hard", "KI schwer"]],
};

export function showGroupSetup({ setup, onChange, onStart, onBack }) {
  const rows = Object.entries(GROUP_OPTIONS).map(
    ([key, options]) =>
      `<div class="tabs">${options.map(([value, label]) => tab(key, value, label, setup[key] === value)).join("")}</div>`,
  );
  const solo = setup.mode === "team" ? "Spieler 1 kämpft allein gegen alle anderen, die zusammenhalten." : "Wer zuletzt auf der Plattform steht, gewinnt die Runde.";
  show(
    `<h2>Mehr Ringer</h2>
     ${rows.join("")}
     <p>${solo} Freie Plätze übernimmt die KI.</p>
     ${buttons([["start", "Los geht's"], ["back", "Zurück"]])}`,
    {
      mode: (value) => onChange("mode", value),
      count: (value) => onChange("count", Number(value)),
      humans: (value) => onChange("humans", Number(value)),
      strength: (value) => onChange("strength", value),
      start: onStart,
      back: onBack,
    },
  );
}

export function showOnlineMenu({ error, onHost, onJoin, onBack }) {
  show(
    `<h2>Online</h2>
     <p>Erstelle einen Raum und schick den Code an Freunde, oder tritt mit einem Code bei.</p>
     ${buttons([["host", "Raum erstellen"]])}
     <div class="buttons join">
       <input id="room-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE" aria-label="Raumcode" />
       <button data-action="join">Beitreten</button>
     </div>
     ${error ? `<p class="error">${error}</p>` : ""}
     ${buttons([["back", "Zurück"]])}
     <p class="small">Die Verbindung vermittelt der fremde Dienst PeerJS. Mitspieler sehen gegenseitig ihre IP-Adresse.</p>`,
    { host: onHost, join: () => onJoin(overlay.querySelector("#room-code").value), back: onBack },
  );
  const field = overlay.querySelector("#room-code");
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") onJoin(field.value);
  });
}

const SEAT_NAMES = { host: "Host", guest: "Gast" };

export function showOnlineLobby({ code, isHost, mySeat, players, setup, onChange, onStart, onLeave }) {
  const humans = players.length;
  const seats = Array.from({ length: Math.max(setup.count, humans) }, (_, seat) => {
    const player = players[seat];
    if (!player) return `<li>Platz ${seat + 1}: KI</li>`;
    const me = player.seat === mySeat ? " (du)" : "";
    return `<li>Platz ${seat + 1}: ${SEAT_NAMES[player.kind]}${me}</li>`;
  });
  const options = isHost
    ? [
        `<div class="tabs">${GROUP_OPTIONS.mode.map(([value, label]) => tab("mode", value, label, setup.mode === value)).join("")}</div>`,
        `<div class="tabs">${[2, 3, 4].map((n) => tab("count", n, `${n} Ringer`, setup.count === n)).join("")}</div>`,
        `<div class="tabs">${GROUP_OPTIONS.strength.map(([value, label]) => tab("strength", value, label, setup.strength === value)).join("")}</div>`,
      ].join("")
    : `<p>${setup.mode === "team" ? "Einer gegen Team" : "Jeder gegen jeden"} · ${Math.max(setup.count, humans)} Ringer · Der Host startet das Match.</p>`;
  show(
    `<h2>Raum ${code}</h2>
     <ul class="seats">${seats.join("")}</ul>
     ${options}
     ${buttons(isHost ? [["start", "Match starten"], ["leave", "Raum schließen"]] : [["leave", "Raum verlassen"]])}`,
    {
      mode: (value) => onChange({ mode: value }),
      count: (value) => onChange({ count: Number(value) }),
      strength: (value) => onChange({ strength: value }),
      start: onStart,
      leave: onLeave,
    },
  );
}

export function showDialog(title, text, entries) {
  const actions = Object.fromEntries(entries.map(([action, , run]) => [action, run]));
  show(`<h2>${title}</h2><p>${text}</p>${buttons(entries)}`, actions);
}

// Pfeiltasten springen in Menüs von Knopf zu Knopf.
window.addEventListener("keydown", (event) => {
  if (overlay.hidden || event.target.tagName === "INPUT") return;
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.code];
  if (!step) return;
  event.preventDefault();
  const items = [...overlay.querySelectorAll("button:enabled")];
  const next = (items.indexOf(document.activeElement) + step + items.length) % items.length;
  items[next]?.focus();
});
