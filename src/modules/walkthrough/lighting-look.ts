/** Shared by initial scene construction and day/night restoration. No new lights. */
export const DAYLIGHT_LOOK = {
  background:'#e7ded0', sky:'#eee9df', ground:'#aa9987', sun:'#fff2dc',
  sunIntensity:2.2, fillIntensity:0.38, exposure:0.9,
} as const;

export const NIGHT_LOOK = {
  background:'#172430', sunIntensity:0.1, fillIntensity:0.24, exposure:1,
} as const;
