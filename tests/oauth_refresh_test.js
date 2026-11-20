// ============================================================================
// File: tests/oauth_refresh_test.js
// Owner: Dhruv (Database & Auth)
// Purpose: Test suite covering OAuth2, OpenID Connect (OIDC), JWT access tokens,
//          cryptographically hashed refresh tokens, rotation, and revocation.
// Run with: node tests/oauth_refresh_test.js
// ============================================================================

const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: rawData });
          }
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASSED: ${message}`);
}

async function runOAuthRefreshTests() {
  console.log('🔐 [CoBuy Auth] Starting OAuth2, OIDC & Refresh Token Test Suite...\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ------------------------------------------------------------------------
    // 1. Dual-Token Issuance on Login (JWT Access Token + Refresh Token)
    // ------------------------------------------------------------------------
    console.log('--- 1. Testing Dual-Token Issuance on Login ---');

    const timestamp = Date.now();
    const testUser = {
      username: `dual_tok_${timestamp}`,
      email: `dualtok_${timestamp}@cobuy.test`,
      password: 'password123',
      roles: ['restaurant_owner']
    };

    const regRes = await request('POST', '/api/users/register', testUser);
    assert(regRes.status === 201, 'User registered successfully');

    const loginRes = await request('POST', '/api/users/login', {
      email: testUser.email,
      password: testUser.password
    });

    assert(loginRes.status === 200, 'Login succeeds');
    assert(!!loginRes.body.data.token, 'Response contains token (backward compatibility)');
    assert(!!loginRes.body.data.accessToken, 'Response contains JWT accessToken');
    assert(!!loginRes.body.data.refreshToken, 'Response contains opaque refreshToken');
    assert(loginRes.body.data.tokenType === 'Bearer', 'tokenType is Bearer');
    assert(loginRes.body.data.expiresIn === 900, 'Access token expiration is 900s (15 min)');

    const initialAccessToken = loginRes.body.data.accessToken;
    let currentRefreshToken = loginRes.body.data.refreshToken;

    // Verify access token can authenticate protected endpoints
    const meRes = await request('GET', '/api/users/me', null, initialAccessToken);
    assert(meRes.status === 200, 'Access token authenticates GET /api/users/me');
    assert(meRes.body.data.user.email === testUser.email, 'Decoded user email matches');

    // ------------------------------------------------------------------------
    // 2. Refresh Token Flow & Cryptographic Rotation
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Token Refresh & Rotation ---');

    const refreshRes = await request('POST', '/api/users/refresh', {
      refreshToken: currentRefreshToken
    });

    assert(refreshRes.status === 200, 'Refresh endpoint succeeds with valid refreshToken');
    assert(!!refreshRes.body.data.accessToken, 'New accessToken received');
    assert(!!refreshRes.body.data.refreshToken, 'New rotated refreshToken received');
    assert(
      refreshRes.body.data.refreshToken !== currentRefreshToken,
      'Refresh Token Rotation: Old refresh token is replaced with new token'
    );

    const newAccessToken = refreshRes.body.data.accessToken;
    const oldRefreshToken = currentRefreshToken;
    currentRefreshToken = refreshRes.body.data.refreshToken;

    // Verify new access token works
    const meAfterRefresh = await request('GET', '/api/users/me', null, newAccessToken);
    assert(meAfterRefresh.status === 200, 'Newly refreshed access token authenticates successfully');

    // ------------------------------------------------------------------------
    // 3. Security Check: Replaying Revoked Refresh Token
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing Revocation Defense (Token Rotation Protection) ---');

    const replayRes = await request('POST', '/api/users/refresh', {
      refreshToken: oldRefreshToken
    });

    assert(replayRes.status === 401, 'Replaying revoked refresh token is rejected with HTTP 401');
    assert(
      replayRes.body.error.code === 'INVALID_REFRESH_TOKEN',
      'Error code is INVALID_REFRESH_TOKEN'
    );

    // Testing invalid/garbage refresh token
    const garbageRes = await request('POST', '/api/users/refresh', {
      refreshToken: 'totally-invalid-garbage-token-xyz'
    });
    assert(garbageRes.status === 401, 'Garbage refresh token rejected with HTTP 401');

    // ------------------------------------------------------------------------
    // 4. Logout & Explicit Refresh Token Revocation
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing Logout & Token Revocation ---');

    const logoutRes = await request('POST', '/api/users/logout', {
      refreshToken: currentRefreshToken
    });
    assert(logoutRes.status === 200, 'Logout succeeds with HTTP 200');

    // Attempt to refresh with the logged-out token
    const refreshAfterLogout = await request('POST', '/api/users/refresh', {
      refreshToken: currentRefreshToken
    });
    assert(refreshAfterLogout.status === 401, 'Logged out refresh token is rejected on refresh attempt');

    // ------------------------------------------------------------------------
    // 5. OAuth2 / OIDC: Authorization URL Generation
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Testing OAuth2 / OIDC Authorization URL ---');

    const authUrlRes = await request('GET', '/api/users/oauth/authorize?provider=google&role=supplier');
    if (authUrlRes.status === 503) {
      assert(
        authUrlRes.body.error.code === 'OAUTH_NOT_CONFIGURED',
        'Unconfigured OAuth reports OAUTH_NOT_CONFIGURED instead of inventing an authorization URL'
      );
    } else {
      assert(authUrlRes.status === 200, 'GET /api/users/oauth/authorize succeeds when configured');
      assert(
        authUrlRes.body.data.authorizationUrl.includes('accounts.google.com'),
        'Authorization URL points to Google OIDC endpoint'
      );
      assert(
        authUrlRes.body.data.authorizationUrl.includes('scope=openid+email+profile'),
        'OIDC openid, email, and profile scopes are requested'
      );
      assert(!!authUrlRes.body.data.state, 'Cryptographic state parameter is returned for CSRF protection');
    }

    // ------------------------------------------------------------------------
    // 6. Mock / forged authorization codes are rejected
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Testing That Mock / Forged OAuth Codes Are Rejected ---');

    const mockedCallback = await request(
      'GET',
      `/api/users/oauth/callback?code=mock_chef_${timestamp}&state=anything`
    );
    assert(mockedCallback.status !== 200, 'OIDC callback rejects a mock_ authorization code');
    assert(!mockedCallback.body?.data, 'No tokens are issued for a mock_ authorization code');

    const forgedCallback = await request(
      'GET',
      `/api/users/oauth/callback?code=test_forged_${timestamp}`
    );
    assert(forgedCallback.status !== 200, 'OIDC callback rejects a test_ authorization code');
    assert(!forgedCallback.body?.data, 'No tokens are issued for a test_ authorization code');

    const spaTokenRes = await request('POST', '/api/users/oauth/token', {
      code: `mock_spaclient_${timestamp}`,
      role: 'restaurant_owner'
    });
    assert(spaTokenRes.status !== 200, 'SPA token exchange rejects a mock_ authorization code');
    assert(!spaTokenRes.body?.data, 'SPA token exchange issues no tokens for a mock_ code');

    // ------------------------------------------------------------------------
    // 7. The mock sign-in endpoint is gone
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Testing That The Mock Sign-In Endpoint Is Gone ---');

    const mockOIDCRes = await request('POST', '/api/users/oauth/mock', {
      email: `no.self.signup.${timestamp}@example.com`,
      name: 'No Self Signup',
      role: 'restaurant_owner'
    });
    assert(mockOIDCRes.status === 404, 'POST /api/users/oauth/mock is removed (HTTP 404)');
    assert(!mockOIDCRes.body?.data, 'The removed endpoint cannot mint an account or tokens');

    console.log('\n🎉 ALL OAUTH2, OIDC & REFRESH TOKEN TESTS PASSED 100%!\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

runOAuthRefreshTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
