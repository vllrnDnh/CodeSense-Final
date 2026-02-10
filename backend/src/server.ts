import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import analyzeRoutes from './routes/analyze';

const app = express();
// Vercel provides process.env.PORT; 3000 is our local fallback
const PORT = process.env.PORT || 3000;

/**
 * 1. DYNAMIC CORS CONFIGURATION
 * This prevents unauthorized domains from accessing your analysis engine.
 */
const allowedOrigins = [
    'http://localhost:5173', // Local Vite development
    'https://code-sense-final-lsif.vercel.app' // Your live frontend URL
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like Postman/curl) or from our whitelist
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.error(`CORS Blocked: Origin ${origin} is not allowed.`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Enable parsing of JSON bodies
app.use(bodyParser.json());

/**
 * 2. REQUEST LOGGING
 * Useful for debugging Vercel logs to see incoming analysis payloads.
 */
app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path === '/api/analyze') {
        const snippet = req.body.sourceCode?.substring(0, 40).replace(/\n/g, ' ');
        console.log(`\n--- [DEBUG] New Analysis Request ---`);
        console.log(`Source Snippet: ${snippet}${req.body.sourceCode?.length > 40 ? '...' : ''}`);
    }
    next();
});

/**
 * 3. ROUTE REGISTRATION
 */
app.use('/api', analyzeRoutes);

// Simple Health Check for Vercel
app.get('/', (req, res) => {
    res.status(200).send('CodeSense Analysis Engine is Online.');
});

/**
 * 4. GLOBAL ERROR HANDLER
 * Catches parser crashes or logic errors and returns a clean JSON response.
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

/**
 * 5. SERVER EXECUTION LOGIC
 * Vercel uses the 'export default app' to wrap your server in a serverless function.
 * We only run app.listen locally to avoid conflict in production.
 */
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`✅ CodeSense Backend is running locally on http://localhost:${PORT}`);
    });
}

export default app;