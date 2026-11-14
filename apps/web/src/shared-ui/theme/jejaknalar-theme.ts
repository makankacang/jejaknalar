export const JEJAKNALAR_COLORS = {
  primaryDark: "#193640",
  primaryDeep: "#102A33",
  primaryMedium: "#31535A",
  primarySoft: "#6F9290",
  cream: "#F3E6C8",
  creamLight: "#FFF4D9",
  gold: "#E9C46A",
  goldDark: "#B88B3D",
  wood: "#A97850",
  woodDark: "#684A38",
  earth: "#C29A72",
  green: "#719B72",
  red: "#B9685D",
  muted: "#B8C2BA",
} as const;

export type JejakNalarColor = keyof typeof JEJAKNALAR_COLORS;

/** Converts shared hex tokens to Phaser numeric colors. */
export function toPhaserColor(color: string): number {
  const normalized = color.replace(/^#/, "");

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Invalid JejakNalar color: ${color}`);
  }

  return Number.parseInt(normalized, 16);
}

export const JEJAKNALAR_PHASER_COLORS = Object.fromEntries(
  Object.entries(JEJAKNALAR_COLORS).map(([key, value]) => [
    key,
    toPhaserColor(value),
  ]),
) as { [K in JejakNalarColor]: number };
