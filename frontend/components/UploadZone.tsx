'use client';

import React, { useCallback, useRef, useState } from 'react';
import { UploadIcon, InfoIcon } from './Icons';

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  isLoading?: boolean;
}

const ACCEPTED_TYPES = ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream'];



export default function UploadZone({ onFileSelected, isLoading }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback((file: File) => {
    setError('');
    const isCSV = ACCEPTED_TYPES.includes(file.type) || file.name.toLowerCase().endsWith('.csv');
    if (!isCSV) { setError('Only CSV files are supported (.csv).'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('File exceeds the 10 MB limit.'); return; }
    onFileSelected(file);
  }, [onFileSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validate(file);
  }, [validate]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validate(file);
    e.target.value = '';
  }, [validate]);

  return (
    <div className="upload-page">
      {/* Heading */}
      <div className="upload-heading fade-up mt-10">
        <h1>Import any CSV into GrowEasy CRM</h1>
        <p>
          Upload any CSV file — our AI intelligently maps your columns to CRM fields,
          regardless of format, naming, or structure.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`upload-zone fade-up-1${isDragOver ? ' drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
        onClick={() => !isLoading && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        tabIndex={0}
        role="button"
        aria-label="Upload CSV file — click or drag and drop"
        aria-disabled={isLoading}
      >
        <div className="upload-zone-icon">
          <UploadIcon size={22} />
        </div>

        {isLoading ? (
          <>
            <p className="upload-zone-title">Parsing file...</p>
            <p className="upload-zone-sub">Please wait</p>
          </>
        ) : isDragOver ? (
          <>
            <p className="upload-zone-title">Drop to upload</p>
            <p className="upload-zone-sub">Release your file to begin</p>
          </>
        ) : (
          <>
            <p className="upload-zone-title">Drop your CSV file here</p>
            <p className="upload-zone-sub">
              or <span className="link" onClick={() => inputRef.current?.click()}>click to browse files</span>
            </p>
          </>
        )}

        <div className="upload-hint">
          <InfoIcon size={12} />
          <span>Supported file: .csv (max 10 MB)</span>
        </div>



        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleChange}
          style={{ display: 'none' }}
          disabled={isLoading}
          aria-label="CSV file picker"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error fade-up" role="alert">
          <span className="alert-icon">
            <InfoIcon size={15} />
          </span>
          <span>{error}</span>
          <button className="alert-close" onClick={() => setError('')} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}


    </div>
  );
}
