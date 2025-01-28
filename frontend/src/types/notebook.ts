export type CellType = 'code' | 'markdown';

export interface IOutput {
  output_type: string;
  text?: string[];
  data?: {
    'text/plain'?: string[];
    'text/html'?: string[];
    [key: string]: any;
  };
  execution_count?: number;
}

export interface ICell {
  id: string;
  cell_type: CellType;
  source: string[];
  execution_count?: number | null;
  outputs?: IOutput[];
  metadata?: Record<string, any>;
  index?: number;
}

export interface INotebook {
  cells: ICell[];
  metadata?: any;
  path?: string;
  nbformat?: number;
  nbformat_minor?: number;
} 