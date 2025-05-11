export interface UserDto {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  roles: Record<string, string>;
}
