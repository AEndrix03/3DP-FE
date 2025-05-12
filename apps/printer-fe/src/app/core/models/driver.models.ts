export interface DriverDto {
  id: string;
  lastAuth: Date;
  publicKey: string;
}

export interface DriverCreateDto {
  publicKey: string;
}

export interface DriverSaveDto extends DriverCreateDto {
  id: string;
}
