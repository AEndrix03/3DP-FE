export interface PrinterDto {
  id: string;
  name: string;
  driverId: string;
  lastSeen: Date;
  status: PrinterStatusEnum;
}

export interface PrinterCreateDto {
  name: string;
}

export interface PrinterSaveDto extends PrinterCreateDto {
  id: string;
}

export enum PrinterStatusEnum {
  IDLE = 'IDL',
  RUNNING = 'RUN',
  ERROR = 'ERR',
  STOPPED = 'STP',
}
