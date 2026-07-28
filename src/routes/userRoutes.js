const express = require('express'); // Web framework - used here just for its Router.
const userController = require('../controllers/userController'); // Business logic for user-facing endpoints.
const { protect } = require('../middleware/authMiddleware'); // JWT verification middleware - blocks unauthenticated requests.

const router = express.Router(); // A mini, mountable Express app - just for user-related endpoints.

// GET /api/users/me - protected, demonstrates JWT validation on each request
router.get('/me', protect, userController.getMe);
// `protect` runs first: if the request has no valid JWT, it short-circuits with a 401 and getMe never runs.
// Only once the token is verified does control reach userController.getMe.

module.exports = router; // Mounted at /api/users in src/app.js, so this becomes /api/users/me.
