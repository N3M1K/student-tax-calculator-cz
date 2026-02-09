# Student OSVČ Tax Guard (student-tax-calculator-cz)

A small Bun + Elysia TypeScript app that helps students who are self-employed (OSVČ) track invoices and watch the social insurance limit. It provides a lightweight dashboard (Tailwind + HTMX + Alpine) and a tiny database (Turso or local file) for invoices and settings.

- Default port: 3000
- Frontend: src/views/index.html (served by Elysia)
- DB: @libsql/client (Turso-compatible) or local SQLite-like file (file:taxes.db)

---

## Quick start

Prerequisites:
- Bun installed (https://bun.sh)

Clone and run:

```bash
git clone https://github.com/n3m1k/student-tax-calculator-cz.git
cd student-tax-calculator-cz

# install dependencies
bun install

# start development server (hot reload)
bun run dev
```

Open http://localhost:3000/ in your browser.

---

## What it does (high level)

- Add and remove invoices via a simple form or API.
- Computes:
  - Příjmy (Revenue): sum of invoice amounts.
  - Náklady (Expenses): calculated as 60% of revenue (flat).
  - Zisk (Profit): revenue - expenses (i.e., revenue * 0.4).
  - Zdravotní pojištění (Health insurance estimate): Math.ceil(profit * 0.5 * 0.135).
  - Sociální pojištění (Social security): checks profit against a configurable limit (default 105000 CZK).
- UI updates use HTMX to swap the document body for simple, atomic updates.

---

## Routes / API

The app serves HTML and also accepts programmatic requests.

- GET /
  - Returns the dashboard HTML.

- POST /invoices
  - Add a new invoice.
  - Accepts JSON or form-encoded bodies with: date, amount, client_name.
  - Example (form-encoded):
    ```bash
    curl -X POST http://localhost:3000/invoices \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "date=2026-01-02&amount=5000&client_name=Acme"
    ```
  - Example (JSON):
    ```bash
    curl -X POST http://localhost:3000/invoices \
      -H "Content-Type: application/json" \
      -d '{"date":"2026-01-02","amount":"5000","client_name":"Acme"}'
    ```

- DELETE /invoices/:id
  - Deletes an invoice by id.
  - Example:
    ```bash
    curl -X DELETE http://localhost:3000/invoices/1
    ```

- POST /settings
  - Update the social insurance threshold.
  - Accepts form or JSON body with `social_limit_amount`.
  - Example:
    ```bash
    curl -X POST http://localhost:3000/settings \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "social_limit_amount=120000"
    ```

Notes:
- The frontend uses HTMX forms that submit to these endpoints and then swap the document body (hx-target="body" hx-swap="outerHTML") to display the updated dashboard.

---

## Database & schema

The DB is created/initialized automatically on server start by src/db.ts.

Tables (simplified):

- invoices
  - id INTEGER PRIMARY KEY AUTOINCREMENT
  - date TEXT NOT NULL
  - amount INTEGER NOT NULL
  - client_name TEXT NOT NULL
  - is_paid BOOLEAN DEFAULT 0

- settings
  - key TEXT PRIMARY KEY
  - value TEXT NOT NULL

Seeding:
- On first run, the app seeds `settings` with key `social_limit_amount = 105000` (105,000 CZK default threshold).

Default DB connection (see src/db.ts):
- Uses environment variable TURSO_DATABASE_URL; if not set, falls back to `file:taxes.db` (a local file).
- If you want to connect to Turso (or another @libsql-compatible service), set:
  - TURSO_DATABASE_URL (connection URL)
  - TURSO_AUTH_TOKEN (optional auth token)

---

## Configuration (env vars)

- TURSO_DATABASE_URL
  - e.g. `file:taxes.db` (default) or a Turso URL.
- TURSO_AUTH_TOKEN
  - optional, used if connecting to a hosted @libsql database.

You can run locally without setting any environment variables and the project will use `file:taxes.db` located in the repository root.

---

## Implementation details & assumptions

- The app currently assumes invoice amounts entered are considered "revenue" for the simple dashboard (see comments in src/index.ts). The code sums all rows in the invoices table.
- Expenses are a flat 60% of revenue (as a simplified rule).
- Health insurance is estimated as: ceil(profit * 0.5 * 0.135).
- Social security check shows whether profit exceeds the configured `social_limit_amount`. Default is 105000 CZK, which is seeded automatically.
- UI uses:
  - Tailwind CSS (CDN)
  - HTMX for form requests and partial/full swaps
  - Alpine.js for small reactive UI elements

---

## Troubleshooting & tips

- Bun: make sure your Bun version is up-to-date if you run into runtime issues. Run `bun -v`.
- Database file:
  - If using the default `file:taxes.db`, the DB file appears next to the project and persists across runs.
  - Delete `taxes.db` if you want to reset the DB (it will be re-created and seeded on next start).
- If the app doesn't start or routes are missing:
  - Confirm dependencies installed with `bun install`.
  - Check logs printed to the console on startup. The server prints `Student Tax Guard is running at ...`.
- If you want to run on a different port, modify the listen call in src/index.ts (currently .listen(3000)).

---

## Development notes

- Entry point: src/index.ts — Bun runs TypeScript directly in development mode (`bun run --watch src/index.ts`).
- TypeScript config is in tsconfig.json (strict, Bun types included).
- There are no unit tests included yet.
- To add features:
  - Use Elysia to add routes.
  - Use @libsql client for DB interactions (db.execute).
  - The UI can be extended in src/views/index.html.

---

## Contribution

Contributions are welcome! Open an issue or a PR with a clear description of the change. Suggestions:
- Add proper invoice "paid" flag handling and filtering.
- Add authentication (if exposing to the internet).
- Improve calculations to reflect real-world tax rules.

---

## License

This repository does not include an explicit license file. Add a LICENSE file if you want to set a license.

---

If you want, I can:
- Add a Dockerfile for consistent deployment.
- Add a simple migration or export command to dump the DB to JSON/CSV.
- Add tests and CI examples for release flows.
