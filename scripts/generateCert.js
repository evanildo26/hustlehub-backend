/**
 * Generates a self-signed TLS certificate + private key for local HTTPS
 * development, so the API can be "served over HTTPS using a locally
 * configured SSL certificate" as required by the POE without depending on
 * the OpenSSL CLI being installed on every marker's/team member's machine.
 *
 * Run with: npm run generate-cert
 * Output:   certs/key.pem, certs/cert.pem  (git-ignored, machine-specific)
 *
 * NOTE: this certificate is self-signed and is only suitable for local
 * development/demonstration. Browsers and Postman will show an
 * "untrusted certificate" warning that must be accepted/disabled once for
 * localhost - a real deployment would use a certificate from a trusted CA
 * (e.g. Let's Encrypt) instead.
 */
const fs = require('fs'); // Built-in module for reading/writing files (used to save the generated cert + key).
const path = require('path'); // Built-in module for building OS-independent file paths.
const selfsigned = require('selfsigned'); // Third-party library that generates a self-signed X.509 certificate in pure JS (no OpenSSL needed).

const CERT_DIR = path.join(__dirname, '..', 'certs'); // certs/ folder at the project root (one level up from scripts/).
const KEY_PATH = path.join(CERT_DIR, 'key.pem'); // Where the private key will be written.
const CERT_PATH = path.join(CERT_DIR, 'cert.pem'); // Where the public certificate will be written.

if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
  // Avoid silently overwriting an existing certificate every time this script runs.
  console.log('Certificate already exists at certs/. Delete that folder first to regenerate.');
  process.exit(0); // Exit code 0 = "nothing went wrong", just nothing to do.
}

const attrs = [{ name: 'commonName', value: 'localhost' }]; // The certificate's subject - identifies it as being "for" localhost.
const pems = selfsigned.generate(attrs, {
  days: 365, // How long the certificate is valid for (1 year) before it needs regenerating.
  keySize: 2048, // RSA key length in bits - 2048 is the current minimum considered secure.
  extensions: [
    { name: 'basicConstraints', cA: true }, // Marks this certificate as allowed to act as its own Certificate Authority (since it's self-signed).
    {
      name: 'keyUsage', // Declares what the key is permitted to be used for.
      keyCertSign: true, // Allowed to sign certificates (needed because it signs itself).
      digitalSignature: true, // Allowed to be used for digital signatures (part of the TLS handshake).
      nonRepudiation: true, // Allowed to be used where the signer cannot later deny having signed.
      keyEncipherment: true, // Allowed to encrypt other keys (used during TLS key exchange).
      dataEncipherment: true, // Allowed to encrypt data directly.
    },
    { name: 'extKeyUsage', serverAuth: true }, // Marks the certificate as valid specifically for authenticating a TLS server.
    {
      name: 'subjectAltName', // Modern browsers require this (not just commonName) to trust a certificate for a given hostname.
      altNames: [{ type: 2, value: 'localhost' }], // type: 2 = DNS name; tells the client "this cert is valid for the host 'localhost'".
    },
  ],
});

fs.mkdirSync(CERT_DIR, { recursive: true }); // Create certs/ (and any missing parent folders) if it doesn't already exist.
fs.writeFileSync(KEY_PATH, pems.private); // Save the generated private key to disk.
fs.writeFileSync(CERT_PATH, pems.cert); // Save the generated public certificate to disk.

console.log('Self-signed certificate generated:'); // Confirm success to whoever ran the script.
console.log(`  ${KEY_PATH}`); // Show where the key ended up.
console.log(`  ${CERT_PATH}`); // Show where the certificate ended up.
console.log('\nThis certificate is for local development only - do not commit it or use it in production.'); // Reminder of the security boundary.
