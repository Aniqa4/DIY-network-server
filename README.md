# DIY Network — Express API

Backend for the DIY Network client, built with **TypeScript**, **Express 5**, **PostgreSQL**, and **Prisma**.

## Stack

| Concern          | Choice                                              |
| ---------------- | --------------------------------------------------- |
| Language         | TypeScript (strict mode; tsx for dev, tsc for prod) |
| Framework        | Express 5 (async handlers, no wrapper needed)       |
| Database         | PostgreSQL via Prisma ORM                           |
| Auth             | JWT (Bearer) with logout revocation via `jti`       |
| Validation       | zod (strict schemas, Nest-style error payloads)     |
| Image hosting    | Cloudinary (multer memory storage, streamed upload) |
| Email            | nodemailer; logs the link to console if SMTP is not configured |
| Google OAuth     | Plain `fetch` against Google's OAuth endpoints      |

## Getting started

```bash
npm install
cp .env.example .env        # then fill in the values
npx prisma migrate dev      # creates/updates the database schema
npm run dev                 # http://localhost:5000/api/v1 (tsx watch — restarts on save)
```

For production:

```bash
npm run build               # compiles src/ → dist/ with tsc
npm start                   # runs node dist/index.js
```

If SMTP is not configured (`EMAIL_HOST=replace-me`), verification links are
printed to the server console so you can still verify accounts in development.

## Local database with Docker

For local development, run PostgreSQL in a Docker container so you have a
throwaway database that's isolated from production. (You can instead point
`DATABASE_URL` at a cloud database like Neon — see the comment in `.env`.)

Create the container once:

```bash
docker run --name diy-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=diy_tutorials \
  -p 5433:5432 \
  -d postgres:16
```

Then set `DATABASE_URL` in `.env` to point at it:

```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/diy_tutorials?schema=public"
```

Day-to-day:

```bash
docker start diy-postgres     # start it (after a reboot, etc.)
docker stop diy-postgres      # stop it
docker ps                     # confirm it's running (look for 0.0.0.0:5433->5432)
```

After the container is up for the first time, create the tables:

```bash
npx prisma migrate deploy     # apply existing migrations
```

Open a psql shell inside the container if you need to poke at data
(e.g. to make yourself an admin):

```bash
docker exec -it diy-postgres psql -U postgres -d diy_tutorials
# then, at the prompt:
#   UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
```

## Changing the schema (Prisma migrations)

The database schema lives in [`prisma/schema.prisma`](prisma/schema.prisma).
Whenever you change a model, create a migration so the change is versioned and
reproducible on other machines / production.

**During development** — edit `schema.prisma`, then:

```bash
npx prisma migrate dev --name describe_your_change
```

This does three things: generates a new SQL migration in `prisma/migrations/`,
applies it to your dev database, and regenerates the Prisma Client (the typed
`@prisma/client`). Use a short, descriptive name, e.g.
`--name add_post_tags`.

**If you only changed generated types** (no schema change) or need to
regenerate the client manually:

```bash
npx prisma generate
```

> If `prisma generate` fails on Windows with an `EPERM ... query_engine`
> error, the dev server is holding the engine file open — stop `npm run dev`
> first, then run it again.

**Applying migrations elsewhere** (production, a teammate's machine, CI) —
never use `migrate dev` there; it can reset data. Use:

```bash
npx prisma migrate deploy      # applies pending migrations, no prompts
```

This is exactly what the Docker image runs on boot (`start:prod`), so deploys
migrate themselves.

**Useful checks:**

```bash
npx prisma migrate status      # are all migrations applied?
npx prisma studio              # browse/edit data in a local GUI
```

> Commit the generated `prisma/migrations/` folder to Git — migrations are
> part of the source. Never hand-edit an already-applied migration; make a new
> one instead.

## Project structure

```
src/
  index.ts                  # entry point — connects Prisma, starts Express
  app.ts                    # express app: CORS, JSON parsing, routes, error handler
  types.ts                  # AuthPayload + Express.Request `user` augmentation
  config/env.ts             # loads .env, fails fast on missing critical vars
  lib/
    prisma.ts               # shared PrismaClient
    cloudinary.ts           # buffer → Cloudinary stream upload
    email.ts                # verification emails (console fallback in dev)
  middleware/
    auth.ts                 # requireAuth — verifies JWT + revocation check
    error.ts                # 404 + global error handler (Nest-shaped JSON errors)
    upload.ts               # multer config (memory storage, 5 MB, images only)
    validate.ts             # zod body validation
  validators/schemas.ts     # zod schemas (mirror the NestJS DTOs)
  services/
    notifications.service.ts  # aggregated notification buckets
  controllers/              # one per domain
  routes/                   # one router per domain, mounted in routes/index.ts
```

## API

Base URL: `http://localhost:5000/api/v1`. Protected routes need an
`Authorization: Bearer <accessToken>` header.

Interactive docs (Swagger UI): **`http://localhost:5000/api/v1/docs`** — log
in via `POST /auth/login` there, click "Authorize", and paste the
`accessToken` to try out protected endpoints. The raw OpenAPI document is at
`/api/v1/docs.json`.

### Auth

| Method | Path                        | Auth | Description |
| ------ | --------------------------- | ---- | ----------- |
| POST   | `/auth/register`            | –    | `{ email, username, password }` → sends verification email |
| POST   | `/auth/login`               | –    | `{ email, password }` → `{ accessToken }` (requires verified email) |
| GET    | `/auth/verify-email?token=` | –    | Verifies the emailed token |
| POST   | `/auth/resend-verification` | –    | `{ email }` → always responds generically |
| POST   | `/auth/logout`              | ✅   | Revokes the current token (204) |
| GET    | `/auth/google`              | –    | Redirects to Google OAuth |
| GET    | `/auth/google/callback`     | –    | OAuth callback → `{ accessToken }` |

### Users

| Method | Path               | Auth | Description |
| ------ | ------------------ | ---- | ----------- |
| GET    | `/users/me`        | ✅   | Current user's profile (includes email) |
| PATCH  | `/users/me`        | ✅   | `{ username?, bio? }` |
| DELETE | `/users/me`        | ✅   | Delete account (cascades all content, 204) |
| POST   | `/users/me/avatar` | ✅   | multipart, field `avatar` → uploads to Cloudinary |
| GET    | `/users/:id`       | –    | Public profile |

### Posts

| Method | Path              | Auth | Description |
| ------ | ----------------- | ---- | ----------- |
| GET    | `/posts`          | –    | `?category=CROCHET&authorId=xxx` both optional |
| GET    | `/posts/:id`      | –    | Post detail (does not bump views) |
| POST   | `/posts/:id/view` | –    | Increments the view counter → `{ views }` |
| POST   | `/posts`          | ✅   | JSON or multipart (`images` field, up to 5 files). `materials`/`steps` are arrays, or JSON-encoded strings in multipart |
| PATCH  | `/posts/:id`      | ✅   | Owner only |
| DELETE | `/posts/:id`      | ✅   | Owner only (204) |

Categories: `COOKING`, `CRAFTING`, `SEWING`, `CROCHET`, `KNITTING`, `OTHER`.

### Comments, Likes, Saves

| Method | Path               | Auth | Description |
| ------ | ------------------ | ---- | ----------- |
| GET    | `/comments?postId=`| –    | Comments on a post, oldest first |
| POST   | `/comments`        | ✅   | `{ postId, content }` |
| DELETE | `/comments/:id`    | ✅   | Owner only (204) |
| GET    | `/likes/:postId`   | –    | Users who liked a post |
| POST   | `/likes/:postId`   | ✅   | Toggle → `{ liked: boolean }` |
| GET    | `/saves/mine`      | ✅   | Current user's bookmarks |
| POST   | `/saves/:postId`   | ✅   | Toggle → `{ saved: boolean }` |

### Follows, Messages, Notifications

| Method | Path                         | Auth | Description |
| ------ | ---------------------------- | ---- | ----------- |
| POST   | `/follows/:userId`           | ✅   | Toggle → `{ following: boolean }` |
| GET    | `/follows/:userId/followers` | –    | Who follows this user |
| GET    | `/follows/:userId/following` | –    | Who this user follows |
| GET    | `/messages`                  | ✅   | Inbox — latest message per conversation |
| GET    | `/messages/:userId`          | ✅   | Full thread with one user |
| POST   | `/messages`                  | ✅   | `{ receiverId, content }` |
| GET    | `/notifications`             | ✅   | Aggregated ("Alice and 3 others liked...") with resolved actors |
| PATCH  | `/notifications/:id/read`    | ✅   | Mark one read (204) |
| POST   | `/notifications/read-all`    | ✅   | Mark all read (204) |

### Error format

Errors use the same JSON shape as NestJS, so the client can treat both
servers identically:

```json
{ "statusCode": 404, "message": "Post not found", "error": "Not Found" }
```

Validation failures return `message` as an array of `field: problem` strings.
