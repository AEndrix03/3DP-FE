export interface PrinterDto {
  id: string;
  name: string;
  driverId: string;
  lastSeen: Date;
  imageUrl?: string;
}

export interface PrinterCreateDto {
  name: string;
}

export interface PrinterSaveDto extends PrinterCreateDto {
  id: string;
}

export interface PrinterFilterDto {
  name?: string;
  driverId?: string;
}

export interface PrinterStatusDto {
  code: string;
  description: string;
}
