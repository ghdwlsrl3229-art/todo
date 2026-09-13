/**
 * Isolated GitHub API calls, kept separate from the route handlers so tests
 * can fetch-mock them without a real GitHub OAuth App.
 */

export interface GithubTokenResponse {
  access_token: string;
}

export interface GithubUser {
  id: number;
  login: string;
  avatar_url: string;
}

export class GithubOAuthError extends Error {}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GithubOAuthError("GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET is not configured");
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!res.ok) {
    throw new GithubOAuthError(`GitHub token exchange failed with status ${res.status}`);
  }

  const data = (await res.json()) as GithubTokenResponse & { error?: string; error_description?: string };
  if (!data.access_token) {
    throw new GithubOAuthError(data.error_description ?? data.error ?? "GitHub token exchange returned no access_token");
  }
  return data.access_token;
}

export async function fetchGithubUser(accessToken: string): Promise<GithubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "todo-app",
    },
  });

  if (!res.ok) {
    throw new GithubOAuthError(`GitHub user fetch failed with status ${res.status}`);
  }

  return (await res.json()) as GithubUser;
}
