// Shared types for the CSV Importer backend

export type CRMStatus =
  | 'GOOD_LEAD_FOLLOW_UP'
  | 'DID_NOT_CONNECT'
  | 'BAD_LEAD'
  | 'SALE_DONE';

export type DataSource =
  | 'leads_on_demand'
  | 'meridian_tower'
  | 'eden_park'
  | 'varah_swamy'
  | 'sarjapur_plots'
  | '';

export interface CRMRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CRMStatus | '';
  crm_note: string;
  data_source: DataSource;
  possession_time: string;
  description: string;
}

export interface SkippedRecord {
  row: number;
  reason: string;
  data: Record<string, string>;
}

export interface ImportSession {
  _id: string;
  filename: string;
  originalHeaders: string[];
  totalRows: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  batchesDone: number;
  totalBatches: number;
  processingError: string;
  successCount: number;
  skippedCount: number;
  records: CRMRecord[];
  skippedRecords: SkippedRecord[];
  processedAt: Date;
}

export interface PreviewResponse {
  sessionId: string;
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  preview: Record<string, string>[]; // first 10 rows for preview
}

export interface ImportResponse {
  sessionId: string;
  records: CRMRecord[];
  skippedRecords: SkippedRecord[];
  successCount: number;
  skippedCount: number;
  totalRows: number;
}

export interface ImportProgressResponse {
  sessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  batchesDone: number;
  totalBatches: number;
  totalRows: number;
  successCount: number;
  skippedCount: number;
  error?: string;
}

export interface BatchResult {
  records: CRMRecord[];
  skippedRecords: SkippedRecord[];
}

export interface AIExtractionInput {
  headers: string[];
  rows: Record<string, string>[];
  batchIndex: number;
}
