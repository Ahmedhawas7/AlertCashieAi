/**
 * Encryption utilities for storing sensitive tokens
 * Uses Web Crypto API (Cloudflare Workers compatible)
 */

export async function encrypt(text: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    let keyData: Uint8Array;
    if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
        // Hex to byte array
        keyData = new Uint8Array(secret.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
        keyData = encoder.encode(secret.padEnd(32, '0').slice(0, 32));
    }

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedText: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    let keyData: Uint8Array;
    if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
        keyData = new Uint8Array(secret.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
        keyData = encoder.encode(secret.padEnd(32, '0').slice(0, 32));
    }

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        'AES-GCM',
        false,
        ['decrypt']
    );

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
