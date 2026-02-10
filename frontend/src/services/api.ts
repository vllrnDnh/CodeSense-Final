// frontend/src/services/api.ts
import type { AnalysisResult } from '../types';

// REMOVED the trailing slash here to prevent path issues
const API_BASE_URL = 'https://l00qvddz-3000.asse.devtunnels.ms';

export const analyzeCode = async (sourceCode: string): Promise<AnalysisResult> => {
  // ADDED /api/analyze to hit the correct route defined in your backend
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceCode, hintsUsed: 0 })
  });

  if (!response.ok) {
    // This logs the status code to help us debug (e.g., 404 vs 500)
    console.error(`Backend returned status: ${response.status}`);
    throw new Error('Analysis failed');
  }

  return response.json();
};