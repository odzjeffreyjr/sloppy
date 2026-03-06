export type GameEngine = 'phaser3' | 'threejs' | 'canvas2d';

export type GameGenre =
  | '2d-platformer'
  | '2d-topdown'
  | '2d-puzzle'
  | '2d-arcade'
  | '2d-shooter'
  | '2d-tower-defense'
  | '2d-endless-runner'
  | '2d-rhythm'
  | '2d-cards'
  | '2d-idle'
  | '2d-custom'
  | '3d-firstperson'
  | '3d-thirdperson'
  | '3d-racing'
  | '3d-puzzle'
  | '3d-flight'
  | '3d-platformer'
  | '3d-custom';

export const ALL_2D_GENRES: GameGenre[] = [
  '2d-platformer', '2d-topdown', '2d-puzzle', '2d-arcade', '2d-shooter',
  '2d-tower-defense', '2d-endless-runner', '2d-rhythm', '2d-cards', '2d-idle', '2d-custom',
];

export const ALL_3D_GENRES: GameGenre[] = [
  '3d-firstperson', '3d-thirdperson', '3d-racing', '3d-puzzle', '3d-flight', '3d-platformer', '3d-custom',
];

export const ALL_GENRES: GameGenre[] = [...ALL_2D_GENRES, ...ALL_3D_GENRES];
