const STORAGE_KEY = "sumoDuell.shop";

export const COLLECTIONS = [
  { id: "classic", name: "Klassik" },
  { id: "fruit", name: "Früchte" },
  { id: "ball", name: "Countryballs" },
  { id: "crypto", name: "Krypto" },
];

function fruit(id, name, price, look, unlockLevel) {
  return { id, name, collection: "fruit", price, unlockLevel, look };
}

function ball(id, name, price, flag, body) {
  return { id, name, collection: "ball", price, look: { body, flag } };
}

function coin(id, name, price, body, rim) {
  return { id, name, collection: "crypto", price, look: { body, coin: { text: name, rim } } };
}

export const SKINS = [
  { id: "classic-red", name: "Rot", collection: "classic", price: 0, look: { body: "#e4483c", belt: "#fff0d0", hair: "bun" } },
  { id: "classic-blue", name: "Blau", collection: "classic", price: 0, look: { body: "#3f86e8", belt: "#ffe08a", hair: "band" } },
  { id: "classic-gold", name: "Goldener Sumo", collection: "classic", unlockLevel: 10, look: { body: "#f4cf45", belt: "#fff8e0", hair: "bun" } },

  fruit("apple", "Apfel", 150, { body: "#e23d3d", hair: "leaf" }),
  fruit("orange", "Orange", 150, { body: "#f79a2e", hair: "leaf", pattern: "pores" }),
  fruit("lemon", "Zitrone", 180, { body: "#f6dc45", hair: "leaf", pattern: "pores" }),
  fruit("watermelon", "Wassermelone", 220, { body: "#46a652", hair: "stem", pattern: "stripes" }),
  fruit("kiwi", "Kiwi", 220, { body: "#94703f", hair: "stem", pattern: "fuzz" }),
  fruit("pineapple", "Ananas", 260, { body: "#f2c13c", hair: "crown", pattern: "grid" }),
  fruit("coconut", "Kokosnuss", 260, { body: "#6e4a2d", hair: "stem", pattern: "fuzz" }),
  fruit("dragonfruit", "Drachenfrucht", undefined, { body: "#ee4f9c", hair: "crown", pattern: "seeds" }, 5),

  ball("de", "Deutschland", 200, { dir: "h", colors: ["#1b1b1b", "#d6232a", "#f5c518"] }, "#d6232a"),
  ball("fr", "Frankreich", 200, { dir: "v", colors: ["#1f4aa8", "#f7f7f7", "#dc2f3c"] }, "#1f4aa8"),
  ball("it", "Italien", 200, { dir: "v", colors: ["#1f9a55", "#f7f7f7", "#d9303c"] }, "#1f9a55"),
  ball("at", "Österreich", 200, { dir: "h", colors: ["#d6232a", "#f7f7f7", "#d6232a"] }, "#d6232a"),
  ball("pl", "Polen", 200, { dir: "h", colors: ["#f7f7f7", "#d6233c"] }, "#d6233c"),
  ball("ua", "Ukraine", 200, { dir: "h", colors: ["#2d6fd2", "#f8d32a"] }, "#2d6fd2"),
  ball("jp", "Japan", 300, { emblem: "disc", base: "#f7f7f7", mark: "#d42a3c" }, "#e8e8e8"),
  ball("ch", "Schweiz", 300, { emblem: "cross", base: "#d6232a", mark: "#f7f7f7" }, "#d6232a"),

  coin("btc", "BTC", 500, "#f4a62a", "#b56e0c"),
  coin("eth", "ETH", 450, "#8d97c9", "#525b92"),
  coin("sol", "SOL", 400, "#6f58e0", "#3cd6a8"),
  coin("doge", "DOGE", 300, "#dcb95a", "#9a7a26"),
  coin("ada", "ADA", 350, "#3667c9", "#1c3a80"),
];

const DEFAULT_EQUIPPED = ["classic-red", "classic-blue"];

export function skinById(id) {
  return SKINS.find((skin) => skin.id === id);
}

export function createShop() {
  return { coins: 0, owned: [], equipped: [...DEFAULT_EQUIPPED] };
}

export function isOwned(shop, progress, id) {
  const skin = skinById(id);
  if (!skin) return false;
  if (skin.unlockLevel) return progress.beaten >= skin.unlockLevel;
  return skin.price === 0 || shop.owned.includes(id);
}

export function canBuy(shop, progress, id) {
  const skin = skinById(id);
  return Boolean(skin) && !skin.unlockLevel && !isOwned(shop, progress, id) && shop.coins >= skin.price;
}

export function buySkin(shop, progress, id) {
  if (!canBuy(shop, progress, id)) return shop;
  return { ...shop, coins: shop.coins - skinById(id).price, owned: [...shop.owned, id] };
}

export function equipSkin(shop, progress, player, id) {
  if (!isOwned(shop, progress, id)) return shop;
  const equipped = [...shop.equipped];
  equipped[player] = id;
  return { ...shop, equipped };
}

export function winReward(level, firstWin) {
  return (20 + level * 10) * (firstWin ? 2 : 1);
}

export const LOSS_REWARD = 5;
export const VERSUS_REWARD = 10;

export function addCoins(shop, amount) {
  return { ...shop, coins: shop.coins + amount };
}

export function equippedLook(shop, progress, player) {
  const id = shop.equipped[player];
  return skinById(isOwned(shop, progress, id) ? id : DEFAULT_EQUIPPED[player]).look;
}

export function loadShop(storage) {
  const shop = createShop();
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    if (Number.isInteger(saved?.coins) && saved.coins >= 0) shop.coins = saved.coins;
    if (Array.isArray(saved?.owned)) shop.owned = saved.owned.filter((id) => skinById(id));
    if (Array.isArray(saved?.equipped)) {
      shop.equipped = DEFAULT_EQUIPPED.map((id, i) => (skinById(saved.equipped[i]) ? saved.equipped[i] : id));
    }
  } catch {
    return createShop();
  }
  return shop;
}

export function saveShop(storage, shop) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(shop));
  } catch {
    // Ohne Speicher läuft das Spiel weiter, Münzen und Skins enden dann mit der Sitzung.
  }
}
