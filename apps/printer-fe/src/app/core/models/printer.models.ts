export interface PrinterDto {
  id: string;
  name: string;
  driverId: string;
  status?: PrinterStatusDto;
  lastSeen: Date;
  image?: string;
}

export interface PrinterCreateDto {
  name: string;
  driverId?: string;
}

export interface PrinterSaveDto extends PrinterCreateDto {
  id: string;
}

export interface PrinterFilterDto {
  name?: string;
  driverId?: string;
  status?: string | null;
}

export interface PrinterStatusDto {
  code: string;
  description: string;
}

export interface PrinterDetailDto extends PrinterDto {
  firmwareVersionId?: string;
  firmwareInstalledAt?: Date;
  buildVolumeXMm?: string;
  buildVolumeYMm?: string;
  buildVolumeZMm?: string;
  buildPlateMaterial?: string;
  extruderCount?: number;
  nozzleDiameterMm?: string;
  maxNozzleTempC?: number;
  hotendType?: string;
  kinematicsType?: string;
  maxPrintSpeedMmS?: string;
  maxTravelSpeedMmS?: string;
  maxAccelerationMmS2?: string;
  maxJerkMmS?: string;
  hasHeatedBed?: string;
  maxBedTempC?: number;
  bedSizeXMm?: string;
  bedSizeYMm?: string;
  hasHeatedChamber?: string;
  maxChamberTempC?: number;
  hasAutoBedLeveling?: string;
  bedLevelingType?: string;
  hasFilamentSensor?: string;
  hasPowerRecovery?: string;
  hasResumePrint?: string;
  minLayerHeightMm?: string;
  maxLayerHeightMm?: string;
  specificationsCreatedAt?: Date;
  specificationsUpdatedAt?: Date;
}

export interface PrinterDetailSaveDto {
  id?: string;
  image: string;
  name: string;
  driverId?: string;
  firmwareVersionId?: string;
  buildVolumeXMm?: string;
  buildVolumeYMm?: string;
  buildVolumeZMm?: string;
  buildPlateMaterial?: string;
  extruderCount?: number;
  nozzleDiameterMm?: string;
  maxNozzleTempC?: number;
  hotendType?: string;
  kinematicsType?: string;
  maxPrintSpeedMmS?: string;
  maxTravelSpeedMmS?: string;
  maxAccelerationMmS2?: string;
  maxJerkMmS?: string;
  hasHeatedBed?: string;
  maxBedTempC?: number;
  bedSizeXMm?: string;
  bedSizeYMm?: string;
  hasHeatedChamber?: string;
  maxChamberTempC?: number;
  hasAutoBedLeveling?: string;
  bedLevelingType?: string;
  hasFilamentSensor?: string;
  hasPowerRecovery?: string;
  hasResumePrint?: string;
  minLayerHeightMm?: string;
  maxLayerHeightMm?: string;
}
