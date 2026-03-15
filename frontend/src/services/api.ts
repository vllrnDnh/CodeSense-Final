// frontend/src/services/api.ts
import type { AnalysisResult } from '../types';

// Use environment variable for API URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const analyzeCode = async (sourceCode: string): Promise<AnalysisResult> => {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Tunnel-Skip-AntiPhishing-Page': 'true' 
    },
    body: JSON.stringify({ sourceCode, hintsUsed: 0 })
  });

  if (!response.ok) {
    console.error(`Backend returned status: ${response.status}`);
    throw new Error('Analysis failed');
  }

  return response.json();
};