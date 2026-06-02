type UnitCategory = "weight" | "volume" | "count";

type UnitDef = {
  label: string;
  category: UnitCategory;
  toBase: number;
};

const UNIT_DEFS: Record<string, UnitDef> = {
  // Weight (base = gram)
  "g": { label: "g", category: "weight", toBase: 1 },
  "kg": { label: "kg", category: "weight", toBase: 1000 },
  "oz": { label: "oz", category: "weight", toBase: 28.35 },
  "lb": { label: "lb", category: "weight", toBase: 453.6 },
  // Volume (base = milliliter)
  "ml": { label: "ml", category: "volume", toBase: 1 },
  "L": { label: "L", category: "volume", toBase: 1000 },
  "tsp": { label: "tsp", category: "volume", toBase: 5 },
  "tbsp": { label: "tbsp", category: "volume", toBase: 15 },
  "cup": { label: "cup", category: "volume", toBase: 240 },
  "fl oz": { label: "fl oz", category: "volume", toBase: 30 },
  // Count
  "pc": { label: "pc", category: "count", toBase: 1 },
  "pcs": { label: "pcs", category: "count", toBase: 1 },
  "pack": { label: "pack", category: "count", toBase: 1 },
  "packs": { label: "packs", category: "count", toBase: 1 },
  "box": { label: "box", category: "count", toBase: 1 },
  "boxes": { label: "boxes", category: "count", toBase: 1 },
  "tray": { label: "tray", category: "count", toBase: 1 },
  "trays": { label: "trays", category: "count", toBase: 1 },
  "sack": { label: "sack", category: "count", toBase: 1 },
  "sacks": { label: "sacks", category: "count", toBase: 1 },
  "bottle": { label: "bottle", category: "count", toBase: 1 },
  "bottles": { label: "bottles", category: "count", toBase: 1 },
  "roll": { label: "roll", category: "count", toBase: 1 },
  "rolls": { label: "rolls", category: "count", toBase: 1 },
  "sheet": { label: "sheet", category: "count", toBase: 1 },
  "sheets": { label: "sheets", category: "count", toBase: 1 },
  "can": { label: "can", category: "count", toBase: 1 },
  "cans": { label: "cans", category: "count", toBase: 1 },
};

export function getUnitDef(unit: string): UnitDef | undefined {
  return UNIT_DEFS[unit.toLowerCase()];
}

export function getCategory(unit: string): UnitCategory | undefined {
  return UNIT_DEFS[unit.toLowerCase()]?.category;
}

export function isConvertible(from: string, to: string): boolean {
  const a = getUnitDef(from);
  const b = getUnitDef(to);
  if (!a || !b) return false;
  if (a.category === "count" && b.category === "count") return true;
  return a.category === b.category;
}

export function convert(value: number, from: string, to: string): number {
  const a = getUnitDef(from);
  const b = getUnitDef(to);
  if (!a || !b) return value;
  if (a.category !== b.category && a.category !== "count") return value;
  const inBase = value * a.toBase;
  return inBase / b.toBase;
}

export function suggestUnits(baseUnit: string): string[] {
  const def = getUnitDef(baseUnit);
  if (!def) return [baseUnit];
  return Object.entries(UNIT_DEFS)
    .filter(([_, d]) => d.category === def.category)
    .map(([key, _]) => key)
    .filter((u, i, arr) => arr.indexOf(u) === i);
}

export function formatQty(qty: number): string {
  if (Number.isInteger(qty)) return qty.toString();
  if (Math.abs(qty) < 0.01) return qty.toFixed(4);
  if (Math.abs(qty) < 1) return qty.toFixed(3);
  return qty.toFixed(2);
}
