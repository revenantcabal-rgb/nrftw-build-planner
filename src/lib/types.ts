export type Rarity = "common" | "uncommon" | "rare" | "epic" | "exalted";

export type WeaponHandling = "one-handed" | "two-handed" | "dual-wielding";

export type ArmorMaterial = "cloth" | "leather" | "mesh" | "plate";

export type EquipSlot =
  | "weapon"
  | "offhand"
  | "head"
  | "chest"
  | "hands"
  | "legs"
  | "ring1"
  | "ring2";

export interface GameItem {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  rarity: Rarity;
  icon?: string;
  sellValue?: number;
  dropLevel?: number;
  isEnchantable?: boolean;
  isSocketable?: boolean;
  socketCount?: number;
  requirements?: {
    strength?: number;
    dexterity?: number;
    intelligence?: number;
    faith?: number;
    level?: number;
  };
  stats?: Record<string, number | string>;
  enchantments?: string[];
  sources?: string[];
}

export interface Weapon extends GameItem {
  category: "weapons";
  handling: WeaponHandling;
  weaponType: string;
  damageType?: string;
  damageRange?: { min: number; max: number };
  scaling?: Record<string, string>;
}

export interface Armor extends GameItem {
  category: "armor";
  material: ArmorMaterial;
  armorSlot: "head" | "chest" | "hands" | "legs";
  defense?: number;
  resistances?: Record<string, number>;
}

export interface Shield extends GameItem {
  category: "shields";
  shieldType: "light" | "medium" | "great";
  blockStrength?: number;
}

export interface Trinket extends GameItem {
  category: "trinkets";
  trinketType: "ring";
}

export interface Enchantment {
  id: string;
  name: string;
  description: string;
  type: string;
  groupType?: string;
  itemType?: string;
  dropLevel?: number;
  scaling?: Record<string, string>;
}

export interface Gem {
  id: string;
  name: string;
  description: string;
  type: string;
  effect?: string;
}

export interface Rune {
  id: string;
  name: string;
  description: string;
  type: "equipment" | "utility";
  effect?: string;
}

export interface Food {
  id: string;
  name: string;
  description: string;
  effects?: string[];
  sellValue?: number;
}

// Build planner types
export interface BuildSlot {
  item: GameItem | null;
  enchantments: (Enchantment | null)[];
  gems: (Gem | null)[];
}

export interface Build {
  name: string;
  slots: Record<EquipSlot, BuildSlot>;
}

export interface CategoryInfo {
  slug: string;
  name: string;
  icon: string;
  count?: number;
}
