/** A user's favourite relationship with a game. */
export interface Favourite {
  userId: string;
  gameId: string;
  createdAt: Date;
}
