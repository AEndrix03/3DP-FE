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
}
