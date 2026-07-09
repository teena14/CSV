'use client';

import React from 'react';
import { CheckIcon } from './Icons';
import type { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const STEPS = [
  { id: 'upload',  label: 'Upload'  },
  { id: 'preview', label: 'Preview' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'results', label: 'Results' },
];

const ORDER: Record<string, number> = {
  upload: 0, preview: 1, processing: 2, confirm: 2, results: 3,
};

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const cur = ORDER[currentStep] ?? 0;

  return (
    <nav className="step-indicator" aria-label="Import progress">
      {STEPS.map((step, idx) => {
        const done   = cur > idx;
        const active = cur === idx;

        return (
          <React.Fragment key={step.id}>
            <div className="step-item">
              <div
                className={`step-circle${active ? ' active' : ''}${done ? ' done' : ''}`}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <CheckIcon size={11} /> : idx + 1}
              </div>
              <span className={`step-label${active ? ' active' : ''}${done ? ' done' : ''}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`step-connector${done ? ' done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
