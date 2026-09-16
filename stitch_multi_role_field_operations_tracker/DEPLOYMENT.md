# KEA Operations Deployment

## Render

1. Push this project to a Git repository.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render reads `render.yaml`, provisions PostgreSQL, runs `npm install && npm run db:migrate`, and starts `npm start`.
4. Open the generated web service URL. The root URL provides the web directory for all five role workspaces.

The service requires `DATABASE_URL`. Do not commit `.env` or database credentials.

## Local PostgreSQL

Set `DATABASE_URL` from `.env.example`, then run:

```powershell
npm install
npm run db:migrate
npm start
```

The database is the source of truth for requisitions, locks, metrics, loans, and audit records. The former JSON store is no longer used.

## Seeded demo credentials

These accounts are created by the migration for testing and should be rotated before production use:

| Role | Login | Password |
| --- | --- | --- |
| Super Admin | `admin@kea.com` | `Admin#2026!` |
| Supervisor | `okon@kea.com` | `Davis#2026!` |
| VSR | `sulaimon@kea.com` | `Sulaimon#2026!` |
| Merchandiser | `kenji@kea.com` | `Kenji#2026!` |

Direct dashboard links require a valid session and redirect to the sign-in gateway when opened without one.
