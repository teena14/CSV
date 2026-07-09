'use client';

import React, { useMemo, useState } from 'react';
import { FileIcon, ChevronLeftIcon, ChevronRightIcon, XIcon, SparkleIcon } from './Icons';
import type { PreviewData } from '../types';

interface PreviewTableProps {
  data: PreviewData;
  onConfirm: () => void;
  onReset: () => void;
  isLoading?: boolean;
}

const PAGE_SIZE = 50;

export default function PreviewTable({ data, onConfirm, onReset, isLoading }: PreviewTableProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(data.rows.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const visibleRows = useMemo(() => data.rows.slice(start, start + PAGE_SIZE), [data.rows, start]);
  const rowStart = start + 1;
  const rowEnd = Math.min(start + PAGE_SIZE, data.rows.length);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 'var(--s3)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onReset} disabled={isLoading} style={{ marginLeft: '-8px' }}>
          <ChevronLeftIcon size={14} /> Back to Upload
        </button>
      </div>

      {/* File strip */}
      <div className="file-strip">
        <div className="file-strip-icon">
          <FileIcon size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="file-strip-name">{data.filename}</div>
          <div className="file-strip-meta">
            {data.totalRows.toLocaleString()} rows · {data.headers.length} columns
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onReset} disabled={isLoading} title="Remove file">
          <XIcon size={13} />
          Remove
        </button>
      </div>

      {/* Section header */}
      <div className="section-header">
        <div>
          <div className="section-title">CSV Preview</div>
          <div className="section-sub">
            Rows {rowStart}–{rowEnd} of {data.totalRows.toLocaleString()} · No AI processing yet
          </div>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              aria-label="Previous page"
            >
              <ChevronLeftIcon size={13} /> Prev
            </button>
            <span className="pagination-label">{page + 1} / {totalPages}</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1 || isLoading}
              aria-label="Next page"
            >
              Next <ChevronRightIcon size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="table-wrap" role="region" aria-label="CSV preview">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              {data.headers.map(h => <th key={h} title={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => {
              const n = start + i + 1;
              return (
                <tr key={n}>
                  <td className="row-num">{n}</td>
                  {data.headers.map(h => (
                    <td key={h} title={row[h] || ''}>
                      {row[h] || <span className="cell-empty">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action bar */}
      <div className="action-bar">
        <div className="action-bar-text">
          <div className="action-bar-title">Ready to process with AI?</div>
          <div className="action-bar-desc">
            AI will map {data.headers.length} columns to GrowEasy CRM fields
          </div>
        </div>
        <div className="action-bar-btns">
          <button className="btn btn-secondary" onClick={onReset} disabled={isLoading}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={onConfirm}
            disabled={isLoading}
            id="confirm-import-btn"
          >
            {isLoading
              ? <><span className="spin"><SparkleIcon size={14} /></span> Processing…</>
              : <><SparkleIcon size={14} /> Confirm Import</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
