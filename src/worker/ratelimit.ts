/**
 * Rate limiting for sensitive endpoints
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if request should be rate limited
 * @param key - Unique identifier (e.g., telegram_id or IP)
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns true if rate limit exceeded
 */
export function isRateLimited(key: string, maxRequests: number = 3, windowMs: number = 60000): boolean {
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
        // New window
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + windowMs
        });
        return false;
    }

    if (entry.count >= maxRequests) {
        return true;
    }

    entry.count++;
    return false;
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetAt) {
            rateLimitStore.delete(key);
        }
    }
}
