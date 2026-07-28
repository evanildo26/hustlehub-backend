/**
 * Express application setup.
 *
 * Kept separate from server.js so the app itself (routes, middleware) can
 * be imported by test tooling without having to boot an actual HTTPS
 * server / bind a port - useful for Part 2's automated backend tests.
 */
const express = require('express'); // The web framework used to define routes and middleware.
const helmet = require('helmet'); // Middleware that sets a range of security-related HTTP response headers.
const cors = require('cors'); // Middleware that controls which browser origins are allowed to call this API.
const morgan = require('morgan'); // HTTP request logging middleware (logs method, path, status, response time, etc.).

const { corsOrigin, nodeEnv } = require('./config/env'); // Pull just the two config values this file needs.
const authRoutes = require('./routes/authRoutes'); // Router handling /api/auth/register and /api/auth/login.
const userRoutes = require('./routes/userRoutes'); // Router handling /api/users/* (currently just the protected /me route).
const { notFound, errorHandler } = require('./middleware/errorHandler'); // 404 + centralised error-handling middleware.
const logger = require('./utils/logger'); // Structured logger used to route morgan's output into our own log file too.

const app = express(); // Create the Express application instance.

// --- Security-related HTTP headers (helmet sets a solid default set:
// X-Content-Type-Options, X-Frame-Options, etc.). A dedicated Content
// Security Policy is configured in Part 2 once the frontend origin/assets
// are known.
app.use(helmet()); // Apply helmet's default header set to every response.

// --- CORS: only the configured frontend origin may call this API from a
// browser; credentials are not required for the JWT bearer-token flow.
app.use(cors({ origin: corsOrigin })); // Restrict cross-origin requests to the single allowed frontend origin.

// --- Body parsing with a size limit, to reduce the impact of oversized
// payload abuse.
app.use(express.json({ limit: '10kb' })); // Parse JSON request bodies into req.body; reject bodies bigger than 10kb.
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // Parse traditional form-encoded bodies too, with the same size cap.

// --- HTTP request logging: concise console output in development,
// routed through the app logger so every request is also captured in
// src/logs/events.log.
app.use(
  morgan(nodeEnv === 'production' ? 'combined' : 'dev', {
    // 'combined' format is more detailed (used in production); 'dev' is short and colourised (used locally).
    stream: { write: (message) => logger.info('HTTP_REQUEST', { message: message.trim() }) },
    // Redirect morgan's normal stdout output into our own logger so every request also lands in the log file.
  })
);

// --- Public health check (useful for CI/CD + container orchestration
// checks in later parts of the POE).
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'HustleHub+ API is running.' }); // Simple liveness check, no auth required.
});

// --- Feature routes
app.use('/api/auth', authRoutes); // Mount authentication routes under /api/auth.
app.use('/api/users', userRoutes); // Mount user routes under /api/users.

// --- 404 + centralised error handling (must be registered last)
app.use(notFound); // Catches any request that didn't match a route above and turns it into a controlled 404.
app.use(errorHandler); // Catches every error passed to next(err) anywhere in the app and builds a safe response.

module.exports = app; // Export the configured app so server.js (and future test files) can use it.
