/**
 * Encryption utilities for storing sensitive tokens
 * Uses Web Crypto API (Cloudflare Workers compatible)
 */

export async function encrypt(text: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Derive key from secret
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret.padEnd(32, '0').slice(0, 32)),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('carv-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Return as base64
    return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedText: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    // Derive key
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret.padEnd(32, '0').slice(0, 32)),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('carv-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    return decoder.decode(decrypted);
}

/**
 * Generate cryptographically secure random state for OAuth
 */
export function generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
