/**
 * Authentication controller: registration and login.
 *
 * Both handlers are deliberately "thin" - validation already happened in
 * middleware, so this file focuses purely on the business logic:
 * hashing/checking passwords, talking to the user store, issuing tokens,
 * and logging security-relevant events.
 */
const bcrypt = require('bcryptjs'); // Password hashing library - deliberately slow and salted, unlike fast general-purpose hashes.
const { v4: uuidv4 } = require('uuid'); // Generates random, unique IDs (v4 = random-based UUID) for new users.

const userModel = require('../models/userModel'); // Data access layer for reading/writing user records.
const { signToken } = require('../utils/jwt'); // Issues a signed JWT after a successful login.
const AppError = require('../utils/AppError'); // Operational-error class for controlled, safe error responses.
const logger = require('../utils/logger'); // Structured logger for recording registration/login events.

const SALT_ROUNDS = 12; // Higher = slower to brute force, but slower to hash.
// 12 is the OWASP-recommended baseline for bcrypt as of 2024/2025 - a good
// balance between attacker cost and acceptable login latency.

async function register(req, res, next) {
  // Express route handler: (request, response, next-function). Marked `async` so we can `await` inside.
  try {
    const { name, email, password, role } = req.body; // req.body was already validated by validators.js before this runs.
    const normalisedEmail = email.trim().toLowerCase(); // Normalise so "A@B.com" and "a@b.com" are treated as the same account.

    const existing = await userModel.findByEmail(normalisedEmail); // Check whether an account with this email already exists.
    if (existing) {
      // Generic-enough not to help an attacker enumerate accounts via
      // response timing/content beyond "this email is taken", which is an
      // accepted, low-risk trade-off for a usable registration flow.
      throw new AppError('An account with this email already exists.', 409); // 409 Conflict - the resource (email) already exists.
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); // Hash the plain-text password - this is what actually gets stored.

    const newUser = {
      id: uuidv4(), // A random unique identifier - never reuse database auto-increment IDs for anything security-sensitive.
      name: name.trim(), // Store the trimmed name (validators.js already enforced format/length).
      email: normalisedEmail, // Store the normalised email so lookups are consistent.
      password: hashedPassword, // hash only - the plain-text password is
      // never stored, logged, or held onto beyond this function's scope.
      role: role || 'client', // Default to 'client' if no role was supplied (role is optional in validators.js).
      createdAt: new Date().toISOString(), // Record when the account was created, in a standard, sortable format.
    };

    await userModel.createUser(newUser); // Persist the new user to the file-based store.

    logger.security('REGISTER_SUCCESS', { userId: newUser.id, role: newUser.role }); // Audit trail entry - no sensitive data included.

    return res.status(201).json({
      success: true, // Consistent response shape used across the whole API.
      message: 'Account created successfully. You can now log in.',
      data: userModel.toPublicProfile(newUser), // Strips the password hash before this ever reaches the client.
    });
  } catch (err) {
    return next(err); // Forward any error (AppError or unexpected) to the central error handler.
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body; // Already validated (both fields present, email well-formed) by validators.js.
    const normalisedEmail = email.trim().toLowerCase(); // Match the same normalisation used at registration time.

    const user = await userModel.findByEmail(normalisedEmail); // Look up the account by email.

    // Intentionally the SAME error message and status code whether the
    // email doesn't exist or the password is wrong. Distinguishing the two
    // would let an attacker enumerate which emails are registered.
    const invalidCredentialsError = new AppError('Invalid email or password.', 401); // Pre-built, reused for both failure cases below.

    if (!user) {
      logger.security('LOGIN_FAILED', { email: normalisedEmail, reason: 'no_such_user' }); // Logged server-side only - the client never sees "reason".
      throw invalidCredentialsError;
    }

    const passwordMatches = await bcrypt.compare(password, user.password); // Recomputes the hash of the submitted password and compares it to the stored hash.
    if (!passwordMatches) {
      logger.security('LOGIN_FAILED', { email: normalisedEmail, reason: 'bad_password' });
      throw invalidCredentialsError; // Same error/status as "no such user" - keeps the response indistinguishable to an attacker.
    }

    const token = signToken({ id: user.id, role: user.role, email: user.email }); // Issue a JWT proving this user is now authenticated.

    logger.security('LOGIN_SUCCESS', { userId: user.id, role: user.role }); // Audit trail entry for a successful login.

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token, // The client stores this and sends it back as `Authorization: Bearer <token>` on future requests.
      data: userModel.toPublicProfile(user), // User's own profile, password hash stripped.
    });
  } catch (err) {
    return next(err); // Forward to the central error handler.
  }
}

module.exports = { register, login }; // Wired up to POST /api/auth/register and POST /api/auth/login in authRoutes.js.
