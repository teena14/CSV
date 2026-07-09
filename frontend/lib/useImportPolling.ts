import { useState, useCallback, useRef } from 'react';
import { getImportProgress } from './api';

export function useImportPolling() {
  const [batchesDone, setBatchesDone] = useState(0);
  const [totalBatches, setTotalBatches] = useState(1);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  const startPolling = useCallback((sessionId: string, initialTotalBatches: number) => {
    setTotalBatches(initialTotalBatches);
    setBatchesDone(0);

    const poll = async () => {
      try {
        const progress = await getImportProgress(sessionId);
        setBatchesDone(progress.batchesDone);
        setTotalBatches(progress.totalBatches || initialTotalBatches);

        if (progress.status === 'failed') {
          stopPolling();
          throw new Error(progress.error || 'AI processing failed.');
        }
      } catch (err) {
        // The confirm request is the source of truth for failures; brief polling
        // misses can happen while the session is starting. Ignore network hiccups.
      }
    };

    pollTimer.current = setInterval(poll, 1000);
    poll(); // Immediate first tick
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  return { 
    batchesDone, 
    totalBatches, 
    setBatchesDone, 
    setTotalBatches, 
    startPolling, 
    stopPolling 
  };
}
