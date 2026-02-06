import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import analyzeRoutes from './routes/analyze';
import type { AnalysisResult as _AnalysisResult } from './types';
const app = express();
const PORT = 3000;

// Enable CORS so the Frontend can talk to us
app.use(cors());
// Enable parsing of JSON bodies
app.use(bodyParser.json());

// Tell the server to use our analysis routes
app.use('/api', analyzeRoutes);

app.listen(PORT, () => {
    console.log(`✅ CodeSense Backend is running on http://localhost:${PORT}`);
});