export interface JobSimpleDto {
  id: string;
  modelId: string;
  printerName: string;
  statusCode: JobStatusCode;
  statusDescription: string;
  slicerName: string;
  submittedAt: string;
}

export interface JobStatusDto {
  code: JobStatusCode;
  description: string;
}

export type JobStatusCode = 'CRE' | 'QUE' | 'RUN' | 'STP' | 'ERR' | 'CMP';

export interface JobStartRequestDto {
  printerId: string;
  slicingId: string;
}
