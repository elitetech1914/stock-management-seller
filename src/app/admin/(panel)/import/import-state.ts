export type ImportState = {
  success: boolean;
  message: string;

  totalRows: number;

  created: number;
  updated: number;

  variantsCreated: number;
  variantsUpdated: number;

  failed: number;

  errors: string[];
};

export const initialImportState: ImportState = {
  success: false,
  message: "",

  totalRows: 0,

  created: 0,
  updated: 0,

  variantsCreated: 0,
  variantsUpdated: 0,

  failed: 0,

  errors: [],
};