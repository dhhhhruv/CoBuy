// ============================================================================
// File: src/auth/oidcService.js
// Owner: Dhruv (Database & Auth)
// Purpose: OAuth2 & OpenID Connect (OIDC) service handling provider endpoints,
//          authorization URLs, token exchange, and userinfo retrieval.
// ============================================================================

const crypto = require('crypto');
const { generateOAuthState } = require('./authUtils');

// Default provider configuration (Google OIDC endpoints)
const GOOGLE_CONFIG = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
  scopes: ['openid', 'email', 'profile']
};

/**
 * Builds the OAuth2 / OIDC authorization URL for redirection.
 *
 * @param {object} params
 * @param {string} params.provider - 'google' or custom
 * @param {string} params.role - Selected system role ('restaurant_owner' or 'supplier')
 * @param {string} params.redirectUri - Callback URL
 * @returns {object} { authorizationUrl, state }
 */
function getAuthorizationUrl({
  provider = 'google',
  role = 'restaurant_owner',
  redirectUri = process.env.OAUTH_GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/users/oauth/callback'
}) {
  const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID;
  if (!clientId) {
    const err = new Error('Google OAuth is not configured: set OAUTH_GOOGLE_CLIENT_ID (and OAUTH_GOOGLE_CLIENT_SECRET) before using OIDC sign-in.');
    err.code = 'OAUTH_NOT_CONFIGURED';
    throw err;
  }

  const rawState = generateOAuthState();
  // State encodes a random CSRF token plus chosen initial role
  const state = Buffer.from(JSON.stringify({ csrf: rawState, role })).toString('base64url');

  const queryParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CONFIG.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent'
  });

  return {
    authorizationUrl: `${GOOGLE_CONFIG.authUrl}?${queryParams.toString()}`,
    state,
    provider
  };
}

/**
 * Parses and validates the state parameter from OAuth2 callback.
 */
function parseOAuthState(stateString) {
  try {
    const decoded = JSON.parse(Buffer.from(stateString, 'base64url').toString('utf8'));
    return {
      valid: true,
      role: decoded.role || 'restaurant_owner',
      csrf: decoded.csrf
    };
  } catch (err) {
    return {
      valid: false,
      role: 'restaurant_owner',
      csrf: null
    };
  }
}

/**
 * Exchanges an authorization code for OIDC identity.
 *
 * Security note: this only ever trusts the provider. There is no mock mode and
 * no simulated fallback — an invalid code, or a missing provider configuration,
 * fails closed instead of minting a verified identity.
 *
 * @param {string} code - Authorization code from callback
 * @param {string} redirectUri - Must match the redirect_uri used in authorize
 * @returns {Promise<object>} Identity profile: { email, name, sub, provider }
 */
async function exchangeCodeForProfile(code, redirectUri = process.env.OAUTH_GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/users/oauth/callback') {
  if (!code || typeof code !== 'string') {
    throw new Error('Authorization code is required');
  }

  const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const err = new Error('Google OAuth is not configured: set OAUTH_GOOGLE_CLIENT_ID and OAUTH_GOOGLE_CLIENT_SECRET.');
    err.code = 'OAUTH_NOT_CONFIGURED';
    throw err;
  }

  const tokenRes = await fetch(GOOGLE_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!tokenRes.ok) {
    const err = new Error(`OIDC token exchange rejected the authorization code (HTTP ${tokenRes.status})`);
    err.code = 'INVALID_GRANT';
    throw err;
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Fetch verified claims from the UserInfo endpoint
  const userinfoRes = await fetch(GOOGLE_CONFIG.userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!userinfoRes.ok) {
    throw new Error('Failed to fetch OIDC userinfo');
  }

  const profile = await userinfoRes.json();
  if (!profile.email) {
    throw new Error('OIDC userinfo did not include an email address');
  }

  return {
    email: profile.email,
    name: profile.name || profile.email.split('@')[0],
    sub: profile.sub,
    provider: 'google',
    isVerified: profile.email_verified === true
  };
}

module.exports = {
  GOOGLE_CONFIG,
  getAuthorizationUrl,
  parseOAuthState,
  exchangeCodeForProfile
};
