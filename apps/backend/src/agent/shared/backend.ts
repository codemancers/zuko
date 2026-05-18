interface BackendRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  userId?: string;
  body?: any;
  organisationId?: string;
  signJwt?: (capabilities: string[]) => Promise<string>;
  capabilities?: string[];
}

export const Backend = async (
  endpoint: string,
  config: BackendRequestConfig,
) => {
  const {
    method = 'GET',
    userId,
    body,
    organisationId,
    signJwt,
    capabilities = [],
  } = config;

  if (!signJwt) {
    return {
      error:
        'signJwt not available in tool context — agent identity not initialised',
      success: false,
    };
  }

  const url = new URL(`${process.env.BACKEND_URL}/api/agents${endpoint}`);
  const token = await signJwt(capabilities);

  const fetchConfig: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-user-id': userId || '',
      'x-org-id': organisationId || '',
    },
  };

  if (body) {
    fetchConfig.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url.toString(), fetchConfig);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    return { data: responseData, success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Request failed',
      success: false,
    };
  }
};
