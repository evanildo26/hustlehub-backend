/**
 * Rate limiting for authentication endpoints.
 *
 * Registration and login are the most attractive targets for brute-force
 * and credential-stuffing attacks, so they are limited per-IP. This is
 * additional hardening put in place ahead of Part 2 (where rate limiting
 * becomes a graded requirement for auth + booking endpoints) - the limits
 * below are deliberately generous so they do not get in the way of manual
 * Postman testing/marking.
 */
const rateLimit = require('express-rate-limit'); // Third-party middleware that tracks and caps requests per client.

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes, expressed in milliseconds - the rolling time window each client is measured over.
  max: 30, // 30 attempts per IP per window
  standardHeaders: true, // Return rate-limit info in the standard `RateLimit-*` response headers.
  legacyHeaders: false, // Don't also send the older, non-standard `X-RateLimit-*` headers (avoids duplication).
  message: {
    success: false, // Keep the same response shape as every other error in this API.
    message: 'Too many attempts from this device. Please try again in a few minutes.', // Sent once the limit is exceeded (HTTP 429).
  },
});

module.exports = { authLimiter }; // Exported for use on the register/login routes in authRoutes.js.
