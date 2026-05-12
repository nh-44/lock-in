const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '600485192811-7uut2v2abra8okm6q603erircdlhdtad.apps.googleusercontent.com';

function getBearerToken(req) {
  const authorization = req.headers.authorization || req.headers.Authorization;

  if (!authorization || typeof authorization !== 'string') {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

async function verifyGoogleToken(token) {
  if (!token) {
    throw new Error('ID token is required');
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if (!response.ok) {
    throw new Error('Token verification failed');
  }

  const payload = await response.json();

  if (payload.error) {
    throw new Error(payload.error_description || 'Invalid token');
  }

  if (payload.aud && payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Token audience mismatch');
  }

  if (payload.iss && !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
    throw new Error('Invalid token issuer');
  }

  return {
    google_id: payload.sub,
    email: payload.email || null,
    name: payload.name || null,
    picture: payload.picture || null,
  };
}

async function resolveGoogleIdentity(req, { allowUnverifiedFallback = false } = {}) {
  const token = req.body?.token || getBearerToken(req);
  if (token) {
    try {
      return await verifyGoogleToken(token);
    } catch (err) {
      if (!allowUnverifiedFallback) throw err;
    }
  }

  if (allowUnverifiedFallback) {
    const googleId = req.body?.google_id || req.query?.google_id;
    if (googleId) {
      return { google_id: googleId };
    }
  }

  throw new Error('Authentication token is required');
}

module.exports = { getBearerToken, resolveGoogleIdentity, verifyGoogleToken };