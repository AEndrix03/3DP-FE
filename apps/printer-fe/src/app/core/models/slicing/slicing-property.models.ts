import {
  AdhesionType,
  InfillPattern,
  QualityProfile,
  SupportPattern,
} from '../../enums/slicing/slicing-property.enums';

export interface SlicingPropertyDto {
  id?: string;
  name: string;
  description?: string;
  layerHeightMm: number;
  firstLayerHeightMm?: number;
  lineWidthMm?: number;
  printSpeedMmS: number;
  firstLayerSpeedMmS?: number;
  travelSpeedMmS?: number;
  infillSpeedMmS?: number;
  outerWallSpeedMmS?: number;
  innerWallSpeedMmS?: number;
  topBottomSpeedMmS?: number;
  infillPercentage: number;
  infillPattern: InfillPattern;
  perimeterCount?: number;
  topSolidLayers?: number;
  bottomSolidLayers?: number;
  topBottomThicknessMm?: number;
  supportsEnabled: boolean;
  supportAngleThreshold?: number;
  supportDensityPercentage?: number;
  supportPattern?: SupportPattern;
  supportZDistanceMm?: number;
  adhesionType?: AdhesionType;
  brimEnabled: boolean;
  brimWidthMm?: number;
  fanEnabled: boolean;
  fanSpeedPercentage?: number;
  retractionEnabled: boolean;
  retractionDistanceMm?: number;
  zhopEnabled: boolean;
  zhopHeightMm?: number;
  extruderTempC?: number;
  bedTempC?: number;
  qualityProfile?: QualityProfile;
  advancedSettings?: string;
  slicerId: string;
  createdByUserId: string;
  isPublic: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  materialIds?: string[];
}

export type SlicingPropertyCreateDto = Omit<
  SlicingPropertyDto,
  'id' | 'created_at' | 'updated_at'
>;

export type SlicingPropertyUpdateDto = Partial<
  Omit<SlicingPropertyDto, 'id' | 'created_at' | 'updated_at'>
> & {
  id: string;
};
