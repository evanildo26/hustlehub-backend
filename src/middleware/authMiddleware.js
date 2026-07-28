/**
 * JWT authentication + authorisation middleware.
 *
 * `protect` runs on every route that requires a logged-in user. It:
 *   1. Reads the token from the `Authorization: Bearer <token>` header.
 *   2. Verifies its signature and expiry against JWT_SECRET.
 *   3. Confirms the user referenced by the token still exists.
 *   4. Attaches a minimal `req.user` object for downstream handlers.
 *
 * This means the token is validated on EVERY protected request (not just
 * checked for presence) - a forged, tampered, or expired token is
 * rejected even if it "looks" well-formed.
 *
 * `restrictTo` builds on top of `protect` to provide role-based access
 * control. It is not exercised by any route yet in Part 1 (there is only
 * one protected route and no role-specific resources), but is included
 * now because Part 2 introduces gigs/bookings that must be restricted by
 * role (client/freelancer/admin).
 */
const { verifyToken } = require('../utils/jwt'); // Our wrapper around jsonwebtoken's verify() function.
const AppError = require('../utils/AppError'); // Operational-error class for controlled 401/403 responses.
const logger = require('../utils/logger'); // Structured logger, used to record suspicious/invalid token attempts.
const userModel = require('../models/userModel'); // Used to confirm the user referenced by the token still exists.

async function protect(req, res, next) {
  // Express middleware signature: (request, response, next-function).
  try {
    const authHeader = req.headers.authorization || ''; // Read the Authorization header, defaulting to '' if absent.
    const [scheme, token] = authHeader.split(' '); // Expected format: "Bearer <token>" - split into its two parts.

    if (scheme !== 'Bearer' || !token) {
      // Reject if the header is missing, malformed, or uses a different scheme.
      throw new AppError('You are not logged in. Please log in to access this resource.', 401);
    }

    let decoded;
    try {
      decoded = verifyToken(token); // Verify signature + expiry; throws if either check fails.
    } catch (err) {
      // Covers expired tokens, tampered signatures, and malformed tokens -
      // all treated the same way from the client's perspective.
      logger.security('INVALID_TOKEN_ATTEMPT', {
        path: req.originalUrl, // Which endpoint was being accessed.
        reason: err.name, // e.g. 'TokenExpiredError', 'JsonWebTokenError' - useful server-side, not sent to the client.
      });
      throw new AppError('Invalid or expired session. Please log in again.', 401); // Generic message - doesn't reveal *why* it failed.
    }

    const user = await userModel.findById(decoded.id); // Re-check the user still exists (e.g. wasn't deleted after the token was issued).
    if (!user) {
      throw new AppError('The user belonging to this token no longer exists.', 401);
    }

    // Minimal, non-sensitive user context for the rest of the request.
    req.user = { id: user.id, role: user.role, email: user.email }; // Attach only what downstream handlers need - never the password hash.
    next(); // Validation passed - continue to the next middleware/controller.
  } catch (err) {
    next(err); // Forward any thrown error to the central error handler instead of letting it crash the request.
  }
}

function restrictTo(...allowedRoles) {
  // Higher-order function: called with a list of roles, returns an actual middleware function.
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      // `protect` must run first to populate req.user; if the role isn't in the allowed list, deny access.
      return next(new AppError('You do not have permission to perform this action.', 403)); // 403 Forbidden - authenticated, but not authorised.
    }
    next(); // Role is allowed - continue.
  };
}

module.exports = { protect, restrictTo }; // Export both so routes can compose them, e.g. router.post('/gigs', protect, restrictTo('freelancer'), ...).
