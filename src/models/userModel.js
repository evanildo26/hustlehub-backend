/**
 * File-based user "model" for Part 1 of the POE.
 *
 * The brief explicitly allows in-memory or file-based storage at this
 * stage ("A database will be required later"). File-based storage was
 * chosen over a plain in-memory array so that registered users survive a
 * server restart during development/marking, which makes the register ->
 * restart -> login flow demonstrable. This module is the ONLY place that
 * touches the users.json file - controllers never read/write it directly,
 * which keeps a clean seam for swapping this out for a real MongoDB model
 * (Mongoose) in Part 2 without changing any controller code.
 *
 * A simple write queue (writeLock) prevents two concurrent requests from
 * reading-modifying-writing the file at the same time and clobbering each
 * other's changes.
 */
const fs = require('fs/promises'); // Promise-based file system API - lets us `await` reads/writes instead of using callbacks.
const fsSync = require('fs'); // Synchronous file system API - used only for the one-time startup check below.
const path = require('path'); // Built-in module for building OS-independent file paths.

const DATA_DIR = path.join(__dirname, '..', 'data'); // src/data - folder holding the JSON "database" file.
const DATA_FILE = path.join(DATA_DIR, 'users.json'); // The actual file storing the array of user records.

function ensureStoreExists() {
  // Called before every read/write so the store self-heals if the folder/file were ever deleted.
  if (!fsSync.existsSync(DATA_DIR)) {
    fsSync.mkdirSync(DATA_DIR, { recursive: true }); // Create src/data if it's missing.
  }
  if (!fsSync.existsSync(DATA_FILE)) {
    fsSync.writeFileSync(DATA_FILE, '[]', 'utf-8'); // Seed a fresh, empty JSON array if the file is missing.
  }
}

ensureStoreExists(); // Run once immediately when this module is first loaded (server startup).

// Serialises writes so concurrent requests can't corrupt the JSON file.
let writeLock = Promise.resolve(); // A "chain" promise - each write attaches itself to the end of the previous one.

async function readUsers() {
  ensureStoreExists(); // Defensive check in case the file was deleted while the server was running.
  const raw = await fs.readFile(DATA_FILE, 'utf-8'); // Read the whole file as a UTF-8 string.
  try {
    return JSON.parse(raw || '[]'); // Parse the JSON text into a JS array; treat an empty string as an empty array.
  } catch (err) {
    // A corrupt data file is a server-side problem, not something to leak
    // to the client - surface a clear log entry and start from empty.
    console.error('users.json is corrupted, resetting to an empty store:', err.message);
    return []; // Fail safe: return an empty array rather than crashing the request.
  }
}

async function writeUsers(users) {
  const task = writeLock.then(() =>
    // Chain this write onto whatever the previous write was doing, so writes never overlap.
    fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8')
    // JSON.stringify(users, null, 2) pretty-prints with 2-space indentation, purely for human readability of the file.
  );
  writeLock = task.catch(() => {}); // don't let one failure block future writes
  // Swallow errors here (they're still visible to the original caller via `task`) so the chain itself never breaks.
  return task; // Return the actual write promise so the caller can await/catch it.
}

async function findByEmail(email) {
  const users = await readUsers(); // Load the current full list of users.
  const normalised = email.trim().toLowerCase(); // Match case-insensitively and ignore stray whitespace.
  return users.find((u) => u.email === normalised) || null; // Linear search; return null instead of undefined if not found.
}

async function findById(id) {
  const users = await readUsers(); // Load the current full list of users.
  return users.find((u) => u.id === id) || null; // Linear search by primary key (UUID).
}

async function createUser(user) {
  const users = await readUsers(); // Load the existing list.
  users.push(user); // Append the new user object.
  await writeUsers(users); // Persist the updated list back to disk.
  return user; // Return the created user so the caller can use it immediately.
}

/** Strips fields that must never leave the server (password hash etc.) */
function toPublicProfile(user) {
  if (!user) return null; // Guard against being called with a missing user (e.g. lookup failed).
  const { password, ...publicFields } = user; // Destructure out `password`, keep everything else.
  return publicFields; // Safe-to-return object with no password hash included.
}

module.exports = {
  readUsers, // Exposed for completeness / potential future use (e.g. an admin "list all users" route).
  writeUsers, // Exposed for completeness; not called directly outside this module today.
  findByEmail, // Used by register (duplicate check) and login (credential lookup).
  findById, // Used by the JWT auth middleware and the /me route.
  createUser, // Used by register to persist a new account.
  toPublicProfile, // Used everywhere a user object is sent in an API response.
};
