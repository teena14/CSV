'use client';

import React from 'react';
import { ZapIcon, CheckIcon, LoaderIcon } from './Icons';

interface ProgressBarProps {
  batchesDone: number;
  totalBatches: number;
  filename: string;
  totalRows: number;
  onCancel?: () => void;
}

export default function ProgressBar({ batchesDone, totalBatches, filename, totalRows, onCancel }: ProgressBarProps) {
  const pct = totalBatches > 0 ? Math.round((batchesDone / totalBatches) * 100) : 0;
  const estimated = Math.min(Math.round((batchesDone / Math.max(totalBatches, 1)) * totalRows), totalRows);

  return (
    <div className="progress-page fade-up">
      <div className="progress-icon-wrap">
        <ZapIcon size={22} />
      </div>

      <div className="progress-heading">
        <h2>AI is mapping your data</h2>
        <p>
          Extracting CRM fields from <strong style={{ color: 'var(--text-1)' }}>{filename}</strong>
        </p>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
        <div className="progress-labels">
          <span>
            {pct < 100
              ? `${batchesDone} of ${totalBatches} batches completed`
              : 'Finalizing…'}
          </span>
          <span>{pct}%</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Import progress"
        >
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-labels">
          <span>~{estimated.toLocaleString()} / {totalRows.toLocaleString()} rows</span>
          <span>{totalBatches} batch{totalBatches !== 1 ? 'es' : ''}</span>
        </div>
      </div>

      <div className="progress-steps">
        <div className="progress-step-pill active">
          Processing<span className="dots"></span>
        </div>
      </div>

      {onCancel && (
        <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ marginTop: 'var(--s2)' }}>
          Cancel Import
        </button>
      )}
    </div>
  );
}
