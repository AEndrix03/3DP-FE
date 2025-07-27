import { SlicingStatus } from '../../enums/slicing/slicing.enums';

export interface SlicingQueueCreateDto {
  modelId: string;
  slicingPropertyId: string;
  userId: string;
  priority?: number;
}

export interface SlicingQueueDto {
  id: string;
  modelId: string;
  slicingPropertyId: string;
  priority: number;
  status: SlicingStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  progressPercentage?: number;
  createdByUserId: string;
}
