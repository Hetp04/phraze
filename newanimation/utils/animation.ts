/**
 * Clamps a value between a minimum and maximum value.
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Maps a value from one range to another.
 * @param value The incoming value
 * @param inMin Input range minimum
 * @param inMax Input range maximum
 * @param outMin Output range minimum
 * @param outMax Output range maximum
 */
export const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => {
  const clampedValue = clamp(value, inMin, inMax);
  return outMin + ((clampedValue - inMin) * (outMax - outMin)) / (inMax - inMin);
};

/**
 * Smoothstep interpolation (Hermite interpolation).
 * Great for smoothing out start/end of animations.
 */
export const smoothStep = (min: number, max: number, value: number): number => {
  const x = clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * Custom ease function for that "luxury" feel (Quad Ease In Out)
 */
export const easeInOutQuad = (t: number): number => {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
};
