import { getUser } from '../../lib/auth';
import { getYearInReview } from '../../lib/scoreboard';

export default async function handler(req, res) {
  if (!(await getUser(req))) return res.status(401).json({ error: 'Unauthorised' });
  const now = new Date();
  // Early January still reviews the year just finished
  const year = Number(req.query.year) || (now.getMonth() === 0 && now.getDate() <= 6 ? now.getFullYear() - 1 : now.getFullYear());
  try { return res.status(200).json(await getYearInReview(year)); }
  catch (err) { return res.status(500).json({ error: err.message }); }
}
