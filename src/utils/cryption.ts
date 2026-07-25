import * as crypto from 'crypto';
import { env } from './env';

// Ensure you have a 32-byte (64 hex characters) key in your environment variables
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM

export class Cryption {
  encrypt(data: any): string {
    // 1. Serialize the data to a string
    const textToEncrypt = typeof data === 'object' ? JSON.stringify(data) : String(data);

    // 2. Generate a random Initialization Vector (IV) for uniqueness
    const iv = crypto.randomBytes(IV_LENGTH);
    if (!env.ENCRIPTION_KEY) {
      throw new Error('ENCRIPTION_KEY is not defined in environment variables.');
    }
    const enc_key = env.ENCRIPTION_KEY
    // 3. Create the cipher
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(enc_key, 'hex'),
      iv
    ) as crypto.CipherGCM;

    // 4. Encrypt the data
    let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 5. Get the authentication tag (unique to GCM)
    const authTag = cipher.getAuthTag().toString('hex');

    // 6. Combine IV, Auth Tag, and Encrypted Data into one string separated by colons
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }
  decrypt<T = any>(encryptedString: string): T {
    // 1. Split the component parts out of the string
    const [ivHex, authTagHex, encryptedHex] = encryptedString.split(':');

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted string format.');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    if (!env.ENCRIPTION_KEY) {
      throw new Error('ENCRIPTION_KEY is not defined in environment variables.');
    }
    const enc_key = env.ENCRIPTION_KEY
    // 2. Create the decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(enc_key, 'hex'),
      iv
    ) as crypto.DecipherGCM;

    // 3. Set the authentication tag to ensure data hasn't been tampered with
    decipher.setAuthTag(authTag);

    // 4. Decrypt the data
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // 5. Try to parse it back to an object if it looks like JSON, otherwise return string
    try {
      return JSON.parse(decrypted) as T;
    } catch {
      return decrypted as unknown as T;
    }
  }
}
