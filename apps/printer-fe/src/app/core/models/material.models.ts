export interface MaterialDto {
  id: string;
  name: string;
  type: string;
  brand: string;
  densityGCm3: string;
  diameterMm: string;
  costPerKg: string;
  recommendedExtruderTempMinC: number;
  recommendedExtruderTempMaxC: number;
  recommendedBedTempC: number;
  requiresHeatedBed: string;
  requiresChamberHeating: string;
  supportsSoluble: string;
  shrinkageFactor: string;
  createdAt: Date;
  updatedAt: Date;
  image: string;
}

export type MaterialCreateDto = Omit<
  MaterialDto,
  'id' | 'createdAt' | 'updatedAt'
>;

export type MaterialUpdateDto = Partial<
  Omit<MaterialDto, 'id' | 'createdAt' | 'updatedAt'>
> & {
  id: string;
};

export interface MaterialFilterDto {
  name?: string;
  id?: string;
}
