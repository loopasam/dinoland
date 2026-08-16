export const DINO_SPECIES = ['triceratops', 'trex', 'brachiosaurus'] as const;
export type DinoSpecies = typeof DINO_SPECIES[number];
export type DinoPersonality = 'eager' | 'steady' | 'sleepy';

export interface DinoProfile {
  species: DinoSpecies;
  kind: DinoPersonality;
  travelMsPerPixel: number;
  attractionRadius: number;
}

export const DINO_PROFILES: Record<DinoSpecies, DinoProfile> = {
  triceratops: { species: 'triceratops', kind: 'eager', travelMsPerPixel: 6, attractionRadius: 430 },
  trex: { species: 'trex', kind: 'steady', travelMsPerPixel: 8, attractionRadius: 290 },
  brachiosaurus: { species: 'brachiosaurus', kind: 'sleepy', travelMsPerPixel: 12, attractionRadius: 155 },
};

export function isDinoSpecies(value: unknown): value is DinoSpecies {
  return typeof value === 'string' && DINO_SPECIES.includes(value as DinoSpecies);
}

export function randomDinoSpecies(random = Math.random): DinoSpecies {
  const sampled = random();
  const value = Number.isFinite(sampled) ? sampled : 0;
  const index = Math.min(DINO_SPECIES.length - 1, Math.max(0, Math.floor(value * DINO_SPECIES.length)));
  return DINO_SPECIES[index];
}
