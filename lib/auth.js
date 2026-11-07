// Google sign-in (NextAuth v4), limited to Digiteam Workspace accounts.
// Machine callers (Vercel cron, Userback webhook) use their own secrets instead.
import GoogleProvider from 'next-auth/providers/google';
import { getToken } from 'next-auth/jwt';

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'digiteam.ca').toLowerCase();
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function isAllowedEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: THIRTY_DAYS },
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
  return { email: token.email, name: token.name || null, picture: token.picture || null };
}
