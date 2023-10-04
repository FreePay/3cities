import { ElementType } from "./ElementType";

/*
Notes on possible attack vectors:

Side - Channel Attacks: Timing attacks could potentially leak information about the password or key.

User Password: If a weak password is used, no matter how strong the library, the system is vulnerable.An attacker can brute - force weak passwords even with PBKDF2 and high iteration counts if the password itself is weak enough.

Salt Reuse: If the salt isn't unique for each encryption or signature, an attacker can carry out rainbow table attacks.

IV Reuse in AES - GCM: The same IV and key should not be used to encrypt more than one plaintext.If they are, it's possible to break the encryption.

Secure Key Destruction: Since isKeyExtractable is set to false, it's less likely, but if keys aren't securely destroyed after use, they could potentially be recovered from memory.

Data Integrity: While HMAC does provide integrity, the encryption function is separate and doesn't inherently protect against data tampering. An attacker could alter the data and then re-sign it if they have access to the key.

API Misuse: If the library is used incorrectly by the developer(e.g., reusing salts or IVs), security could be compromised.

JavaScript Environment: Since this is a JS library, it's susceptible to various web-based attacks like XSS, which could compromise the entire encryption/decryption process.

Resource Exhaustion: The high iteration count in PBKDF2 could be exploited in a DoS attack.An attacker could continuously request operations that force the server to perform this computationally expensive calculation.

Error Handling: The library does not seem to handle errors. Incorrect implementations can leak information.
*/

const keyBitLength = 256; // 256 bits is currently recommended for strong security.
const keyFormat = 'raw'; // 'raw' is typically used for symmetric algorithms. WARNING: Changing this may result in security vulnerabilities.
const isKeyExtractable = false; // Must be false for security. WARNING: Setting to true may expose the key and risk security.
const keyDerivationAlgorithm = 'PBKDF2'; // PBKDF2 is widely supported and recommended for strong security.
const hashFunction = 'SHA-256'; // SHA-256 offers a good balance of speed and security.
const hmacAlgorithm = 'HMAC'; // HMAC is widely supported and provides strong security.
const encryptionAlgorithm = 'AES-GCM'; // AES-GCM is recommended for symmetric encryption.
const saltOrIvByteLength = 32; // 32 bytes is a good default for PBKDF2.
const iterations = 2000000; // 2 million is recommended for strong security as of 2022. WARNING: Lowering this number reduces security.

// makeSaltOrIv is a convenience function that may be used to create
// secure parameter values for salt and iv parameters required by other
// public APIs in this library.
export async function makeSaltOrIv(): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(saltOrIvByteLength));
}

type ImportKeyParams = ['raw', Uint8Array, string, boolean, 'deriveKey'[]];
function buildImportKeyParams(password: string): ImportKeyParams {
  const encoder = new TextEncoder();
  return [
    keyFormat,
    encoder.encode(password),
    keyDerivationAlgorithm,
    isKeyExtractable,
    ['deriveKey'],
  ];
}

type DeriveKeyParamsForSignature = [Pbkdf2Params, CryptoKey, HmacImportParams, boolean, ('sign' | 'verify')[]];
function buildDeriveKeyParamsForSignature(baseKey: CryptoKey, salt: Uint8Array, operation: ElementType<DeriveKeyParamsForSignature[4]>): DeriveKeyParamsForSignature {
  return [
    {
      name: keyDerivationAlgorithm,
      salt,
      iterations,
      hash: hashFunction
    },
    baseKey,
    { name: hmacAlgorithm, hash: hashFunction, length: keyBitLength },
    isKeyExtractable,
    [operation],
  ];
}

// generateSignature returns a signature for the passed data secured by
// the passed password and salt. The passed salt may be created with
// makeSaltOrIv. Later, verify the signature using verifySignature.
export async function generateSignature(data: Uint8Array, password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey(...buildImportKeyParams(password));
  const derivedKey = await crypto.subtle.deriveKey(...buildDeriveKeyParamsForSignature(baseKey, salt, 'sign'));
  return crypto.subtle.sign(hmacAlgorithm, derivedKey, data);
}

// verifySignature verifies that the passed data was signed with the
// passed signature using the passed password and salt. The signature
// must have been created using generateSignature.
export async function verifySignature(data: Uint8Array, signature: ArrayBuffer, password: string, salt: Uint8Array): Promise<{ verificationSuccessful: boolean }> {
  const baseKey = await crypto.subtle.importKey(...buildImportKeyParams(password));
  const derivedKey = await crypto.subtle.deriveKey(...buildDeriveKeyParamsForSignature(baseKey, salt, 'verify'));
  const verificationSuccessful = await crypto.subtle.verify(hmacAlgorithm, derivedKey, signature, data);
  return { verificationSuccessful };
}

type DeriveKeyParamsForEncryption = [Pbkdf2Params, CryptoKey, AesDerivedKeyParams, boolean, ('encrypt' | 'decrypt')[]];
function buildDeriveKeyParamsForEncryption(baseKey: CryptoKey, salt: Uint8Array, operation: ElementType<DeriveKeyParamsForEncryption[4]>): DeriveKeyParamsForEncryption {
  return [
    {
      name: keyDerivationAlgorithm,
      salt,
      iterations,
      hash: hashFunction,
    },
    baseKey,
    { name: encryptionAlgorithm, length: keyBitLength },
    isKeyExtractable,
    [operation],
  ];
}

// encrypt returns the encryption of the passed data using the passed
// password, salt, and iv. makeSaltOrIv may be used to create values for
// salt and iv.
export async function encrypt(data: Uint8Array, password: string, salt: Uint8Array, iv: Uint8Array): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey(...buildImportKeyParams(password));
  const derivedKey = await crypto.subtle.deriveKey(...buildDeriveKeyParamsForEncryption(baseKey, salt, 'encrypt'));
  return crypto.subtle.encrypt({ name: encryptionAlgorithm, iv: iv }, derivedKey, data);
}

// decrypt returns the decryption of the passed data using the passed
// pasword, salt, and iv. The data must have been encrypted using
// encrypt.
export async function decrypt(data: ArrayBuffer, password: string, salt: Uint8Array, iv: Uint8Array): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey(...buildImportKeyParams(password));
  const derivedKey = await crypto.subtle.deriveKey(...buildDeriveKeyParamsForEncryption(baseKey, salt, 'decrypt'));
  return crypto.subtle.decrypt({ name: encryptionAlgorithm, iv: iv }, derivedKey, data);
}
