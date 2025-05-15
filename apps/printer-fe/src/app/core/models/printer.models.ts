export interface PrinterDto {
  id: string;
  name: string;
  driverId: string;
  lastSeen: Date;
  statusCode: string;
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
  statusCode?: string;
}

export interface PrinterStatusDto {
  code: string;
  description: string;
}

export enum PrinterStatusEnum {
  IDLE = 'IDL',
  RUNNING = 'RUN',
  ERROR = 'ERR',
  STOPPED = 'STP',
}
