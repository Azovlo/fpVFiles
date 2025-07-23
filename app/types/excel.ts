
export interface ProcessedData {
  fileName: string;
  data: any[];
  columns: string[];
  mappings: { [key: string]: string };
  rowCount: number;
}

export interface StandardColumn {
  key: string;
  label: string;
  icon: string;
}

export interface ConflictData {
  phone: string;
  existing: any;
  new: any;
  resolved: boolean;
}
