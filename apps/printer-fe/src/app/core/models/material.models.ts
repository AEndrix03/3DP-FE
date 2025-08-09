export type MaterialCreateDto = Omit<
  MaterialDto,
  'id' | 'createdAt' | 'updatedAt'
>;

export type MaterialUpdateDto = Partial<
  Omit<MaterialDto, 'id' | 'createdAt' | 'updatedAt'>
> & {
  id: string;
};

export interface MaterialTypeDto {
  id?: string;
  name: string;
  description?: string;
  typicalTempMinC?: number;
  typicalTempMaxC?: number;
  typicalBedTempC?: number;
  isFlexible: boolean;
  isSoluble: boolean;
  requiresHeatedBed: boolean;
  requiresEnclosure: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MaterialBrandDto {
  id?: string;
  name: string;
  description?: string;
  website?: string;
  country?: string;
  qualityRating?: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MaterialDto {
  id?: string;
  name: string;
  type?: MaterialTypeDto;
  brand?: MaterialBrandDto;
  typeName?: string;
  brandName?: string;
  densityGCm3?: string;
  diameterMm?: string;
  costPerKg?: string;
  recommendedExtruderTempMinC?: number;
  recommendedExtruderTempMaxC?: number;
  recommendedBedTempC?: number;
  requiresHeatedBed?: string;
  requiresChamberHeating?: string;
  supportsSoluble?: string;
  shrinkageFactor?: string;
  createdAt?: Date;
  updatedAt?: Date;
  image?: string;
}

export interface MaterialFilterDto {
  name?: string;
  type?: string;
  brand?: string;
  id?: string;
}
