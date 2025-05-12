export interface SlicingResultDto {
  id: string;
  sourceId: string;
  parameters: Record<string, any>;
  logs: string;
  createdAt: Date;
}
