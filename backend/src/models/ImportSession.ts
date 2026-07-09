import mongoose, { Document, Schema } from 'mongoose';
import type { CRMRecord, SkippedRecord } from '../types';

// CRM Record subdocument schema
const CRMRecordSchema = new Schema<CRMRecord>(
  {
    created_at: { type: String, default: '' },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    country_code: { type: String, default: '' },
    mobile_without_country_code: { type: String, default: '' },
    company: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    lead_owner: { type: String, default: '' },
    crm_status: { type: String, default: '' },
    crm_note: { type: String, default: '' },
    data_source: { type: String, default: '' },
    possession_time: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const SkippedRecordSchema = new Schema<SkippedRecord>(
  {
    row: { type: Number, required: true },
    reason: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

export interface IImportSession extends Document {
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
  // Temp storage for preview (not persisted long-term)
  rawRows: Record<string, string>[];
}

const ImportSessionSchema = new Schema<IImportSession>(
  {
    filename: { type: String, required: true },
    originalHeaders: [{ type: String }],
    totalRows: { type: Number, default: 0 },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    batchesDone: { type: Number, default: 0 },
    totalBatches: { type: Number, default: 0 },
    processingError: { type: String, default: '' },
    successCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    records: [CRMRecordSchema],
    skippedRecords: [SkippedRecordSchema],
    processedAt: { type: Date, default: Date.now },
    rawRows: [{ type: Schema.Types.Mixed }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const ImportSessionModel = mongoose.model<IImportSession>(
  'ImportSession',
  ImportSessionSchema
);
