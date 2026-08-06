# GRE Vocab Backend

Minimal backend for the Expo GRE vocabulary app.

## Run

```sh
npm run backend:migrate
npm run backend:seed
npm run backend:start
```

The default SQLite database is `data/app.db`. Override it with `DB_PATH=/path/to/app.db`.

For App Store production, migrate the database to Neon Postgres and deploy the API publicly. See `docs/neon-postgres-plan.md`.

## Admin

```sh
npm run backend:create-admin -- admin@example.com password123 Admin
```

Admin accounts are created from the CLI only. Public registration always creates normal users.

Open the minimal word admin UI at:

```txt
http://localhost:3001/admin
```

## Auth

All protected APIs use:

```http
Authorization: Bearer <token>
```

Tokens are returned by register/login. Only token hashes are stored in `sessions`.

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `PATCH /api/me/profile`
- `PATCH /api/settings`
- `GET /api/words`
- `GET /api/progress`
- `PUT /api/progress/:wordId`
- `DELETE /api/progress/:wordId`
- `GET /api/admin/words`
- `POST /api/admin/words`
- `PATCH /api/admin/words/:id`
- `DELETE /api/admin/words/:id`

## Data Decisions

- Users are soft-deletable via `users.deleted_at`, though delete account is not exposed yet.
- Words are soft-deleted through `is_active = 0` and `deleted_at`, because user progress may reference them.
- Progress rows are hard-deleted when a user clears one word's progress.
- Avatar upload storage is not implemented yet; profile stores `avatar_url` for future file storage/CDN integration.
- Goals are stored as `goal_text` now. `goal_type` and `goal_json` are reserved for structured goals later.
