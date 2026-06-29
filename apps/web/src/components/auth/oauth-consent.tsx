'use client';

import { useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { AuthLayout, Button, Heading, Text } from '@zuko/ui-kit';
import { authClient } from '@/lib/auth-client';

// Extend authClient type to include oauth2 methods from oauthProviderClient plugin
type OAuth2Client = typeof authClient & {
  oauth2: {
    consent: (params: {
      accept: boolean;
      scope?: string;
    }) => Promise<{ data?: { url: string }; error?: { message: string } }>;
  };
};

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  // OIDC standard scopes
  openid: 'Confirm your identity',
  profile: 'Read your name and profile picture',
  email: 'Read your email address',
  offline_access: 'Keep access without asking again',
  // MCP/Organization scopes
  'organization:read': 'Read your organizations',
  // CRM - Deals
  'deals:read': 'Read your deals',
  'deals:write': 'Create and update deals',
  // CRM - Contacts
  'contacts:read': 'Read your contacts',
  'contacts:write': 'Create and update contacts',
  // CRM - Companies
  'companies:read': 'Read your companies',
  'companies:write': 'Create and update companies',
  // CRM - Tasks
  'tasks:read': 'Read your tasks',
  'tasks:write': 'Create and update tasks',
  // CRM - Relations
  'relations:read': 'Read entity relations',
  'relations:write': 'Manage entity relations',
};

/**
 * OAuth consent screen for Zuko CRM.
 *
 * The backend's MCP/OAuth provider plugin redirects users here with a signed
 * authorization query. This component displays the requested scopes and allows
 * the user to accept or deny the request.
 *
 * According to Better Auth docs, the oauthProviderClient plugin automatically
 * includes the oauth_query parameter when calling oauth2.consent, so we don't
 * need to manually pass window.location.search.
 */
export function OAuthConsent() {
  const [clientId] = useQueryState('client_id', parseAsString);
  const [scope] = useQueryState('scope', parseAsString.withDefault(''));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'accept' | 'deny' | null>(null);

  const scopes = scope.split(' ').filter(Boolean);

  const respond = async (accept: boolean) => {
    setError(null);
    setSubmitting(accept ? 'accept' : 'deny');
    try {
      // Cast to OAuth2Client to access oauth2 methods from oauthProviderClient plugin
      const { data, error: consentError } = await (
        authClient as OAuth2Client
      ).oauth2.consent({
        accept,
        // The oauthProviderClient automatically includes oauth_query from the URL
        // If not provided, the originally requested scopes are accepted
      });

      if (consentError || !data?.url) {
        setError(
          consentError?.message ?? 'Failed to process consent. Please retry.',
        );
        setSubmitting(null);
        return;
      }

      // Redirect back to the OAuth client with the authorization result
      window.location.href = data.url;
    } catch (err) {
      // OAuth consent error - log for debugging
      // eslint-disable-next-line no-console
      console.error('OAuth consent error:', err);
      setError('An unexpected error occurred. Please try again.');
      setSubmitting(null);
    }
  };

  return (
    <AuthLayout>
      <div className="grid w-full max-w-sm grid-cols-1 gap-8">
        <div>
          <Heading className="text-center">Authorize application</Heading>
          <div className="mt-4 border-t border-zinc-200 dark:border-zinc-700" />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/50 dark:text-red-200">
            {error}
          </div>
        )}

        <Text>
          {clientId ? (
            <>
              An application (client{' '}
              <code className="font-mono text-xs">{clientId}</code>) is
              requesting access to your Zuko account:
            </>
          ) : (
            <>An application is requesting access to your Zuko account:</>
          )}
        </Text>

        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {scopes.map((scopeItem) => (
            <li key={scopeItem}>
              {SCOPE_DESCRIPTIONS[scopeItem] ?? scopeItem}
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-4">
          <Button
            outline
            disabled={submitting !== null}
            onClick={() => respond(false)}
          >
            {submitting === 'deny' ? 'Denying...' : 'Deny'}
          </Button>
          <Button disabled={submitting !== null} onClick={() => respond(true)}>
            {submitting === 'accept' ? 'Allowing...' : 'Allow'}
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
