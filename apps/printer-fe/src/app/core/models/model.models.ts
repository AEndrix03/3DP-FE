export interface ModelDto {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  resourceId: string;
}

export interface ModelSaveDto {
  id: string;
  name: string;
  description: string;
}
