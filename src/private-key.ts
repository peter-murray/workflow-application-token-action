
export class PrivateKey {

  private _key: string;

  constructor(data: string) {
    let key: string | undefined;

    if (isRsaPrivateKey(data)) {
      key = data ;
    } else {
      // Try to decode as Base64 key
      const decoded = decodeData(data);
      if (decoded) {
        key = decoded;
      }
    }

    if (!key) {
      throw new Error(`Unsupported private key data format, need raw key in PEM format or Base64 encoded string.`);
    }
    this._key = key;
  }

  get key(): string {
    return this._key;
  }
}

function decodeData(data: string): string | undefined {
  const decoded = Buffer.from(data, 'base64').toString('ascii');

  if (isRsaPrivateKey(decoded)) {
    return decoded;
  }

  return undefined;
}

function isRsaPrivateKey(data: string): boolean {
  const possibleKey = `${data}`.trim();
  return /^-----BEGIN RSA PRIVATE KEY-----/.test(possibleKey) && /-----END RSA PRIVATE KEY-----$/.test(possibleKey);
}