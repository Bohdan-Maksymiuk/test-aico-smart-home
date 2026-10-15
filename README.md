# Smart Home Device Manager

## Running the app

Requires Docker with Compose v2.

```sh
docker compose up --build
```

Open <http://localhost:3000>. On startup the app applies database migrations and, if there are no Devices yet, seeds a few demo ones. Reset all data with `docker compose down -v`.

## Local development

Requires Node 22 and Docker.

```sh
npm install
docker compose up -d db     # Postgres only
cp .env.example .env        # DATABASE_URL for the composed db
npm run dev                 # API on :3000 (tsx watch), web on :5173 (Vite, proxies /api)
```

### Layout

```text
src/shared   Zod schemas and types for the API contract, used by both server and web
src/server   Express app, routes, Drizzle schema and queries, error handling
src/web      React SPA: devices/ (everything about Devices) and ui/ (shadcn components)
drizzle/     Generated SQL migrations
```

## Technology choices

- **TypeScript end to end, one package.** The API contract lives in `src/shared` as Zod schemas; the server validates requests with them and the web app uses the inferred types, so the two cannot drift. At scale, I would consider a monorepo and plan schema changes with compatibility across deployed versions in mind.
- **Express 5.** Small and well known; enough for this feature.
- **PostgreSQL + Drizzle.** One `devices` table with a JSONB `state` column, because the shape of State depends on the Device Type. Drizzle stays close to SQL and generates the migrations.
- **React + Vite + TanStack Query, Tailwind + shadcn/ui.** TanStack Query owns server state and makes optimistic updates with rollback simple; shadcn/ui provides accessible primitives (Dialog, Switch, Slider) without a heavy component library.
- **Tests at the HTTP seam.** API tests send real requests with supertest against an in-process Postgres (PGlite), so they need no Docker and exercise the same SQL as production.

## Key decisions and assumptions

- **Single household, no authentication.** The app assumes one trusted household on a trusted network.
- **State as JSONB, validated per Type in the API.** State as JSONB. Lights and thermostats have different state fields. JSONB stores both in the devices table, and a PATCH updates the supplied fields in one SQL statement. If other processes begin writing device state, add a PostgreSQL CHECK constraint to enforce the fields allowed for each device type.
- **Partial State updates, last write wins.** A PATCH merges only the fields it sends (`state = state || $patch` in a single `UPDATE`), so two tabs changing _different_ settings of a Device both keep their change. Two tabs changing the _same_ setting: the later wins, which is acceptable for a light switch.
- **Device Type is immutable.** Its State shape depends on it; turning a Light into a Thermostat is delete + create.
- **Name is required, Room is optional free text**, not an entity. Devices are listed sorted by Room.
- **Hard delete.** There is nothing that references a Device yet, so there is nothing to retain.
- **Optimistic UI for controls only.** Toggles and sliders update instantly and roll back with an error toast if the API rejects the change; create, edit and delete wait for the server.
- **No pagination.** A household has tens of Devices.
- **No memoisation in React.** In general, it adds more boilerplate and complexity to the code. At this scale it makes no tangible imrovement, if needs be - problem is solved by React compiler.

## What I paid attention to

- **Type safety:** shared contract with runtime validation
- **Error handling:** think about error path as well as success
- **Logging:** log startup failures and unexpected server errors
- **UX:** app should feel fast for user with a visual feedback when something goes wrong

## With more time

- Separate request validation errors from errors found while reading database rows. A malformed row should produce a server error, not a 422 that blames the request.
- **Households and authentication.** Add a `households` table, a `household_id` foreign key on Devices, and scope every query by the caller's Household; a Device in another Household is a 404, not a 403.
- **Readings and real-time updates.** Devices report Readings (e.g. current temperature) that are stored separately from State in a time-series store, and the UI receives changes pushed over Server-Sent Events or WebSockets instead of refetching.
- **Stronger database integrity.** `CHECK` constraints on the JSONB State fields, or a table per Device Type once there are more Types or writers other than this API.
- **Optimistic concurrency** handle case of simulranious state writes
- **Feature-Sliced Design** for the web app once it has more than one page.
- **Standalone migrations** migrations should be a seperate process; it shouldn't run on every server start
- **Rate limiting** prevent abuse of the server endpoints; those could be genuine attacks/ frontend bugs

## Deployment

On AWS I would:

- Serve the **web app from S3 + CloudFront**, routing `/api/*` to the API so the browser stays on one origin.
- Run the **API on Lambda behind API Gateway** (wrapping the Express app with `serverless-http`)
- Use **RDS for PostgreSQL** in private subnets, with credentials in Secrets Manager.
- Run **migrations as a separate deploy step** in CI instead of at app startup, and turn off the demo seed.
