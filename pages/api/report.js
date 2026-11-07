// Monthly client status report for one project
import { getUser } from '../../lib/auth';
import { buildMonthlyReport } from '../../lib/report';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!(await getUser(req))) return res.status(401).json({ error: 'Unauthorised' });
  const { project, name, month, spelling, budget } = req.query;
  if (!project || !name || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) {
    return res.status(400).json({ error: 'Need a project and a month (YYYY-MM)' });
  }
  try {
    return res.status(200).json(await buildMonthlyReport({
      projectId: String(project), projectName: String(name).slice(0, 80), month: String(month),
      spelling: spelling === 'us' ? 'us' : 'ca', includeBudget: budget !== '0',
    }));
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
