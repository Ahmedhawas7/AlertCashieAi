export class CryptoUtils {
    /**
     * Encrypts a text using AES-256-GCM.
     * Returns a string in the format: iv:ciphertext:authTag (all hex)
     */
    static async encrypt(text: string, secretKeyHex: string): Promise<string> {
        if (!secretKeyHex || secretKeyHex.length !== 64) {
            throw new Error('Invalid ENCRYPTION_SECRET format. Must be 64-character hex string (32 bytes).');
        }

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const keyMaterial = this.hexToArrayBuffer(secretKeyHex);
        const key = await crypto.subtle.importKey(
            'raw',
            keyMaterial,
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );

        const encodedText = new TextEncoder().encode(text);
        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encodedText
        );

        // AES-GCM appends the auth tag to the end of the ciphertext.
        // We'll just convert the whole thing to hex and store it with the IV.
        const encryptedHex = this.arrayBufferToHex(encryptedBuffer);
        const ivHex = this.arrayBufferToHex(iv.buffer as ArrayBuffer);

        return `${ivHex}:${encryptedHex}`;
    }

    /**
     * Decrypts a text encrypted with the above method.
     * Returns the plaintext and a boolean indicating if it was found raw and needs migration.
     */
    static async decrypt(encryptedData: string, secretKeyHex: string): Promise<{ plaintext: string, needsMigration: boolean }> {
        if (!encryptedData.includes(':')) {
            // Unencrypted raw private key (migration fallback)
            if (encryptedData.startsWith('0x')) return { plaintext: encryptedData, needsMigration: true };
            throw new Error('Invalid encrypted data format.');
        }

        if (!secretKeyHex || secretKeyHex.length !== 64) {
            throw new Error('Invalid ENCRYPTION_SECRET format for decryption.');
        }

        const [ivHex, ciphertextHex] = encryptedData.split(':');
        const iv = this.hexToArrayBuffer(ivHex);
        const ciphertext = this.hexToArrayBuffer(ciphertextHex);

        const keyMaterial = this.hexToArrayBuffer(secretKeyHex);
        const key = await crypto.subtle.importKey(
            'raw',
            keyMaterial,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        try {
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(iv) },
                key,
                ciphertext
            );
            return { plaintext: new TextDecoder().decode(decryptedBuffer), needsMigration: false };
        } catch (e) {
            throw new Error('Decryption failed. Bad secret or data tampering.');
        }
    }

    private static hexToArrayBuffer(hex: string): ArrayBuffer {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    }

    private static arrayBufferToHex(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let hex = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
        }
        return hex;
    }
}
