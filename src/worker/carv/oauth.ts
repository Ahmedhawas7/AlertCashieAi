import { Env } from '../types';

export interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
    refresh_token?: string;
    id_token?: string;
}

export interface UserInfo {
    carv_id: string;
    wallet_address?: string;
    email?: string;
}

/**
 * Generate CARV OAuth authorization URL
 */
export function generateAuthUrl(env: Env, state: string): string {
    const authBase = env.CARV_AUTH_URL || 'https://auth.carv.io/auth/authorize';
    const params = new URLSearchParams({
        client_id: env.CARV_CLIENT_ID || '',
        response_type: 'code',
        redirect_uri: env.CARV_REDIRECT_URL,
        state: state,
        scope: 'carv_id_basic_read email_basic_read evm_address_basic_read'
    });

    return `${authBase}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForTokens(
    env: Env,
    code: string
): Promise<TokenResponse> {
    const tokenUrl = env.CARV_TOKEN_URL || 'https://oauth.carv.io/oauth2/token';

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${env.CARV_CLIENT_ID}:${env.CARV_CLIENT_SECRET}`)}`
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: env.CARV_REDIRECT_URL
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
    }

    return await response.json() as TokenResponse;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
    env: Env,
    refreshToken: string
): Promise<TokenResponse> {
    const tokenUrl = env.CARV_TOKEN_URL || 'https://oauth.carv.io/oauth2/token';

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${env.CARV_CLIENT_ID}:${env.CARV_CLIENT_SECRET}`)}`
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
    }

    return await response.json() as TokenResponse;
}

/**
 * Fetch user info using access token
 */
export async function getUserInfo(
    env: Env,
    accessToken: string
): Promise<any> {
    const userInfoUrl = env.CARV_USERINFO_URL || 'https://oauth.carv.io/api/userinfo';

    const response = await fetch(userInfoUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`UserInfo fetch failed: ${error}`);
    }

    return await response.json();
}
