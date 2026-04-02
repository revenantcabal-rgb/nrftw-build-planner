import { CategoryInfo, Rarity } from "./types";

export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#9a9a9a",
  uncommon: "#4a9e4a",
  rare: "#4a7ec9",
  epic: "#9a4ac9",
  exalted: "#c9a84c",
};

export const RARITY_BG: Record<Rarity, string> = {
  common: "bg-rarity-common/10 border-rarity-common/30",
  uncommon: "bg-rarity-uncommon/10 border-rarity-uncommon/30",
  rare: "bg-rarity-rare/10 border-rarity-rare/30",
  epic: "bg-rarity-epic/10 border-rarity-epic/30",
  exalted: "bg-rarity-exalted/10 border-rarity-exalted/30",
};

export const RARITY_TEXT: Record<Rarity, string> = {
  common: "text-rarity-common",
  uncommon: "text-rarity-uncommon",
  rare: "text-rarity-rare",
  epic: "text-rarity-epic",
  exalted: "text-rarity-exalted",
};

export const CATEGORIES: CategoryInfo[] = [
  { slug: "weapons", name: "Weapons", icon: "\u2694" },
  { slug: "armor", name: "Armor", icon: "\uD83D\uDEE1" },
  { slug: "shields", name: "Shields", icon: "\uD83D\uDEE1" },
  { slug: "trinkets", name: "Trinkets", icon: "\uD83D\uDC8D" },
  { slug: "runes", name: "Runes", icon: "\u2726" },
  { slug: "enchantments", name: "Enchantments", icon: "\u2728" },
  { slug: "gems", name: "Gems", icon: "\uD83D\uDC8E" },
  { slug: "food", name: "Food", icon: "\uD83C\uDF56" },
];

export const EQUIP_SLOT_LABELS: Record<string, string> = {
  weapon: "Main Hand",
  offhand: "Off Hand",
  head: "Head",
  chest: "Chest",
  hands: "Hands",
  legs: "Legs",
  ring1: "Ring 1",
  ring2: "Ring 2",
  ring3: "Ring 3",
};
