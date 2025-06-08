export interface ModelSimpleDto {
  id: string;
  name: string;
}

export interface ModelDetailDto extends ModelSimpleDto {
  filename: string;
  size: string;
  dimensions: string;
  vertices: number;
  faces: number;
  material: MaterialType;
  uploadDate: Date;
  lastModified: Date;
  description: string;
  filePath: string;
}

export type MaterialType = 'PLA' | 'ABS' | 'PETG' | 'TPU' | 'WOOD' | 'CARBON';
