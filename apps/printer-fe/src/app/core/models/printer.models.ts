export interface PrinterDto {
  id: string;
  name: string;
  driverId: string;
  lastSeen: Date;
}

export interface PrinterCreateDto {
  name: string;
}

export interface PrinterSaveDto extends PrinterCreateDto {
  id: string;
}
