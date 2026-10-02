import { getRequestBudget, withRequestBudget } from '../utils/requestBudget.js';

export function serverlessRequestBudget(req, res, next) {
  if (!process.env.VERCEL || getRequestBudget()) return next();
  // Express next() returns before the route finishes. Keep the context's timer
  // alive until the response finishes when this app is used without its wrapper.
  return withRequestBudget(() => new Promise((resolve) => {
    const finish = () => {
      res.removeListener('finish', finish);
      res.removeListener('close', finish);
      resolve();
    };
    res.once('finish', finish);
    res.once('close', finish);
    next();
  })).catch(next);
}
