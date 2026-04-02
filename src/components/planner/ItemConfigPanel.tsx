"use client";

import { useState } from "react";
import ItemIcon from "@/components/items/ItemIcon";
import { RARITY_TEXT } from "@/lib/constants";
import type { Rarity } from "@/lib/types";

interface ConfigItem {
  id: string;
  name: string;
  icon?: string;
  rarity?: Rarity;
  weaponType?: string;
  handling?: string;
  material?: string;
  damageType?: string;
  dropLevel?: number;
  baseAttributes?: number;
}

interface RuneSlot {
  id: string;
  name: string;
  icon?: string;
}

interface GemSlot {
  id: string;
  name: string;
  icon?: string;
}

interface ItemConfig {
  runes: (RuneSlot | null)[];
  facet: string | null;
  gem: GemSlot | null;
  enchantments: (string | null)[];
}

interface Facet {
  name: string;
  key: string;
}

const FACETS: Facet[] = [
  { name: "Durable", key: "durable" },
  { name: "Quick", key: "quick" },
  { name: "Keen", key: "keen" },
  { name: "Ritualistic", key: "ritualistic" },
  { name: "Heavy", key: "heavy" },
  { name: "Flaming", key: "flaming" },
  { name: "Sharp", key: "sharp" },
  { name: "Meditative", key: "meditative" },
  { name: "Frigid", key: "frigid" },
  { name: "Festering", key: "festering" },
  { name: "Reliable", key: "reliable" },
  { name: "Voltaic", key: "voltaic" },
  { name: "Nimble", key: "nimble" },
  { name: "Mundane", key: "mundane" },
  { name: "Razor", key: "razor" },
  { name: "Indestructible", key: "indestructible" },
  { name: "Purified", key: "purified" },
  { name: "Insulated", key: "insulated" },
  { name: "Agile", key: "agile" },
  { name: "Mystic", key: "mystic" },
];

interface ItemConfigPanelProps {
  item: ConfigItem;
  slotLabel: string;
  config: ItemConfig;
  availableRunes: RuneSlot[];
  availableGems: GemSlot[];
  onConfigChange: (config: ItemConfig) => void;
  onRemoveItem: () => void;
  onClose: () => void;
}

export default function ItemConfigPanel({
  item,
  slotLabel,
  config,
  availableRunes,
  availableGems,
  onConfigChange,
  onRemoveItem,
  onClose,
}: ItemConfigPanelProps) {
  const [activeRuneSlot, setActiveRuneSlot] = useState<number | null>(null);
  const [activeGemSlot, setActiveGemSlot] = useState(false);
  const [showFacetPicker, setShowFacetPicker] = useState(false);
  const [runeSearch, setRuneSearch] = useState("");
  const [gemSearch, setGemSearch] = useState("");

  function setRune(slotIndex: number, rune: RuneSlot | null) {
    const newRunes = [...config.runes];
    newRunes[slotIndex] = rune;
    onConfigChange({ ...config, runes: newRunes });
    setActiveRuneSlot(null);
  }

  function setFacet(facetKey: string | null) {
    onConfigChange({ ...config, facet: facetKey });
    setShowFacetPicker(false);
  }

  function setGem(gem: GemSlot | null) {
    onConfigChange({ ...config, gem });
    setActiveGemSlot(false);
  }

  const filteredRunes = runeSearch
    ? availableRunes.filter((r) =>
        r.name.toLowerCase().includes(runeSearch.toLowerCase())
      )
    : availableRunes;

  const filteredGems = gemSearch
    ? availableGems.filter((g) =>
        g.name.toLowerCase().includes(gemSearch.toLowerCase())
      )
    : availableGems;

  const selectedFacet = FACETS.find((f) => f.key === config.facet);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border-subtle rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-bg-secondary border-b border-border-subtle p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-text-gold">{slotLabel}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary text-xl p-1"
          >
            &#x2715;
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Selected Item */}
          <div>
            <div className="text-xs text-text-secondary uppercase mb-2">
              Selected Item
            </div>
            <div className="flex items-center gap-3 p-3 bg-bg-card rounded-lg border border-border-subtle">
              <ItemIcon icon={item.icon} size={40} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-text-primary truncate block">
                  {item.name}
                </span>
                <span
                  className={`text-xs font-semibold uppercase ${RARITY_TEXT[item.rarity || "common"]}`}
                >
                  {item.rarity}
                </span>
              </div>
              <button
                onClick={onRemoveItem}
                className="text-red-400/60 hover:text-red-400 text-sm p-1"
                title="Remove item"
              >
                &#x1F5D1;
              </button>
            </div>
          </div>

          {/* Item Details */}
          <div>
            <div className="text-xs text-text-secondary uppercase mb-2">
              Details
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {item.weaponType && (
                <DetailRow label="Type" value={item.weaponType} />
              )}
              {item.handling && (
                <DetailRow label="Handling" value={item.handling} />
              )}
              {item.material && (
                <DetailRow label="Material" value={item.material} />
              )}
              {item.damageType && (
                <DetailRow label="Damage" value={item.damageType} />
              )}
              {item.dropLevel && (
                <DetailRow label="Level" value={String(item.dropLevel)} />
              )}
            </div>
          </div>

          {/* Runes (Max: 4) */}
          <div>
            <div className="text-xs text-text-secondary uppercase mb-2">
              Runes (Max: 4)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {config.runes.map((rune, i) => (
                <div key={i}>
                  {activeRuneSlot === i ? (
                    <div className="bg-bg-card rounded-lg border border-accent-gold/40 p-2 max-h-48 overflow-y-auto">
                      <input
                        type="text"
                        placeholder="Search runes..."
                        value={runeSearch}
                        onChange={(e) => setRuneSearch(e.target.value)}
                        autoFocus
                        className="w-full px-2 py-1 bg-bg-secondary border border-border-subtle rounded text-xs text-text-primary mb-1 focus:outline-none"
                      />
                      <button
                        onClick={() => setRune(i, null)}
                        className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-card-hover rounded"
                      >
                        Clear
                      </button>
                      {filteredRunes.slice(0, 20).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setRune(i, r)}
                          className="w-full text-left px-2 py-1 text-xs text-text-primary hover:bg-bg-card-hover rounded flex items-center gap-2"
                        >
                          <ItemIcon icon={r.icon} size={20} />
                          {r.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveRuneSlot(i);
                        setRuneSearch("");
                      }}
                      className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                        rune
                          ? "bg-bg-card border-border-subtle hover:border-accent-gold/40"
                          : "bg-bg-card/50 border-border-subtle border-dashed hover:border-accent-gold/40"
                      }`}
                    >
                      {rune ? (
                        <div className="flex items-center gap-2">
                          <ItemIcon icon={rune.icon} size={20} />
                          <span className="text-xs text-text-primary truncate">
                            {rune.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-secondary/50">
                          + Add Rune
                        </span>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Facet */}
          <div>
            <div className="text-xs text-text-secondary uppercase mb-2">
              Facet
            </div>
            {showFacetPicker ? (
              <div className="bg-bg-card rounded-lg border border-accent-gold/40 p-2 max-h-48 overflow-y-auto">
                <button
                  onClick={() => setFacet(null)}
                  className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-card-hover rounded"
                >
                  None (clear)
                </button>
                {FACETS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFacet(f.key)}
                    className={`w-full text-left px-2 py-1.5 text-sm hover:bg-bg-card-hover rounded transition-colors ${
                      config.facet === f.key
                        ? "text-text-gold"
                        : "text-text-primary"
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => setShowFacetPicker(true)}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                  selectedFacet
                    ? "bg-bg-card border-border-subtle hover:border-accent-gold/40"
                    : "bg-bg-card/50 border-border-subtle border-dashed hover:border-accent-gold/40"
                }`}
              >
                {selectedFacet ? (
                  <span className="text-text-gold font-medium">
                    {selectedFacet.name}
                  </span>
                ) : (
                  <span className="text-text-secondary/50">+ Add Facet</span>
                )}
              </button>
            )}
          </div>

          {/* Gems (Max: 1) */}
          <div>
            <div className="text-xs text-text-secondary uppercase mb-2">
              Gems (Max: 1)
            </div>
            {activeGemSlot ? (
              <div className="bg-bg-card rounded-lg border border-accent-gold/40 p-2 max-h-48 overflow-y-auto">
                <input
                  type="text"
                  placeholder="Search gems..."
                  value={gemSearch}
                  onChange={(e) => setGemSearch(e.target.value)}
                  autoFocus
                  className="w-full px-2 py-1 bg-bg-secondary border border-border-subtle rounded text-xs text-text-primary mb-1 focus:outline-none"
                />
                <button
                  onClick={() => setGem(null)}
                  className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-card-hover rounded"
                >
                  Clear
                </button>
                {filteredGems.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGem(g)}
                    className="w-full text-left px-2 py-1 text-xs text-text-primary hover:bg-bg-card-hover rounded flex items-center gap-2"
                  >
                    <ItemIcon icon={g.icon} size={20} />
                    {g.name}
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => {
                  setActiveGemSlot(true);
                  setGemSearch("");
                }}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                  config.gem
                    ? "bg-bg-card border-border-subtle hover:border-accent-gold/40"
                    : "bg-bg-card/50 border-border-subtle border-dashed hover:border-accent-gold/40"
                }`}
              >
                {config.gem ? (
                  <div className="flex items-center gap-2">
                    <ItemIcon icon={config.gem.icon} size={20} />
                    <span className="text-text-primary">{config.gem.name}</span>
                  </div>
                ) : (
                  <span className="text-text-secondary/50">+ Add Gem</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 px-2 bg-bg-card rounded">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary capitalize">{value}</span>
    </div>
  );
}
