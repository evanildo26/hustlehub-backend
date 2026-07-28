/**
 * Centralised environment configuration.
 *
 * Reading process.env directly all over the codebase makes it easy to
 * misspell a variable name and get `undefined` at runtime with no warning.
 * Instead we read everything once here, apply sane defaults where it is
 * safe to do so, and fail fast (loudly, at startup) when something the
 * application cannot safely run without is missing - e.g. the JWT secret.
 */
const path = require('path'); // Built-in module for building OS-independent file paths.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); // Loads variables from the .env file at the project root into process.env.

const required = ['JWT_SECRET']; // List of environment variables the app cannot safely run without.
const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === ''); // Find any required var that is unset or blank.

if (missing.length > 0) {
  // Fail fast and clearly - a missing secret must never silently fall back
  // to an insecure default in a security-focused application.
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Copy .env.example to .env and set them before starting the server.'
  );
  process.exit(1); // Stop the process immediately rather than run with an undefined/insecure JWT secret.
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development', // Which environment we're running in; defaults to 'development' if unset.
  port: parseInt(process.env.PORT, 10) || 5000, // Convert the PORT string to a number; fall back to 5000 if missing/invalid.
  jwtSecret: process.env.JWT_SECRET, // The secret key used to sign and verify JWTs - required, so no fallback here.
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h', // How long an issued token stays valid; defaults to 1 hour.
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000', // Which frontend origin is allowed to call this API from a browser.
  isProduction: (process.env.NODE_ENV || 'development') === 'production', // Convenience boolean flag used elsewhere (e.g. logging format).
};
