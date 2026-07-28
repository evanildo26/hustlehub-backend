/**
 * AppError represents a known, "operational" error - e.g. bad input, a
 * duplicate email, an invalid login. These are errors we anticipated and
 * whose message is safe to send straight back to the client.
 *
 * Anything that is NOT an AppError (a bug, a thrown TypeError, a database
 * hiccup, etc.) is treated as unexpected by the central error handler and
 * is never shown to the client in detail - only logged server-side.
 */
class AppError extends Error {
  // Extends the built-in Error class so it still behaves like a normal JS error (has a stack trace, works with try/catch).
  constructor(message, statusCode) {
    super(message); // Call the parent Error constructor to set this.message.
    this.statusCode = statusCode; // The HTTP status code this error should produce (e.g. 400, 401, 404, 409).
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'; // Convention: 4xx = client's fault ('fail'), 5xx = server's fault ('error').
    this.isOperational = true; // Flag the central error handler checks to decide whether the message is safe to expose.

    Error.captureStackTrace(this, this.constructor); // Excludes the constructor itself from the stack trace, keeping it cleaner for debugging.
  }
}

module.exports = AppError; // Export the class so controllers/middleware can `throw new AppError(...)`.
