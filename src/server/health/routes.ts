import { Router } from 'express';
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { HttpError } from '../http-error';

export function healthRouter(db: Db): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      await db.execute(sql`select 1`);
    } catch {
      throw new HttpError(503, 'The database is unavailable.');
    }
    res.json({ status: 'ok' });
  });

  return router;
}
