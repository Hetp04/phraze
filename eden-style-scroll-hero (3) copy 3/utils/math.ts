export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const lerp = (start: number, end: number, t: number): number => {
  return start * (1 - t) + end * t;
};

// Remaps a value from a source range [inMin, inMax] to a target range [outMin, outMax]
// Useful for creating timelines: remap(progress, 0.25, 0.55, 0, 1)
export const remap = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => {
  const t = (value - inMin) / (inMax - inMin);
  const clampedT = clamp(t, 0, 1);
  return lerp(outMin, outMax, clampedT);
};
