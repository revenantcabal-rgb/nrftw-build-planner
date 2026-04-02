// Two sprite sheets: weapons/trinkets/shields use "w-icons", armor uses "a-icons"
export const W_SPRITE_URL =
  "https://www.norestforthewicked.gg/_nuxt/1774151318915.CNNByASV.webp";
export const A_SPRITE_URL =
  "https://www.norestforthewicked.gg/_nuxt/1774151313986.13_F0e5b.webp";

// Dimensions: w-icons = 1934x2450, a-icons = 2708x2579
export const W_SPRITE_SIZE = [1934, 2450] as const;
export const A_SPRITE_SIZE = [2708, 2579] as const;

// All icons are 128x128 in the sprite sheets
const ICON_SIZE = 128;

// Weapon/shield/trinket icon positions (w-icons sprite)
// Loaded at runtime from JSON for smaller bundle
let wIconCache: Record<string, [number, number]> | null = null;
let aIconCache: Record<string, [number, number]> | null = null;

async function loadWIcons(): Promise<Record<string, [number, number]>> {
  if (wIconCache) return wIconCache;
  const res = await fetch("/data/weapon-icons.json");
  wIconCache = await res.json();
  return wIconCache!;
}

async function loadAIcons(): Promise<Record<string, [number, number]>> {
  if (aIconCache) return aIconCache;
  const res = await fetch("/data/armor-icons.json");
  aIconCache = await res.json();
  return aIconCache!;
}

export function parseIconField(iconField: string | undefined): { prefix: string; id: string } | null {
  if (!iconField) return null;
  const match = iconField.match(/^([a-z])(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], id: match[2] };
}

export async function preloadIcons(): Promise<void> {
  await Promise.all([loadWIcons(), loadAIcons()]);
}

export function getIconInfo(iconField: string | undefined): {
  spriteUrl: string;
  x: number;
  y: number;
  spriteWidth: number;
  spriteHeight: number;
} | null {
  const parsed = parseIconField(iconField);
  if (!parsed) return null;

  if (parsed.prefix === "w") {
    const pos = wIconCache?.[parsed.id];
    if (!pos) return null;
    return {
      spriteUrl: W_SPRITE_URL,
      x: pos[0],
      y: pos[1],
      spriteWidth: W_SPRITE_SIZE[0],
      spriteHeight: W_SPRITE_SIZE[1],
    };
  }

  if (parsed.prefix === "a") {
    const pos = aIconCache?.[parsed.id];
    if (!pos) return null;
    return {
      spriteUrl: A_SPRITE_URL,
      x: pos[0],
      y: pos[1],
      spriteWidth: A_SPRITE_SIZE[0],
      spriteHeight: A_SPRITE_SIZE[1],
    };
  }

  return null;
}

export const ICON_CELL_SIZE = ICON_SIZE;
