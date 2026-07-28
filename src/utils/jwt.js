/**
 * Thin wrapper around jsonwebtoken so the rest of the codebase never
 * touches process.env or the jsonwebtoken API directly.
 */
const jwt = require('jsonwebtoken'); // Third-party library implementing the JWT standard (signing + verifying tokens).
const { jwtSecret, jwtExpiresIn } = require('../config/env'); // The signing secret and default expiry, read once from env.js.

/**
 * Signs a JWT for an authenticated user.
 * Payload intentionally only contains non-sensitive identifiers -
 * never the password hash or other sensitive fields.
 */
function signToken({ id, role, email }) {
  // Destructure only the three fields we want to embed in the token - nothing else from the user object leaks in.
  return jwt.sign({ id, role, email }, jwtSecret, { expiresIn: jwtExpiresIn });
  // jwt.sign(payload, secret, options) builds and cryptographically signs the token string (header.payload.signature).
}

/**
 * Verifies a token's signature and expiry.
 * Throws (jsonwebtoken's own error types) if invalid/expired - callers
 * are expected to catch this and translate it into a generic 401.
 */
function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
  // jwt.verify checks the signature matches (proving it was issued by this server) and that it hasn't expired,
  // then returns the decoded payload - or throws if either check fails.
}

module.exports = { signToken, verifyToken }; // Export both functions for use by the auth controller and auth middleware.
