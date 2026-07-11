# CPI Deployer - Supabase + Render Setup

## 1) Supabase setup

1. Open Supabase SQL editor and run [supabase/schema.sql](supabase/schema.sql).
2. In Authentication -> Providers, enable:
   - Email
   - Google
   - Azure (Microsoft)
3. In Authentication -> URL Configuration, add:
   - Local: `http://localhost:3000`
   - Render frontend URL: `https://cpideployer-web.onrender.com` (or your final URL)
4. Keep these values ready:
   - Project URL
   - anon public key
   - service role key

## 2) Backend local env

Copy [backend/.env.example](backend/.env.example) to `.env` and fill values.

Required variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENCRYPTION_KEY` (long random string)
- `CORS_ORIGIN` (frontend URL)

## 3) Frontend local env

Copy [frontend/.env.example](frontend/.env.example) to `.env` and fill values.

Required variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` (empty in local, API proxied by Vite)

## 4) Render monorepo deploy

This repo includes [render.yaml](render.yaml) with two services:
- `cpideployer-api` (Node web service from `backend`)
- `cpideployer-web` (static site from `frontend`)

Steps:
1. Push repo to GitHub.
2. In Render, create Blueprint from repo root.
3. Render reads [render.yaml](render.yaml) and provisions both services.
4. Set secret env values in Render dashboard:
   - API: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENCRYPTION_KEY`, `CORS_ORIGIN`
   - WEB: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`

## 5) Data model and security summary

- Auth: Supabase Auth (email/password + OAuth)
- Tenant model: users belong to organizations via `organization_members`
- Shared resources by organization:
  - `environments` (service key encrypted server-side)
  - `presets`
- Audit trail:
  - `audit_logs`
- Roles:
  - `owner`, `admin`, `member`
- Backoffice:
  - list members
  - change member role
  - inspect audit logs

## 6) API summary (new)

Base path: `/api/v1`

- `GET /auth/me`
- `POST /auth/bootstrap`
- `GET/POST/PUT/DELETE /environments`
- `GET/POST/PUT/DELETE /presets`
- `GET /admin/members`
- `PATCH /admin/members/:id/role`
- `GET /audit`

All protected endpoints require:
- `Authorization: Bearer <supabase access token>`
- `x-org-id: <organization id>`
