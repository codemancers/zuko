'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StoredMcpToken = {
  accessToken: string;
  expiresAt: number;
  connectedAt: number;
};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const MCP_STORAGE_KEY = 'zuko_mcp_token';
const MCP_SESSION_VERIFIER = 'zuko_mcp_verifier';
const MCP_SESSION_CLIENT_ID = 'zuko_mcp_client_id';

// Security note: The MCP access token is stored in localStorage so users can
// copy-paste it into their AI agent configs (Claude Code, Cursor, etc.). This is
// intentionally readable by JavaScript. Ensure CSP headers are strict and XSS
// mitigations are in place, as any script on the page could read this token.

export function loadMcpToken(): StoredMcpToken | null {
  try {
    const raw = localStorage.getItem(MCP_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredMcpToken) : null;
  } catch {
    return null;
  }
}

function saveMcpToken(accessToken: string, expiresIn: number): void {
  localStorage.setItem(
    MCP_STORAGE_KEY,
    JSON.stringify({
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      connectedAt: Date.now(),
    }),
  );
}

function clearMcpToken(): void {
  localStorage.removeItem(MCP_STORAGE_KEY);
}

export function isMcpExpired(t: StoredMcpToken): boolean {
  return Date.now() >= t.expiresAt;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function getAuthBaseUrl(): string {
  if (process.env.NODE_ENV === 'production')
    return `${window.location.origin}/auth`;
  return 'http://localhost:3001/auth';
}

export function getMcpEndpoint(): string {
  if (process.env.NODE_ENV === 'production') {
    const b = process.env.NEXT_PUBLIC_BACKEND_URL;
    return b ? `${b}/api/mcp` : `${window.location.origin}/api/mcp`;
  }
  return 'http://localhost:3001/api/mcp';
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, 43);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ---------------------------------------------------------------------------
// McpOAuthHandler — handles the OAuth callback (code exchange)
// ---------------------------------------------------------------------------

type McpOAuthHandlerProps = {
  onSuccess: (token: StoredMcpToken) => void;
  onPending: (pending: boolean) => void;
};

export function McpOAuthHandler({
  onSuccess,
  onPending,
}: McpOAuthHandlerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exchangedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const verifier = sessionStorage.getItem(MCP_SESSION_VERIFIER);
    if (!code || !verifier || exchangedRef.current) return;
    exchangedRef.current = true;

    const clientId = sessionStorage.getItem(MCP_SESSION_CLIENT_ID);
    if (!clientId) return;

    onPending(true);
    const redirectUri = `${window.location.origin}/settings?tab=connections`;

    fetch(`${getAuthBaseUrl()}/mcp/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
      }).toString(),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((tokens) => {
        sessionStorage.removeItem(MCP_SESSION_VERIFIER);
        sessionStorage.removeItem(MCP_SESSION_CLIENT_ID);
        saveMcpToken(tokens.access_token, tokens.expires_in ?? 3600);
        const stored = loadMcpToken();
        if (stored) onSuccess(stored);
        toast.success('Connected to Zuko MCP!');
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        router.replace(url.pathname + url.search);
      })
      .catch(() => {
        toast.error('Authentication failed. Please try again.');
      })
      .finally(() => onPending(false));
  }, [searchParams, router, onSuccess, onPending]);

  return null;
}

// ---------------------------------------------------------------------------
// useMcpOAuth hook — manages MCP token state and connect/disconnect actions
// ---------------------------------------------------------------------------

export function useMcpOAuth() {
  const [mcpToken, setMcpToken] = useState<StoredMcpToken | null>(null);
  const [mcpPending, setMcpPending] = useState(false);

  // Load token from localStorage on mount
  useEffect(() => {
    const t = loadMcpToken();
    if (t && !isMcpExpired(t)) setMcpToken(t);
    else if (t) clearMcpToken();
  }, []);

  const handleMcpSuccess = useCallback(
    (token: StoredMcpToken) => setMcpToken(token),
    [],
  );
  const handleMcpPending = useCallback(
    (pending: boolean) => setMcpPending(pending),
    [],
  );

  const handleMcpConnect = useCallback(async () => {
    setMcpPending(true);
    try {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      const redirectUri = `${window.location.origin}/settings?tab=connections`;

      const regRes = await fetch(`${getAuthBaseUrl()}/mcp/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Zuko MCP',
          redirect_uris: [redirectUri],
          grant_types: ['authorization_code'],
          token_endpoint_auth_method: 'none',
        }),
      });
      if (!regRes.ok) throw new Error(`Registration failed: ${regRes.status}`);
      const { client_id: clientId } = await regRes.json();

      sessionStorage.setItem(MCP_SESSION_VERIFIER, verifier);
      sessionStorage.setItem(MCP_SESSION_CLIENT_ID, clientId);

      const url = new URL(`${getAuthBaseUrl()}/mcp/authorize`);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', 'openid profile email');
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      window.location.href = url.toString();
    } catch {
      toast.error('Failed to start authentication. Is the backend running?');
      setMcpPending(false);
    }
  }, []);

  const handleMcpDisconnect = useCallback(() => {
    clearMcpToken();
    setMcpToken(null);
    toast.success('Disconnected from Zuko MCP');
  }, []);

  const mcpConnected = !!mcpToken && !isMcpExpired(mcpToken);

  return {
    mcpToken,
    mcpPending,
    mcpConnected,
    handleMcpSuccess,
    handleMcpPending,
    handleMcpConnect,
    handleMcpDisconnect,
  };
}
