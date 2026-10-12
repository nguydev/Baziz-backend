import { Router, type Request, type Response } from 'express';
import env from '../config/env';
import { getMetrics, getMetricsContentType } from '../config/metrics';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  if (!env.METRICS_ENABLED) {
    res.status(404).json({ success: false, message: 'Metrics disabled' });
    return;
  }

  res.set('Content-Type', getMetricsContentType());
  res.end(await getMetrics());
});

export default router;
