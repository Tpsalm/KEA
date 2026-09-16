# KEA Operations Deployment

## Render

1. Push this project to a Git repository.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render reads `render.yaml`, provisions PostgreSQL, runs `npm install && npm run db:migrate`, and starts `npm start`.
4. Open the generated web service URL and navigate to `/super_admin_console_mobile_field_command/code.html`.

The service requires `DATABASE_URL`. Do not commit `.env` or database credentials.

## Local PostgreSQL

Set `DATABASE_URL` from `.env.example`, then run:

```powershell
npm install
npm run db:migrate
npm start
```

The database is the source of truth for requisitions, locks, metrics, loans, and audit records. The former JSON store is no longer used.
