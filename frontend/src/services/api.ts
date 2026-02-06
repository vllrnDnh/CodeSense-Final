// FIX: Add 'type' keyword here
import type { AnalysisResult } from '../types';

const API_URL = 'http://localhost:3000/api/analyze';

export const analyzeCode = async (sourceCode: string): Promise<AnalysisResult> => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceCode, hintsUsed: 0 })
  });

  if (!response.ok) {
    throw new Error('Analysis failed');
  }

  return response.json();
};