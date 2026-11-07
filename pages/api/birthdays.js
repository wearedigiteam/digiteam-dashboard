// Everyone signed in can read birthdays (month and day); only admins can change them.
import { getUser, isAdmin } from '../../lib/auth';
import { getBirthdays, saveBirthdays } from '../../lib/birthdays';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method === 'GET') return res.status(200).json({ birthdays: await getBirthdays() });
  if (req.method === 'POST') {
    if (!isAdmin(user)) return res.status(403).json({ error: 'Admin access only' });
    try { return res.status(200).json({ ok: true, birthdays: await saveBirthdays(req.body?.birthdays) }); }
    catch (err) { return res.status(400).json({ error: err.message }); }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
