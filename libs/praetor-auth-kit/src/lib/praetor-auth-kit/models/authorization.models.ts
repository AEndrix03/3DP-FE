export interface AuthorizationRequestDto {
  applicationName: string;
  authenticatorName: string;
}

export interface AuthorizationResponseDto {
  userId: string;
  roles: Record<string, string>;
}
