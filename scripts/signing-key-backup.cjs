// No dependencies, network requests, or plaintext backup files in the CI encrypt path.
const fs = require('node:fs');
const path = require('node:path');
const c = require('node:crypto');
const fields = ['SELF_SIGNED_CERT_FOR_MAC', 'SELF_SIGNED_CERT_FOR_MAC_PASSWD', 'SELF_SIGNED_CERT'];
const format = 'kawaikara-signing-backup-v1';
const oaep = { padding: c.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };

function fingerprint(publicKey) {
  return c.createHash('sha256').update(c.createPublicKey(publicKey).export({ type: 'spki', format: 'der' })).digest('hex');
}
function encrypt(publicKey, payload, expectedFingerprint) {
  const key = c.createPublicKey(publicKey);
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 4096) throw new Error('RSA 4096 or stronger required');
  const recipient = fingerprint(publicKey);
  if (recipient !== expectedFingerprint) throw new Error('Recipient fingerprint mismatch');
  const secret = c.randomBytes(32), iv = c.randomBytes(12);
  try {
    const cipher = c.createCipheriv('aes-256-gcm', secret, iv);
    cipher.setAAD(Buffer.from(`${format}:${recipient}`));
    const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return { format, recipient, wrappedKey: c.publicEncrypt({ key, ...oaep }, secret).toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  } finally { secret.fill(0); }
}
function decrypt(privateKey, envelope) {
  if (envelope.format !== format) throw new Error('Unknown backup format');
  const key = c.createPrivateKey(privateKey);
  const publicKey = c.createPublicKey(key).export({ type: 'spki', format: 'pem' });
  if (fingerprint(publicKey) !== envelope.recipient) throw new Error('Wrong recovery key');
  const secret = c.privateDecrypt({ key, ...oaep }, Buffer.from(envelope.wrappedKey, 'base64'));
  try {
    const decipher = c.createDecipheriv('aes-256-gcm', secret, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(Buffer.from(`${format}:${envelope.recipient}`));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
  } finally { secret.fill(0); }
}
function initialize(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const privatePath = path.join(directory, 'RecoverPrivateKey.pem');
  const publicPath = path.join(directory, 'RecoverPubKey.pem');
  if ([privatePath, publicPath, path.join(directory, 'RecoverPubKey.sha256')].some(file => fs.existsSync(file))) throw new Error('Recovery files already exist; refusing replacement');
  const pair = c.generateKeyPairSync('rsa', { modulusLength: 4096, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  fs.writeFileSync(privatePath, pair.privateKey, { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(publicPath, pair.publicKey, { mode: 0o644, flag: 'wx' });
  fs.writeFileSync(path.join(directory, 'RecoverPubKey.sha256'), fingerprint(pair.publicKey) + '\n', { flag: 'wx' });
  console.log('Recovery key pair created. Keep RecoverPrivateKey.pem offline and private.');
}
function main(args = process.argv.slice(2)) {
  if (args[0] === 'init' && args.length === 2) return initialize(path.resolve(args[1]));
  if (args[0] === 'encrypt' && args.length === 2) {
    const secrets = Object.fromEntries(fields.map(field => [field, process.env[field]]));
    // Password can be empty; both certificate secrets must be present.
    if (!secrets.SELF_SIGNED_CERT_FOR_MAC || !secrets.SELF_SIGNED_CERT) throw new Error('Missing signing certificate secrets');
    secrets.SELF_SIGNED_CERT_FOR_MAC_PASSWD ||= '';
    const envelope = encrypt(process.env.SIGNING_RECOVERY_PUBLIC_KEY, { version: 1, repository: process.env.GITHUB_REPOSITORY, createdAt: new Date().toISOString(), secrets }, process.env.RECOVERY_FINGERPRINT);
    fs.mkdirSync(path.dirname(path.resolve(args[1])), { recursive: true, mode: 0o700 });
    fs.writeFileSync(args[1], JSON.stringify(envelope) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Encrypted backup created. No plaintext backup was written.');
    return;
  }
  if (args[0] === 'decrypt' && args.length === 4) {
    const payload = decrypt(fs.readFileSync(args[1]), JSON.parse(fs.readFileSync(args[2], 'utf8')));
    if (payload.version !== 1 || !fields.every(field => typeof payload.secrets?.[field] === 'string')) throw new Error('Invalid backup payload');
    const directory = path.resolve(args[3]);
    fs.mkdirSync(directory, { mode: 0o700 }); // Refuse existing directory, including symlinks.
    fs.writeFileSync(path.join(directory, 'restored-secrets.json'), JSON.stringify(payload, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    for (const [field, filename] of [['SELF_SIGNED_CERT_FOR_MAC', 'kawaikara-mac.p12'], ['SELF_SIGNED_CERT', 'kawaikara-windows.pfx']]) {
      const encoded = payload.secrets[field].replace(/\s/g, '');
      // Preserve original values in JSON even if a secret was configured as a URL instead of base64.
      if (/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fs.writeFileSync(path.join(directory, filename), Buffer.from(encoded, 'base64'), { flag: 'wx', mode: 0o600 });
    }
    fs.writeFileSync(path.join(directory, 'mac-certificate-password.txt'), payload.secrets.SELF_SIGNED_CERT_FOR_MAC_PASSWD, { flag: 'wx', mode: 0o600 });
    console.log('Restored into the requested private directory. Contents were not printed.');
    return;
  }
  throw new Error('Usage: init DIRECTORY | encrypt OUTPUT | decrypt PRIVATE_KEY ENCRYPTED_BACKUP NEW_OUTPUT_DIRECTORY');
}
module.exports = { fingerprint, encrypt, decrypt, initialize, main };
if (require.main === module) {
  try { main(); } catch { console.error('Backup operation failed. Check arguments, key/fingerprint, required secrets, and output paths. Sensitive error details suppressed.'); process.exitCode = 1; }
}
