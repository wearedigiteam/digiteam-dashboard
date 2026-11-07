// Remembers which once-per-person easter eggs someone has already seen.
// The period is worked out here, so a browser can only ask about the current one.
import { kv } from '@vercel/kv';
import { getUser } from '../../../lib/auth';
import { weekKey } from '../../../lib/scoreboard';

const KINDS = {
  'queue-clear': () => ({ key: `egg:queue-clear:${weekKey()}`, ttl: 60 * 60 * 24 * 14 }),
  birthday: () => ({ key: `egg:birthday:${new Date().getUTCFullYear()}`, ttl: 60 * 60 * 24 * 14 }),
  christmas: () => {
    const now = new Date();
    const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    return { key: `egg:christmas:${year}`, ttl: 60 * 60 * 24 * 60 };
  },
};

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const make = KINDS[req.body?.kind];
  if (!make) return res.status(400).json({ error: 'Unknown egg' });
  try {
    const { key, ttl } = make();
    const added = await kv.sadd(key, user.email.toLowerCase());
    await kv.expire(key, ttl);
    return res.status(200).json({ first: added === 1 });
  } catch {
    return res.status(200).json({ first: false }); // never show an egg twice because storage hiccuped
  }
}
