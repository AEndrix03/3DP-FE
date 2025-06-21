import { MaterialDto } from './material.models';

export interface SlicingResultDto {
  id: string;
  sourceId: string;
  generatedId: string;
  lines: number;
  materials: MaterialDto[];
  slicingProperty: SlicingPropertyDto;
  createdAt: Date;
}

export interface SlicingPropertyDto {
  id: string;
  name: string;
  description: string;
  layerHeightMm: string;
  firstLayerHeightMm: string;
  printSpeedMmS: string;
  travelSpeedMmS: string;
  firstLayerSpeedMmS: string;
  infillPercentage: string;
  infillPattern: string;
  perimeterCount: number;
  topSolidLayers: number;
  bottomSolidLayers: number;
  supportsEnabled: string;
  supportAngleThreshold: string;
  brimEnabled: string;
  brimWidthMm: string;
  extruderTempC: number;
  bedTempC: number;
  advancedSettings: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  isPublic: string;
}
