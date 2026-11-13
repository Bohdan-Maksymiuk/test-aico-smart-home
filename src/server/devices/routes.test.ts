import { API_BASE_PATH, problemDetailsSchema } from '@shared/index';
import { sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { useHttpHarness } from '../test/http-harness';

const harness = useHttpHarness();
const devices = `${API_BASE_PATH}/devices`;

describe('Devices API', () => {
  it('creates a named Light with default State and Location', async () => {
    const res = await harness
      .http()
      .post(devices)
      .send({ type: 'light', name: 'Desk lamp' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`${devices}/${deviceId(res.body)}`);
    expect(res.body).toMatchObject({
      type: 'light',
      name: 'Desk lamp',
      room: null,
      state: { on: false, brightness: 100 },
    });
  });
  it('rejects missing Name, out-of-range Name, and unknown fields', async () => {
    for (const body of [
      { type: 'light' },
      { type: 'light', name: 'x'.repeat(65) },
      { type: 'light', name: 'A', extra: true },
    ]) {
      const res = await harness.http().post(devices).send(body);
      expect(res.status).toBe(422);
      expect(problemDetailsSchema.parse(res.body)).toMatchObject({
        status: 422,
      });
    }
  });
  it('returns field issues for invalid create and update requests', async () => {
    const created = await create({ type: 'light', name: 'Lamp' });
    const responses = [
      await harness.http().post(devices).send({ type: 'light' }),
      await harness
        .http()
        .patch(`${devices}/${created.id}`)
        .send({
          state: { brightness: 101 },
        }),
    ];
    for (const [response, path] of responses.map(
      (response, index) =>
        [response, index === 0 ? 'name' : 'state.brightness'] as const,
    )) {
      expect(response.status).toBe(422);
      expect(response.headers['content-type']).toMatch(
        /^application\/problem\+json/,
      );
      const problem = problemDetailsSchema.parse(response.body);
      expect(problem).toMatchObject({
        status: 422,
        detail: 'The request is invalid.',
      });
      const issue = problem.issues?.find((item) => item.path === path);
      expect(issue?.message).toBeTruthy();
    }
  });
  it('keeps malformed JSON as a 400 problem', async () => {
    const response = await harness
      .http()
      .post(devices)
      .set('Content-Type', 'application/json')
      .send('{');
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(
      /^application\/problem\+json/,
    );
    expect(problemDetailsSchema.parse(response.body)).toMatchObject({
      status: 400,
      detail: 'The request body is not valid JSON.',
    });
  });
  it('logs invalid persisted state and returns a generic 500 for reads', async () => {
    const created = await create({ type: 'light', name: 'Lamp' });
    await harness
      .db()
      .execute(
        sql`UPDATE devices SET state = '{"on": "invalid", "brightness": 100}'::jsonb WHERE id = ${created.id}`,
      );
    const log = vi.spyOn(harness.logger(), 'error');
    try {
      for (const path of [devices, `${devices}/${created.id}`]) {
        const response = await harness.http().get(path);
        expect(response.status).toBe(500);
        expect(response.headers['content-type']).toMatch(
          /^application\/problem\+json/,
        );
        expect(response.body).toEqual({
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred.',
        });
      }
      expect(log).toHaveBeenCalledTimes(2);
      for (const [entry, message] of log.mock.calls) {
        expect((entry as { err: Error }).err.name).toBe('ZodError');
        expect(message).toBe('Unhandled error');
      }
    } finally {
      log.mockRestore();
    }
  });
  it('lists and gets a Thermostat', async () => {
    const created = await harness
      .http()
      .post(devices)
      .send({ type: 'thermostat', name: 'Heating' });
    expect(created.status).toBe(201);
    expect(created.headers.location).toBe(
      `${devices}/${deviceId(created.body)}`,
    );
    expect(created.body).toMatchObject({
      state: { targetTemp: 21, mode: 'off' },
    });
    expect((await harness.http().get(devices)).body).toEqual([created.body]);
    expect(
      (await harness.http().get(`${devices}/${deviceId(created.body)}`)).body,
    ).toEqual(created.body);
  });
  it('returns 404 for an unknown Device', async () => {
    expect(
      (
        await harness
          .http()
          .get(`${devices}/7f3c2a1e-4b5d-4c6e-8f90-123456789abc`)
      ).status,
    ).toBe(404);
  });
  it('merges State patches and rejects the other Type or type changes', async () => {
    const created = await create({ type: 'light', name: 'Ceiling' });
    await harness
      .http()
      .patch(`${devices}/${created.id}`)
      .send({ state: { on: true } });
    const updated = await harness
      .http()
      .patch(`${devices}/${created.id}`)
      .send({ state: { brightness: 40 } });
    expect(updated.body as unknown).toMatchObject({
      state: { on: true, brightness: 40 },
    });
    expect(
      (
        await harness
          .http()
          .patch(`${devices}/${created.id}`)
          .send({ state: { targetTemp: 20 } })
      ).status,
    ).toBe(422);
    expect(
      (
        await harness
          .http()
          .patch(`${devices}/${created.id}`)
          .send({ type: 'thermostat' })
      ).status,
    ).toBe(422);
  });
  it('updates Name, clears Room, and hard-deletes', async () => {
    const created = await create({
      type: 'light',
      name: 'Ceiling',
      room: 'Kitchen',
    });
    expect(
      (
        await harness
          .http()
          .patch(`${devices}/${created.id}`)
          .send({ name: 'Desk', room: '' })
      ).body,
    ).toMatchObject({ name: 'Desk', room: null });
    expect(
      (await harness.http().delete(`${devices}/${created.id}`)).status,
    ).toBe(204);
    expect((await harness.http().get(`${devices}/${created.id}`)).status).toBe(
      404,
    );
    expect(
      (await harness.http().delete(`${devices}/${created.id}`)).status,
    ).toBe(404);
  });
});

async function create(body: object) {
  const res = await harness.http().post(devices).send(body);
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

function deviceId(body: unknown): string {
  return (body as { id: string }).id;
}
