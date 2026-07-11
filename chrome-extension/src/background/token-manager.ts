import type { Tenant } from '../types';

interface CachedToken {
  accessToken: string;
  expiresAt: number; // ms timestamp
}

const tokenCache = new Map<string, CachedToken>();

export async function getAccessToken(tenant: Tenant): Promise<string> {
  const cached = tokenCache.get(tenant.id);
  if (cached && Date.now() < cached.expiresAt - 30_000) {
    console.log(`[TokenMgr] Using cached token for ${tenant.name}`);
    return cached.accessToken;
  }

  console.log(`[TokenMgr] Requesting new token for ${tenant.name} from ${tenant.tokenUrl}`);

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: tenant.clientId,
    client_secret: tenant.clientSecret,
  });

  try {
    const response = await fetch(tenant.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[TokenMgr] OAuth failed (${response.status}):`, text);
      throw new Error(`OAuth token request failed (${response.status}): ${text}`);
    }

    const json = (await response.json()) as { access_token: string; expires_in: number };
    const entry: CachedToken = {
      accessToken: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    tokenCache.set(tenant.id, entry);
    console.log(`[TokenMgr] Token acquired successfully for ${tenant.name}`);
    return entry.accessToken;
  } catch (err) {
    console.error('[TokenMgr] Error during token fetch:', err);
    throw err;
  }
}

export function invalidateToken(tenantId: string): void {
  tokenCache.delete(tenantId);
}
