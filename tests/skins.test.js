import { describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  SKINS,
  addCoins,
  buySkin,
  canBuy,
  createShop,
  equipSkin,
  equippedLook,
  isOwned,
  loadShop,
  saveShop,
  skinById,
  winReward,
} from "../src/game/skins.js";

const FRESH = { beaten: 0 };

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; } };
}

describe("Sammlungen", () => {
  it("jeder Skin hat eine eindeutige ID und eine bekannte Sammlung", () => {
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    const known = COLLECTIONS.map((c) => c.id);
    for (const skin of SKINS) expect(known).toContain(skin.collection);
  });

  it("Früchte, Countryballs und Krypto sind alle gefüllt", () => {
    for (const id of ["fruit", "ball", "crypto"]) {
      expect(SKINS.filter((s) => s.collection === id).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("jeder Skin ist kaufbar, gratis oder hat eine Level-Bedingung", () => {
    for (const skin of SKINS) expect(skin.price >= 0 || skin.unlockLevel > 0).toBe(true);
  });
});

describe("Standard", () => {
  it("das bisherige Aussehen bleibt der Standard beider Spieler", () => {
    const shop = createShop();
    expect(equippedLook(shop, FRESH, 0)).toEqual({ body: "#e4483c", belt: "#fff0d0", hair: "bun" });
    expect(equippedLook(shop, FRESH, 1)).toEqual({ body: "#3f86e8", belt: "#ffe08a", hair: "band" });
  });
});

describe("Kaufen", () => {
  it("zieht den Preis ab und gibt den Skin", () => {
    const shop = buySkin(addCoins(createShop(), 200), FRESH, "apple");
    expect(shop.coins).toBe(50);
    expect(isOwned(shop, FRESH, "apple")).toBe(true);
  });

  it("ohne genug Münzen passiert nichts", () => {
    const shop = addCoins(createShop(), 149);
    expect(canBuy(shop, FRESH, "apple")).toBe(false);
    expect(buySkin(shop, FRESH, "apple")).toBe(shop);
  });

  it("derselbe Skin kostet nicht zweimal", () => {
    const shop = buySkin(addCoins(createShop(), 500), FRESH, "apple");
    expect(buySkin(shop, FRESH, "apple")).toBe(shop);
  });

  it("freischaltbare Skins sind nicht käuflich", () => {
    expect(canBuy(addCoins(createShop(), 9999), FRESH, "classic-gold")).toBe(false);
  });

  it("unbekannte Skins lassen sich nicht kaufen", () => {
    const shop = addCoins(createShop(), 9999);
    expect(buySkin(shop, FRESH, "gibtsnicht")).toBe(shop);
  });
});

describe("Freischalten", () => {
  it("der Kampagnen-Sieg schaltet den Skin frei", () => {
    const shop = createShop();
    expect(isOwned(shop, { beaten: 4 }, "dragonfruit")).toBe(false);
    expect(isOwned(shop, { beaten: 5 }, "dragonfruit")).toBe(true);
    expect(isOwned(shop, { beaten: 9 }, "classic-gold")).toBe(false);
    expect(isOwned(shop, { beaten: 10 }, "classic-gold")).toBe(true);
  });
});

describe("Anlegen", () => {
  it("jeder Spieler hat seinen eigenen Skin", () => {
    const shop = equipSkin(buySkin(addCoins(createShop(), 200), FRESH, "apple"), FRESH, 1, "apple");
    expect(equippedLook(shop, FRESH, 1)).toBe(skinById("apple").look);
    expect(equippedLook(shop, FRESH, 0)).toBe(skinById("classic-red").look);
  });

  it("fremde Skins lassen sich nicht anlegen", () => {
    const shop = createShop();
    expect(equipSkin(shop, FRESH, 0, "btc")).toBe(shop);
  });
});

describe("Belohnung", () => {
  it("schwerere Level und der erste Sieg bringen mehr", () => {
    expect(winReward(5, false)).toBeGreaterThan(winReward(1, false));
    expect(winReward(1, true)).toBe(winReward(1, false) * 2);
  });
});

describe("Speichern", () => {
  it("übersteht Speichern und Laden", () => {
    const storage = memoryStorage();
    const shop = equipSkin(buySkin(addCoins(createShop(), 300), FRESH, "apple"), FRESH, 0, "apple");
    saveShop(storage, shop);
    expect(loadShop(storage)).toEqual(shop);
  });

  it.each(["kaputt{", "null", '{"coins":-5}', '{"coins":"9"}', '{"owned":"x"}'])("ungültige Daten %s ergeben einen leeren Stand", (value) => {
    expect(loadShop(memoryStorage({ "sumoDuell.shop": value }))).toEqual(createShop());
  });

  it("unbekannte Skins werden beim Laden verworfen", () => {
    const value = JSON.stringify({ coins: 10, owned: ["apple", "weg"], equipped: ["weg", "apple"] });
    const shop = loadShop(memoryStorage({ "sumoDuell.shop": value }));
    expect(shop.owned).toEqual(["apple"]);
    expect(shop.equipped).toEqual(["classic-red", "apple"]);
  });

  it("ein manipulierter Anlege-Eintrag zeigt keinen ungekauften Skin", () => {
    const value = JSON.stringify({ coins: 0, owned: [], equipped: ["btc", "classic-blue"] });
    const shop = loadShop(memoryStorage({ "sumoDuell.shop": value }));
    expect(equippedLook(shop, FRESH, 0)).toBe(skinById("classic-red").look);
  });

  it("ein blockierter Speicher bringt das Spiel nicht zum Absturz", () => {
    const broken = {
      getItem() {
        throw new Error("gesperrt");
      },
      setItem() {
        throw new Error("gesperrt");
      },
    };
    expect(loadShop(broken)).toEqual(createShop());
    expect(() => saveShop(broken, createShop())).not.toThrow();
  });
});
