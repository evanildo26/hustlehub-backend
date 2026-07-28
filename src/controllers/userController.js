/**
 * Demonstrates a JWT-protected route: GET /api/users/me.
 * By the time this handler runs, `protect` middleware has already
 * verified the token and attached `req.user`. Part 2 expands this with
 * further user/gig/booking-owning routes protected the same way.
 */
const userModel = require('../models/userModel'); // Data access layer for looking up the full user record.
const AppError = require('../utils/AppError'); // Operational-error class for a controlled 404 response.

async function getMe(req, res, next) {
  // req.user was set by the `protect` middleware after verifying the caller's JWT.
  try {
    const user = await userModel.findById(req.user.id); // Look up the full, current record (req.user only has id/role/email).
    if (!user) {
      // Edge case: the token is valid but the account was deleted after it was issued.
      throw new AppError('User not found.', 404);
    }
    return res.status(200).json({
      success: true,
      data: userModel.toPublicProfile(user), // Strip the password hash before returning the profile.
    });
  } catch (err) {
    return next(err); // Forward to the central error handler.
  }
}

module.exports = { getMe }; // Wired up to GET /api/users/me (behind `protect`) in userRoutes.js.
