export const DEFAULT_KIT_SIZE = "M (11-12yrs)";

export const KIT_SIZE_OPTIONS = [
  "XS (4-6yrs)",
  "S (7-10ys)",
  "M (11-12yrs)",
  "L (13-14yrs)",
  "XL (S Adult)",
  "2XL (M Adult)",
  // Keep legacy/simple values selectable so older imported rows still display instead of blank.
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
] as const;

export function getKitSizeValue(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed || DEFAULT_KIT_SIZE;
}

export function getKitSizeOptions(currentValue?: string | null): string[] {
  const current = currentValue?.trim();
  if (current && !KIT_SIZE_OPTIONS.includes(current as typeof KIT_SIZE_OPTIONS[number])) {
    return [current, ...KIT_SIZE_OPTIONS];
  }
  return [...KIT_SIZE_OPTIONS];
}