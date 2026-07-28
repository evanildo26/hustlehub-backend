/**
 * Server-side input validation using express-validator.
 *
 * Frontend validation (added in Part 2) is a UX nicety - it can always be
 * bypassed by calling the API directly (curl, Postman, a modified client),
 * so every field is re-validated here regardless of what the client sent.
 * Anything that fails validation is rejected before it reaches a
 * controller or touches the data store.
 */
const { body, validationResult } = require('express-validator'); // `body` declares validation rules per field; `validationResult` collects the outcome.
const AppError = require('../utils/AppError'); // Our operational-error class, used to turn validation failures into a controlled response.

const ALLOWED_SELF_REGISTER_ROLES = ['client', 'freelancer']; // The only roles a user is allowed to pick for themselves at signup.
// 'admin' is intentionally excluded - administrators are provisioned
// out-of-band, never through the public registration endpoint. Allowing
// self-service admin signup would be a privilege-escalation vulnerability.

const registerValidationRules = [
  // An array of express-validator chains - Express runs each one against the incoming request in order.
  body('name')
    .trim() // Remove leading/trailing whitespace before validating/using the value.
    .notEmpty() // Reject if the field is missing or empty after trimming.
    .withMessage('Name is required') // Message returned to the client if the above check fails.
    .isLength({ min: 2, max: 100 }) // Enforce a sane length range.
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/) // Only letters, spaces, hyphens, apostrophes - blocks digits/symbols/script tags in the name.
    .withMessage('Name may only contain letters, spaces, hyphens and apostrophes'),

  body('email')
    .trim() // Strip surrounding whitespace.
    .notEmpty() // Must be present.
    .withMessage('Email is required')
    .isEmail() // Must be a syntactically valid email address.
    .withMessage('A valid email address is required')
    .normalizeEmail(), // Normalises formatting (e.g. lower-cases the domain) so the same address always matches consistently.

  body('password')
    .notEmpty() // Must be present - not trimmed, since leading/trailing spaces could be an intentional part of a password.
    .withMessage('Password is required')
    .isLength({ min: 8, max: 128 }) // Minimum length resists brute-force/guessing; max length avoids abuse via huge inputs.
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/) // Require at least one lowercase letter.
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/) // Require at least one uppercase letter.
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/) // Require at least one digit.
    .withMessage('Password must contain at least one number')
    .matches(/[^a-zA-Z0-9]/) // Require at least one character that isn't a letter or digit (a symbol).
    .withMessage('Password must contain at least one special character'),

  body('role')
    .optional() // Not required - authController defaults to 'client' if omitted.
    .trim()
    .toLowerCase() // Normalise case before checking against the allow-list.
    .isIn(ALLOWED_SELF_REGISTER_ROLES) // Reject anything other than 'client' or 'freelancer' - this is what blocks self-assigned 'admin'.
    .withMessage(`Role must be one of: ${ALLOWED_SELF_REGISTER_ROLES.join(', ')}`),
];

const loginValidationRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('A valid email address is required')
    .normalizeEmail(),

  body('password').notEmpty().withMessage('Password is required'),
  // Note: login intentionally does NOT re-check the password policy (length/complexity) - a user's existing
  // password should always be accepted for login even if password rules change later; only its correctness matters here.
];

/**
 * Collects express-validator results and, if any rule failed, turns them
 * into a single controlled 400 response instead of letting the request
 * continue into the controller. Field names + messages are safe to expose
 * (they describe the client's own input); nothing about the server is
 * revealed.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req); // Gather the results of every validation rule that ran on this request.
  if (!errors.isEmpty()) {
    // At least one rule failed.
    const details = errors.array().map((e) => ({ field: e.path, message: e.msg })); // Reshape into a simple, client-friendly array.
    const error = new AppError('Validation failed', 400); // 400 Bad Request - the client sent invalid data.
    error.details = details; // Attach the field-level messages so errorHandler.js can include them in the response.
    return next(error); // Hand off to the central error handler instead of continuing to the controller.
  }
  return next(); // No errors - proceed to the next middleware/controller in the chain.
}

module.exports = { registerValidationRules, loginValidationRules, handleValidationErrors };
