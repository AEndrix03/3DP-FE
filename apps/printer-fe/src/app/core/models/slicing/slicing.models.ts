import { MaterialDto } from '../material.models';
import { SlicingPropertyDto } from './slicing-property.models';

export interface SlicingResultDto {
  id: string;
  sourceId: string;
  generatedId: string;
  lines: number;
  materials: MaterialDto[];
  slicingProperty: SlicingPropertyDto;
  createdAt: Date;
}
