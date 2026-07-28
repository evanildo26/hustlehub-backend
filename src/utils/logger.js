/**
 * Minimal, dependency-free event logger.
 *
 * The POE requires that key system events (login attempts, registrations,
 * errors, etc.) are logged. For Part 1 this writes structured, single-line
 * JSON entries to both the console and a rolling log file
 * (src/logs/events.log), which is enough to demonstrate the practice and
 * to inspect what happened during a demo/marking session. Part 3 extends
 * this with dedicated logging for bookings/transactions and, optionally, a
 * cloud-based logging platform.
 *
 * Log entries deliberately never include passwords, tokens, or other
 * secrets - only enough context to investigate an incident.
 */
const fs = require('fs'); // Built-in module for reading/writing files - used here to append to the log file.
const path = require('path'); // Built-in module for building OS-independent file paths.

const LOG_DIR = path.join(__dirname, '..', 'logs'); // src/logs - where the event log file lives.
const LOG_FILE = path.join(LOG_DIR, 'events.log'); // The actual log file path.

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true }); // Create the logs folder on first run if it doesn't exist yet.
}

function write(level, event, meta = {}) {
  // Internal helper that all the exported log functions (info/warn/error/security) funnel through.
  const entry = {
    timestamp: new Date().toISOString(), // ISO 8601 timestamp so entries can be sorted/filtered reliably.
    level, // Severity/category of the event: 'info' | 'warn' | 'error' | 'security'.
    event, // A short, machine-readable event name, e.g. 'LOGIN_SUCCESS'.
    ...meta, // Any extra structured context passed in (userId, path, reason, etc.) - spread directly into the entry.
  };

  const line = JSON.stringify(entry); // Serialise to a single-line JSON string (easy to grep/parse later).

  // Console output for local development / live demo visibility
  const consoleFn = level === 'error' ? console.error : console.log; // Route errors to stderr, everything else to stdout.
  consoleFn(`[${entry.timestamp}] [${level.toUpperCase()}] ${event}`, meta); // Human-readable console line.

  // Persisted, append-only file so events survive process restarts
  fs.appendFile(LOG_FILE, line + '\n', (err) => {
    // Asynchronous, non-blocking append - doesn't slow down the request that triggered the log.
    if (err) {
      // Never let a logging failure crash the request - just surface it.
      console.error('Failed to write to log file:', err.message);
    }
  });
}

module.exports = {
  info: (event, meta) => write('info', event, meta), // General informational events (e.g. server started).
  warn: (event, meta) => write('warn', event, meta), // Something worth noticing but not necessarily an error.
  error: (event, meta) => write('error', event, meta), // Something went wrong (exceptions, failed requests).
  security: (event, meta) => write('security', event, meta), // Security-relevant events (login attempts, invalid tokens).
};
