# Brilliant Metal Works — Project Workflow System

Internal tool for **Brilliant Metal Works** (Rwanda): client management, project pipeline, site surveys, cost estimation, quotations, and PDF export for balcony and staircase metalwork. Currency: **RWF**.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (PostgreSQL)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy the example file and fill in your Supabase credentials (Project Settings → API):

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `NEXT_PUBLIC_REQUIRE_SUPABASE` | No | Set to `true` to disable demo fallback on the dashboard when the database is unreachable |

### 3. Database schema

In the Supabase SQL editor, run scripts **in this order** on a fresh database:

1. [`supabase/schema.sql`](supabase/schema.sql) — core tables (clients, projects, balcony surveys, estimations, quotations)
2. [`supabase/add_prices_table.sql`](supabase/add_prices_table.sql) — material price list
3. [`supabase/add_new_columns.sql`](supabase/add_new_columns.sql) — extended survey / estimation fields
4. [`supabase/add_pricing_columns.sql`](supabase/add_pricing_columns.sql) — margin, contingency, quoted price
5. [`supabase/add_constraints.sql`](supabase/add_constraints.sql) — additional constraints
6. [`supabase/add_glass_system_bar_profile.sql`](supabase/add_glass_system_bar_profile.sql) — glass systems and bar profiles
7. [`supabase/add_panel_layout.sql`](supabase/add_panel_layout.sql) — panel layout options
8. [`supabase/add_multi_area.sql`](supabase/add_multi_area.sql) — multiple balcony areas per project + staircase tables

If you already ran an older schema, run only the migrations you have not applied yet (check for existing columns/tables before re-running).

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the home page redirects to the dashboard.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |

## Project structure

```
src/app/          Routes, server actions, PDF API routes
src/components/   UI and feature components
src/lib/          Estimation engines, Supabase clients
src/types/        Shared TypeScript types
supabase/         SQL schema and migrations
grasshopper/      Rhino/Grasshopper Python scripts + HOW_TO_USE.md
```

## Features

- **Dashboard** — project list and pipeline by status
- **Clients** — contact directory linked to projects
- **Balcony projects** — multi-area site survey, section optimizer, BOM, quotation PDFs, Grasshopper JSON export
- **Staircase projects** — single survey flow with matching exports
- **Material prices** — admin price list used by estimation on save

Other project types (gate, facade, railing, etc.) can be created but do not yet have dedicated estimators.

## Rhino / Grasshopper

See [`grasshopper/HOW_TO_USE.md`](grasshopper/HOW_TO_USE.md). Export JSON from a project’s **Export to Rhino** button.

## Further documentation

- [`Brilliant_MW_System_Guide.pdf`](Brilliant_MW_System_Guide.pdf) — system guide (if present in repo root)

## Deploy notes

This app has **no built-in authentication**; it is intended for a trusted internal team. If you deploy publicly, use host-level protection (e.g. Vercel deployment protection) and consider enabling Supabase Row Level Security before exposing the anon key.
