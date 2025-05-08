export interface RegisterRequestDto {
  email: string;
  plainPassword: string;
  firstName: string;
  lastName: string;
}

export interface RegisterResponseDto {
  accessToken: string;
  refreshToken: string;
  email: string;
  firstName: string;
  lastName: string;
}
