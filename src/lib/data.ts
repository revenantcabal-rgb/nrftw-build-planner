import type { Weapon, Armor, Shield, Trinket, Enchantment, Gem, Rune, Food } from "./types";

let weaponsCache: Weapon[] | null = null;
let armorsCache: Armor[] | null = null;
let shieldsCache: Shield[] | null = null;
let trinketsCache: Trinket[] | null = null;
let enchantmentsCache: Enchantment[] | null = null;
let gemsCache: Gem[] | null = null;
let runesCache: Rune[] | null = null;
let foodCache: Food[] | null = null;
let translationsCache: Record<string, string> | null = null;

async function loadJson<T>(filename: string): Promise<T> {
  const res = await fetch(`/data/${filename}.json`);
  return res.json();
}

export async function getWeapons(): Promise<Weapon[]> {
  if (!weaponsCache) weaponsCache = await loadJson<Weapon[]>("weapons");
  return weaponsCache;
}

export async function getArmors(): Promise<Armor[]> {
  if (!armorsCache) armorsCache = await loadJson<Armor[]>("armors");
  return armorsCache;
}

export async function getShields(): Promise<Shield[]> {
  if (!shieldsCache) shieldsCache = await loadJson<Shield[]>("shields");
  return shieldsCache;
}

export async function getTrinkets(): Promise<Trinket[]> {
  if (!trinketsCache) trinketsCache = await loadJson<Trinket[]>("trinkets");
  return trinketsCache;
}

export async function getEnchantments(): Promise<Enchantment[]> {
  if (!enchantmentsCache) enchantmentsCache = await loadJson<Enchantment[]>("enchantments");
  return enchantmentsCache;
}

export async function getGems(): Promise<Gem[]> {
  if (!gemsCache) gemsCache = await loadJson<Gem[]>("gems");
  return gemsCache;
}

export async function getRunes(): Promise<Rune[]> {
  if (!runesCache) runesCache = await loadJson<Rune[]>("runes");
  return runesCache;
}

export async function getFood(): Promise<Food[]> {
  if (!foodCache) foodCache = await loadJson<Food[]>("food");
  return foodCache;
}

export async function getTranslations(): Promise<Record<string, string>> {
  if (!translationsCache) translationsCache = await loadJson<Record<string, string>>("translations");
  return translationsCache;
}

export type CategoryKey = "weapons" | "armors" | "shields" | "trinkets" | "enchantments" | "gems" | "runes" | "food";

export const categoryLoaders: Record<CategoryKey, () => Promise<unknown[]>> = {
  weapons: getWeapons,
  armors: getArmors,
  shields: getShields,
  trinkets: getTrinkets,
  enchantments: getEnchantments,
  gems: getGems,
  runes: getRunes,
  food: getFood,
};

export function formatWeaponType(slug: string): string {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatRarity(rarity: string): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}
