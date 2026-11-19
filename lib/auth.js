// Google sign-in (NextAuth v4), limited to Digiteam Workspace accounts.
// Machine callers (Vercel cron, Userback webhook) use their own secrets instead.
import GoogleProvider from 'next-auth/providers/google';
import { getToken } from 'next-auth/jwt';

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'digiteam.ca').toLowerCase();
// Sign-in lasts 7 days from the moment you sign in, then Google sign-in again. NextAuth normally
// extends a session every time it's used; signedInAt makes it a hard limit, so someone who has
// left Digiteam is locked out within a week even if they keep the tab open.
const SESSION_DAYS = 7;
const SESSION_SECONDS = 60 * 60 * 24 * SESSION_DAYS;

export function isAllowedEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: SESSION_SECONDS },
  jwt: { maxAge: SESSION_SECONDS },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // hd pre-selects Digiteam accounts on Google's screen; the real check is in signIn below
      authorization: { params: { hd: ALLOWED_DOMAIN, prompt: 'select_account' } },
    }),
  ],
  pages: { signIn: '/', error: '/' },
  callbacks: {
    // Stamp the sign-in time once; it never moves when the session is refreshed
    async jwt({ token, account }) {
      if (account) token.signedInAt = Date.now();
      return token;
    },
    async signIn({ profile }) {
      return Boolean(profile?.email_verified) && isAllowedEmail(profile?.email) && profile?.hd === ALLOWED_DOMAIN;
    },
  },
};

// Who can open the Admin tab. ADMIN_EMAILS is a comma-separated list; leave it unset
// to let every signed-in Digiteam user in.
export function isAdmin(user) {
  const list = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!user) return false;
  return list.length === 0 || list.includes(user.email.toLowerCase());
}

// Returns { email, name, picture } for a signed-in Digiteam user, otherwise null
export async function getUser(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !isAllowedEmail(token.email)) return null;
  // Older sessions (from before this rule) have no stamp and sign in again once
  if (!token.signedInAt || Date.now() - Number(token.signedInAt) > SESSION_SECONDS * 1000) return null;
  return { email: token.email, name: token.name || null, picture: token.picture || null };
}
