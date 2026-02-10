/**
 * Secure fetcher for FreeAI ingestion.
 * Handles timeouts, size limits, and basic validation.
 */
export async function fetchUrl(url: string, timeoutMs: number = 10000): Promise<{ text: string; contentType: string; status: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'HawasFreeAI/1.0 (Autonomous Agent; +https://github.com/Ahmedhawas7/AlertCashieAi)',
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return { text: "", contentType: "", status: response.status };
        }

        const contentType = response.headers.get('content-type') || "";
        const contentLength = parseInt(response.headers.get('content-length') || "0");

        // 1.5MB Limit
        if (contentLength > 1.5 * 1024 * 1024) {
            throw new Error("Content too large (max 1.5MB)");
        }

        // Allowlist
        if (!contentType.includes('text/html') &&
            !contentType.includes('application/json') &&
            !contentType.includes('application/xml') &&
            !contentType.includes('text/plain')) {
            throw new Error(`Unsupported content type: ${contentType}`);
        }

        const text = await response.text();
        return { text, contentType, status: response.status };

    } catch (err: any) {
        clearTimeout(timeout);
        throw err;
    }
}
