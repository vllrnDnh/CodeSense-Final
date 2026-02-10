import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import analyzeRoutes from './routes/analyze';

const app = express();
const PORT = 3000;

// Enable CORS so the Frontend can talk to us
app.use(cors());

// Enable parsing of JSON bodies
app.use(bodyParser.json());

// Request logging for debugging test suite interactions
app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path === '/api/analyze') {
        const snippet = req.body.sourceCode?.substring(0, 40).replace(/\n/g, ' ');
        console.log(`\n--- [DEBUG] New Analysis Request ---`);
        console.log(`Source Snippet: ${snippet}${req.body.sourceCode?.length > 40 ? '...' : ''}`);
    }
    next();
});

// Tell the server to use our analysis routes
app.use('/api', analyzeRoutes);

/**
 * GLOBAL ERROR HANDLER
 * This catches "Syntax/Runtime Crashes" from the parser or symbolic execution 
 * and prevents the backend from sending raw HTML error pages.
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(`🔥 Backend Error Caught: ${err.message}`);

    // Determine if the error is syntactic (likely from the parser)
    const isSyntactic = err.name === 'SyntaxError' || err.message.includes('Expected');

    res.status(200).json({
        success: false,
        errors: [{
            type: isSyntactic ? 'syntactic' : 'semantic',
            message: err.message,
            line: err.location?.start?.line || 0
        }],
        safetyChecks: [],
        cfg: { nodes: [], edges: [] },
        explanations: ["The engine encountered an unexpected structure and stopped."]
    });
});

app.listen(PORT, () => {
    console.log(`✅ CodeSense Backend is running on http://localhost:${PORT}`);
});