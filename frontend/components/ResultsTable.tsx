'use client';

import React, { useMemo, useState } from 'react';
import { CheckIcon, XIcon, DownloadIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon, DatabaseIcon } from './Icons';
import type { ImportResult, CRMRecord, SkippedRecord } from '../types';

interface ResultsTableProps {
  result: ImportResult;
  filename: string;
  onReset: () => void;
}

const CRM_FIELDS: { key: keyof CRMRecord; label: string }[] = [
  { key: 'name',                         label: 'Name' },
  { key: 'email',                        label: 'Email' },
  { key: 'country_code',                 label: 'Code' },
  { key: 'mobile_without_country_code',  label: 'Mobile' },
  { key: 'company',                      label: 'Company' },
  { key: 'city',                         label: 'City' },
  { key: 'state',                        label: 'State' },
  { key: 'country',                      label: 'Country' },
  { key: 'crm_status',                   label: 'Status' },
  { key: 'lead_owner',                   label: 'Owner' },
  { key: 'data_source',                  label: 'Source' },
  { key: 'created_at',                   label: 'Created At' },
  { key: 'crm_note',                     label: 'Notes' },
  { key: 'possession_time',              label: 'Possession' },
  { key: 'description',                  label: 'Description' },
];

type StatusBadgeVariant = 'green' | 'amber' | 'red' | 'orange';

function statusBadge(status: string): { label: string; variant: StatusBadgeVariant } {
  switch (status) {
    case 'GOOD_LEAD_FOLLOW_UP': return { label: 'Good Lead',       variant: 'green'  };
    case 'DID_NOT_CONNECT':     return { label: 'Did Not Connect', variant: 'amber'  };
    case 'BAD_LEAD':            return { label: 'Bad Lead',        variant: 'red'    };
    case 'SALE_DONE':           return { label: 'Sale Done',       variant: 'orange' };
    default:                    return { label: status,            variant: 'amber'  };
  }
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="cell-empty">—</span>;
  const { label, variant } = statusBadge(status);
  return <span className={`badge badge-${variant}`}>{label}</span>;
}

function exportCSV(records: CRMRecord[], filename: string) {
  const headers = CRM_FIELDS.map(f => f.key).join(',');
  const rows = records.map(rec =>
    CRM_FIELDS.map(f => `"${String(rec[f.key] || '').replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `groweasy_${filename.replace('.csv', '')}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 50;

export default function ResultsTable({ result, filename, onReset }: ResultsTableProps) {
  const [tab, setTab] = useState<'success' | 'skipped'>('success');
  const [page, setPage] = useState(0);

  const { records, skippedRecords, successCount, skippedCount, totalRows } = result;
  const importRate = totalRows > 0 ? Math.round((successCount / totalRows) * 100) : 0;

  const activeData = tab === 'success' ? records : skippedRecords;
  const totalPages = Math.ceil(activeData.length / PAGE_SIZE);
  const visibleRows = useMemo(
    () => activeData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [activeData, page]
  );

  const switchTab = (t: 'success' | 'skipped') => { setTab(t); setPage(0); };

  return (
    <div className="fade-up">
      {/* Success banner */}
      <div className="results-banner">
        <CheckIcon size={15} />
        <span>
          Import complete —{' '}
          <strong>{successCount.toLocaleString()} records</strong> mapped to GrowEasy CRM format
        </span>
      </div>

      {/* Stats */}
      <div className="stats-row fade-up-1">
        <div className="stat-card">
          <div className="stat-value">{totalRows.toLocaleString()}</div>
          <div className="stat-label">Total Rows</div>
        </div>
        <div className="stat-card is-success">
          <div className="stat-value">{successCount.toLocaleString()}</div>
          <div className="stat-label">Imported</div>
        </div>
        <div className="stat-card is-error">
          <div className="stat-value">{skippedCount.toLocaleString()}</div>
          <div className="stat-label">Skipped</div>
        </div>
        <div className="stat-card is-accent">
          <div className="stat-value">{importRate}%</div>
          <div className="stat-label">Success Rate</div>
        </div>
      </div>

      {/* Tabs + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s4)', gap: 'var(--s4)', flexWrap: 'wrap' }}>
        <div className="tabs" role="tablist">
          <button
            className={`tab-btn${tab === 'success' ? ' active' : ''}`}
            onClick={() => switchTab('success')}
            role="tab"
            aria-selected={tab === 'success'}
            id="tab-success"
          >
            <CheckIcon size={12} />
            Imported
            <span className="tab-count">{successCount}</span>
          </button>
          <button
            className={`tab-btn${tab === 'skipped' ? ' active' : ''}`}
            onClick={() => switchTab('skipped')}
            role="tab"
            aria-selected={tab === 'skipped'}
            id="tab-skipped"
          >
            <XIcon size={12} />
            Skipped
            <span className="tab-count">{skippedCount}</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--s2)' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => exportCSV(records, filename)}
            disabled={records.length === 0}
          >
            <DownloadIcon size={13} /> Export CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={onReset}>
            <PlusIcon size={13} /> New Import
          </button>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeftIcon size={13} /> Prev
          </button>
          <span className="pagination-label">{page + 1} / {totalPages}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>
            Next <ChevronRightIcon size={13} />
          </button>
        </div>
      )}

      {/* Table */}
      {tab === 'success' && (
        records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><DatabaseIcon size={18} /></div>
            <h3>No records imported</h3>
            <p>All rows were skipped. Check the Skipped tab for details.</p>
          </div>
        ) : (
          <div className="table-wrap" role="region" aria-label="CRM records">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  {CRM_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {(visibleRows as CRMRecord[]).map((rec, i) => {
                  const n = page * PAGE_SIZE + i + 1;
                  return (
                    <tr key={n}>
                      <td className="row-num">{n}</td>
                      {CRM_FIELDS.map(f => (
                        <td key={f.key} title={String(rec[f.key] || '')}>
                          {f.key === 'crm_status'
                            ? <StatusBadge status={String(rec[f.key] || '')} />
                            : rec[f.key]
                              ? String(rec[f.key])
                              : <span className="cell-empty">—</span>
                          }
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'skipped' && (
        skippedRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><CheckIcon size={18} /></div>
            <h3>No records were skipped</h3>
            <p>All rows were successfully imported.</p>
          </div>
        ) : (
          <div className="table-wrap" role="region" aria-label="Skipped records">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Row</th>
                  <th>Reason</th>
                  <th>Data Preview</th>
                </tr>
              </thead>
              <tbody>
                {(visibleRows as SkippedRecord[]).map((rec, i) => {
                  const n = page * PAGE_SIZE + i + 1;
                  const preview = Object.entries(rec.data || {})
                    .slice(0, 4)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ');
                  return (
                    <tr key={n} className="skipped-row">
                      <td className="row-num">{n}</td>
                      <td className="row-num">{rec.row + 1}</td>
                      <td title={rec.reason} style={{ color: 'var(--red-text)', maxWidth: 260 }}>{rec.reason}</td>
                      <td title={preview} style={{ color: 'var(--text-3)', maxWidth: 340 }}>{preview || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
