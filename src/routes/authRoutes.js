const express = require('express'); // Web framework - used here just for its Router.
const authController = require('../controllers/authController'); // Business logic for register/login.
const { authLimiter } = require('../middleware/rateLimiter'); // Caps how many auth attempts an IP can make per window.
const {
  registerValidationRules, // Field-level validation rules specific to registration.
  loginValidationRules, // Field-level validation rules specific to login.
  handleValidationErrors, // Shared middleware that turns validation failures into a 400 response.
} = require('../middleware/validators');

const router = express.Router(); // A mini, mountable Express app - just for auth-related endpoints.

// POST /api/auth/register
router.post(
  '/register',
  authLimiter, // 1. Reject if this IP has made too many requests recently.
  registerValidationRules, // 2. Run every validation rule against req.body.
  handleValidationErrors, // 3. If any rule failed, stop here with a 400; otherwise continue.
  authController.register // 4. All checks passed - run the actual registration logic.
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter, // Same rate limiting applied to login (the classic brute-force target).
  loginValidationRules, // Basic presence/format checks (not the full password policy - see validators.js).
  handleValidationErrors,
  authController.login
);

module.exports = router; // Mounted at /api/auth in src/app.js, so these become /api/auth/register and /api/auth/login.
