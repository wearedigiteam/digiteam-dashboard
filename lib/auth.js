import crypto from 'crypto';

const SESSION_COOKIE = 'dt_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sign(value, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('hex');
}

export function createToken(password) {
  const secret = process.env.SESSION_SECRET || 'fallback-dev-secret';
  const timestamp = Date.now().toString();
  const hash = sign(`${password}:${timestamp}`, secret);
  return Buffer.from(`${timestamp}:${hash}`).toString('base64');
}

export function verifyToken(token) {
  try {
    const secret = process.env.SESSION_SECRET || 'fallback-dev-secret';
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [timestamp, hash] = decoded.split(':');
    const password = process.env.DASHBOARD_PASSWORD;
    const expected = sign(`${password}:${timestamp}`, secret);
    const valid = crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expected, 'hex')
    );
    // Expire after 7 days
    const age = Date.now() - parseInt(timestamp, 10);
    return valid && age < COOKIE_MAX_AGE * 1000;
  } catch {
    return false;
  }
}

export function getTokenFromRequest(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
  return cookies[SESSION_COOKIE] || null;
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Strict${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`,
  ]);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`,
  ]);
}
