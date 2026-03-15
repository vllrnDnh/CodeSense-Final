import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import analyzeRoutes from './routes/analyze';

const app = express();

app.use(cors());
// Vercel provides process.env.PORT; 3000 is our local fallback
const PORT = process.env.PORT || 3000;

/**
 * 1. DYNAMIC CORS CONFIGURATION
 * Updated to allow local development, production, and VS Code Dev Tunnels.
 */
const allowedOrigins = [
    'http://localhost:5173', 
    'https://code-sense-final-lsif.vercel.app', // Production URL
    'https://l00qvddz-5173.asse.devtunnels.ms'  // Your current Dev Tunnel
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow if:
        // - No origin (Postman/Curl)
        // - In our allowedOrigins list
        // - It's a Vercel preview branch (.vercel.app)
        // - It's a VS Code Dev Tunnel (.devtunnels.ms)
        if (
            !origin || 
            allowedOrigins.includes(origin) || 
            origin.endsWith('.vercel.app') || 
            origin.endsWith('.devtunnels.ms') 
        ) {
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
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(`🔥 Backend Error Caught: ${err.message}`);

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
 * Only run app.listen locally to avoid conflict with Vercel's serverless wrapper.
 */
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`✅ CodeSense Backend is running locally on http://localhost:${PORT}`);
    });
}
export default app;