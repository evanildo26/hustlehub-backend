/**
 * HTTPS server bootstrap.
 *
 * The POE requires the API to be served over HTTPS using a locally
 * configured SSL certificate (not plain HTTP). This file loads the
 * self-signed certificate/key produced by `npm run generate-cert`,
 * starts an https.Server wrapping the Express app, and fails with a
 * clear, actionable message (not a raw stack trace) if the certificate
 * has not been generated yet.
 */
const fs = require('fs'); // Node's built-in file system module - used to check for and read the cert/key files.
const https = require('https'); // Node's built-in HTTPS module - creates a TLS-encrypted server (instead of the plain `http` module).
const path = require('path'); // Used to build OS-independent absolute file paths (works on Windows and Linux alike).

const app = require('./src/app'); // The configured Express application (routes + middleware) - see src/app.js.
const { port } = require('./src/config/env'); // Destructure just the `port` value out of the centralised env config.
const logger = require('./src/utils/logger'); // Structured logger (console + file) used instead of raw console.log for system events.

const CERT_DIR = path.join(__dirname, 'certs'); // Absolute path to the certs/ folder, regardless of where the process is started from.
const KEY_PATH = path.join(CERT_DIR, 'key.pem'); // Path to the TLS private key file.
const CERT_PATH = path.join(CERT_DIR, 'cert.pem'); // Path to the TLS certificate file.

if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) {
  // If either file is missing, the server cannot start securely - fail fast with clear instructions
  // instead of throwing a confusing low-level error from the https module.
  console.error(
    '\nTLS certificate not found.\n' +
      'Generate a local development certificate first, then start the server again:\n\n' +
      '  npm run generate-cert\n' +
      '  npm start\n'
  );
  process.exit(1); // Non-zero exit code signals failure to the shell / process manager.
}

const httpsOptions = {
  key: fs.readFileSync(KEY_PATH), // Read the private key synchronously - fine here because this only runs once at startup.
  cert: fs.readFileSync(CERT_PATH), // Read the certificate synchronously for the same reason.
};

https.createServer(httpsOptions, app).listen(port, () => {
  // https.createServer wraps the Express `app` (a request handler function) in a TLS-terminating server.
  // .listen(port, callback) starts accepting connections; the callback runs once the socket is bound.
  logger.info('SERVER_STARTED', { port, protocol: 'https' }); // Structured log entry recording the startup event.
  console.log(`HustleHub+ API listening securely on https://localhost:${port}`); // Human-friendly console confirmation for local dev.
});

// Catch programming errors that would otherwise crash the process silently
// or dump a stack trace to a client - log them and exit so a process
// manager (or the developer) can restart cleanly.
process.on('unhandledRejection', (err) => {
  // Fires when a Promise rejects and nothing .catch()'d it - e.g. a forgotten `await` or missing error handler.
  logger.error('UNHANDLED_REJECTION', { message: err.message, stack: err.stack }); // Log full detail server-side only.
  process.exit(1); // Exit rather than continue running in a possibly-corrupted state.
});

process.on('uncaughtException', (err) => {
  // Fires for synchronous errors thrown outside of any try/catch - the last line of defence.
  logger.error('UNCAUGHT_EXCEPTION', { message: err.message, stack: err.stack });
  process.exit(1);
});
