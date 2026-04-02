"use client";

import { useEffect, useState } from "react";
import { getIconInfo, preloadIcons, ICON_CELL_SIZE } from "@/lib/icons";

interface ItemIconProps {
  icon?: string;
  size?: number;
  className?: string;
}

let iconsLoaded = false;
let loadPromise: Promise<void> | null = null;

function ensureIcons(): Promise<void> {
  if (iconsLoaded) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = preloadIcons().then(() => {
      iconsLoaded = true;
    });
  }
  return loadPromise;
}

export default function ItemIcon({
  icon,
  size = 48,
  className = "",
}: ItemIconProps) {
  const [ready, setReady] = useState(iconsLoaded);

  useEffect(() => {
    if (!iconsLoaded) {
      ensureIcons().then(() => setReady(true));
    }
  }, []);

  if (!ready || !icon) {
    return (
      <div
        className={`bg-bg-secondary rounded border border-border-subtle flex items-center justify-center text-text-secondary/30 shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {icon ? "" : "?"}
      </div>
    );
  }

  const info = getIconInfo(icon);
  if (!info) {
    return (
      <div
        className={`bg-bg-secondary rounded border border-border-subtle flex items-center justify-center text-text-secondary/30 shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }

  const scale = size / ICON_CELL_SIZE;

  return (
    <div
      className={`overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        style={{
          backgroundImage: `url(${info.spriteUrl})`,
          backgroundPosition: `${info.x * scale}px ${info.y * scale}px`,
          backgroundSize: `${info.spriteWidth * scale}px ${info.spriteHeight * scale}px`,
          width: size,
          height: size,
        }}
      />
    </div>
  );
}
