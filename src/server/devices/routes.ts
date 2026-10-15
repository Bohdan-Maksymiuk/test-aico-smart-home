import {
  API_BASE_PATH,
  createDeviceInputSchema,
  updateDeviceInputSchema,
} from '@shared/index';
import { Router } from 'express';
import type { Db } from '../db/client';
import {
  createDevice,
  deleteDevice,
  getDevice,
  getDeviceType,
  listDevices,
  updateDevice,
} from './queries';

export function deviceRouter(db: Db): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const device = await createDevice(
      db,
      createDeviceInputSchema.parse(req.body),
    );

    res
      .status(201)
      .location(`${API_BASE_PATH}/devices/${device.id}`)
      .json(device);
  });

  router.get('/', async (_req, res) => res.json(await listDevices(db)));

  router.get('/:id', async (req, res) =>
    res.json(await getDevice(db, req.params.id)),
  );

  router.patch('/:id', async (req, res) => {
    const type = await getDeviceType(db, req.params.id);
    const input = updateDeviceInputSchema(type).parse(req.body);

    res.json(await updateDevice(db, req.params.id, input));
  });

  router.delete('/:id', async (req, res) => {
    await deleteDevice(db, req.params.id);

    res.status(204).end();
  });

  return router;
}
