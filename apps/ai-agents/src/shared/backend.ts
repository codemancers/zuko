interface BackendRequestConfig {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  userId: string;
  body?: any;
  organisationId?: string;
}

export const Backend = async (
  endpoint: string,
  config: BackendRequestConfig
) => {
  const { method = "GET", userId, body, organisationId } = config;

  // Build URL with query parameters
  const url = new URL(`${process.env.BACKEND_URL}/api/agents${endpoint}`);

  const AGENT_TOKEN = process.env.AGENT_TOKEN;
  if (!AGENT_TOKEN) {
    throw new Error("AGENT_TOKEN is not set");
  }

  const fetchConfig: RequestInit = {
    method,
    headers: {
      "x-user-id": userId,
      "x-agent-token": AGENT_TOKEN,
      "Content-Type": "application/json",
      "x-org-id": organisationId || "",
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
      error: error instanceof Error ? error.message : "Request failed",
      success: false,
    };
  }
};