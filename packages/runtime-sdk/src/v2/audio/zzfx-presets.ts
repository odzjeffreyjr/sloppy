/**
 * ZzFX preset library — maps common game events to ZzFX parameter arrays.
 *
 * Each preset is a tuple of ZzFX parameters that can be played via:
 *   zzfx(...SFX.jump)
 *
 * Parameter order: volume, randomness, frequency, attack, sustain, release,
 * shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime,
 * noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo
 */

export type ZzFXParams = readonly number[];

export const SFX: Record<string, ZzFXParams> = {
  // Movement
  jump:      [,,220,,.1,,.3,2,,,,,.12,.1],
  land:      [.5,,123,.01,,.03,,1.8,,,,,,8,-2],
  walk:      [.1,,150,.01,.01,.01,4,.5,,,,,,20],
  dash:      [,,880,,.06,.04,,1.3,,7,,,,6],

  // Combat
  shoot:     [,,90,.01,.03,.02,4,2,,,,,,,4],
  hit:       [1,.1,480,.03,.1,.02,1,.5,,,,,,.5],
  explosion: [2,.1,130,.01,.6,.5,4,.1,,30,,,,.5,-5],

  // Collectibles
  coin:      [,,537,.02,.02,.22,1,1.59,-6.98,4.97],
  powerUp:   [,,660,,.1,.3,1,1.8,,7,,,.09],

  // UI
  select:    [,,440,,.03,.03,1,2,,,100,.03],
  confirm:   [,,660,,.05,.1,1,1.5],
  back:      [,,220,,.05,.1,1,.5],

  // Game states
  levelUp:   [1.5,.8,270,,.1,,1,1.5,,,,,,.1,.01],
  gameOver:  [,,925,.04,.3,.6,1,.3,,6.27,-184,.09,.17],

  // 3D-specific
  engineRev: [.5,,50,.1,.3,.5,4,.2,-2,,,,,.8],
  impact:    [2,,100,.01,.1,.2,4,1.5,,,-200,.1,,2],
} as const;

/** All available SFX key names. */
export type SFXKey = keyof typeof SFX;

/** Returns the SFX preset map as a JavaScript string for inline injection. */
export function getSFXInlineSource(): string {
  const entries = Object.entries(SFX)
    .map(([key, params]) => `  ${key}: [${params.join(',')}]`)
    .join(',\n');
  return `const SFX = {\n${entries}\n};`;
}
