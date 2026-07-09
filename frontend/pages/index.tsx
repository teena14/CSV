import Head from 'next/head';
import { useState, useCallback } from 'react';
import StepIndicator from '../components/StepIndicator';
import UploadZone from '../components/UploadZone';
import PreviewTable from '../components/PreviewTable';
import ProgressBar from '../components/ProgressBar';
import ResultsTable from '../components/ResultsTable';
import { SunIcon, MoonIcon, LogoIcon } from '../components/Icons';
import { uploadCSV, confirmImport } from '../lib/api';
import { useImportPolling } from '../lib/useImportPolling';
import type { PreviewData, ImportResult, AppStep } from '../types';

interface HomeProps {
  toggleTheme: () => void;
  theme: 'light' | 'dark';
}

export default function Home({ toggleTheme, theme }: HomeProps) {
  const [step, setStep] = useState<AppStep>('upload');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { 
    batchesDone, 
    totalBatches, 
    setBatchesDone, 
    setTotalBatches, 
    startPolling, 
    stopPolling 
  } = useImportPolling();

  const reset = useCallback(() => {
    setStep('upload');
    setPreview(null);
    setResult(null);
    setError('');
    setIsLoading(false);
    setBatchesDone(0);
    setTotalBatches(1);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setIsLoading(true);
    try {
      const data = await uploadCSV(file);
      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setError('');
    setIsLoading(true);
    setStep('processing');

    const batchCount = Math.ceil(preview.totalRows / 10);
    startPolling(preview.sessionId, batchCount);

    try {
      const data = await confirmImport(preview.sessionId);
      stopPolling();
      setTotalBatches(batchCount);
      setBatchesDone(data.totalRows > 0 ? batchCount : 0);
      await new Promise(r => setTimeout(r, 300));
      setResult(data);
      setStep('results');
    } catch (err) {
      stopPolling();
      setError(err instanceof Error ? err.message : 'AI processing failed.');
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  }, [preview, startPolling, stopPolling, setTotalBatches, setBatchesDone]);

  return (
    <>
      <Head>
        <title>GrowEasy — CSV Importer</title>
        <meta name="description" content="AI-powered CSV importer for GrowEasy CRM. Upload any CSV format and let AI map your fields." />
      </Head>

      <div className="app-shell">
        {/* Header */}
        <header className="app-header">
          <div className="app-header-inner">
            <a href="/" className="logo" aria-label="GrowEasy">
              <div className="logo-mark">
                <LogoIcon size={14} />
              </div>
              <span className="logo-name">GrowEasy</span>


            </a>

            <div className="header-right">
              <span className="logo-product">CSV Importer</span>
              <div className="logo-divider" />
              <button
                className="theme-btn"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                id="theme-toggle-btn"
              >
                {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
              </button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="app-main">
          {step !== 'upload' && <StepIndicator currentStep={step} />}

          {/* Error */}
          {error && (
            <div className="alert alert-error fade-up" role="alert" style={{ marginBottom: 'var(--s5)' }}>
              <span className="alert-icon" style={{ flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 'var(--text-sm)' }}>Error</div>
                <div style={{ fontSize: 'var(--text-sm)' }}>{error}</div>
              </div>
              <button className="alert-close" onClick={() => setError('')} aria-label="Dismiss error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {step === 'upload' && <UploadZone onFileSelected={handleFile} isLoading={isLoading} />}
          {step === 'preview' && preview && <PreviewTable data={preview} onConfirm={handleConfirm} onReset={reset} isLoading={isLoading} />}
          {step === 'processing' && preview && <ProgressBar batchesDone={batchesDone} totalBatches={totalBatches} filename={preview.filename} totalRows={preview.totalRows} onCancel={reset} />}
          {step === 'results' && result && preview && <ResultsTable result={result} filename={preview.filename} onReset={reset} />}
        </main>

        {/* Footer */}
        <footer className="app-footer">
          GrowEasy CRM · AI-Powered CSV Importer
        </footer>
      </div>
    </>
  );
}
