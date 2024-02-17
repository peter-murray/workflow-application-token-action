export class PrivateKey {
  constructor(data) {
    if (isRsaPrivateKey(data)) {
      this._key = data;
    }

    // Try to decode as Base64 key
    const decoded = decodeData(data);
    if (decoded) {
      this._key = decoded;
    }

    if (!this._key) {
      throw new Error(`Unsupported private key data format, need raw key in PEM format or Base64 encoded string.`);
    }
  }

  get key() {
    return this._key;
  }
}

function decodeData(data) {
  const decoded = Buffer.from(data, 'base64').toString('ascii');

  if (isRsaPrivateKey(decoded)) {
    return decoded;
  }
}

function isRsaPrivateKey(data) {
  const possibleKey = `${data}`.trim();

  return (
    possibleKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') && possibleKey.endsWith('-----END RSA PRIVATE KEY-----')
  );
}
