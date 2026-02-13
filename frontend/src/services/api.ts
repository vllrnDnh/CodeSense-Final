// frontend/src/services/api.ts
import type { AnalysisResult } from '../types';

// REMOVED the trailing slash here to prevent path issues
const API_BASE_URL = 'http://localhost:3000';

export const analyzeCode = async (sourceCode: string): Promise<AnalysisResult> => {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      // CRITICAL: Tells Dev Tunnels to bypass the warning page
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