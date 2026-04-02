import { SPRITE_URL, getIconPosition } from "@/lib/icons";

interface ItemIconProps {
  icon?: string;
  size?: number;
  className?: string;
}

export default function ItemIcon({ icon, size = 48, className = "" }: ItemIconProps) {
  const pos = getIconPosition(icon);

  if (!pos) {
    return (
      <div
        className={`bg-bg-secondary rounded border border-border-subtle flex items-center justify-center text-text-secondary/30 ${className}`}
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }

  const [x, y, w, h] = pos;
  const scale = size / w;

  return (
    <div
      className={`overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        style={{
          backgroundImage: `url(${SPRITE_URL})`,
          backgroundPosition: `${x * scale}px ${y * scale}px`,
          backgroundSize: `${1934 * scale}px ${2450 * scale}px`,
          width: size,
          height: size,
          imageRendering: "auto",
        }}
      />
    </div>
  );
}
