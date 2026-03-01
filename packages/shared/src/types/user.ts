/** A registered Sloppy platform user. */
export interface User {
  id: string;
  email: string;
  displayName?: string;
  createdAt: Date;
}
