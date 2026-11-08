# zyk-dyna-admin

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Hono, TRPC, and more.

## Product Features

- **Sign up** with username + email + password on `/login` (username and email are case-insensitive and unique; you are signed in and sent to `/dashboard` on success)
- **Sign in** with either username or email + password, and **sign out** from the header user menu
- **Protected dashboard**: visiting `/dashboard` while signed out redirects to `/login`; visiting `/login` while signed in redirects to `/dashboard`
- **GitHub user lookup** on `/dashboard`: enter a GitHub username to see the public profile (avatar, name, bio, company, location, blog, followers / following, public repos), with clear messages for invalid usernames, users not found, rate limits and upstream errors
- **Person management** on `/persons` (header link「人员管理」, sign-in required): add, edit and delete people (name, employee number, phone, email, department, position, active / inactive status, remark). The list searches by name or employee number (case-insensitive), filters by status and pages 20 rows at a time. Employee numbers are stored upper-case and must be unique; deleting asks for confirmation and removes the record permanently. Every signed-in user can manage all people (no roles yet).

Requirements and acceptance criteria live in [`docs/需求.md`](docs/需求.md) and [`specs/`](specs/README.md).

## Tech Stack


- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **tRPC** - End-to-end type-safe APIs
- **Node.js** - Runtime environment
- **Prisma** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system
- **Biome** - Linting and formatting

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

Generate the Prisma client before development, typechecking, or building, including in CI and deployment builds. Run this again after changing the Prisma schema:

```bash
pnpm run db:generate
```

This project uses PostgreSQL with Prisma.

1. Make sure you have a PostgreSQL database set up.
2. Create `apps/server/.env` with the two values that have no default:

   ```bash
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DB_NAME
   BETTER_AUTH_SECRET=   # generate with: openssl rand -base64 32
   ```

   Everything else (server / web / native URLs) defaults to localhost in each app's `.env.schema`; override it in that app's `.env` only when needed.

   Optionally set `GITHUB_TOKEN` in `apps/server/.env` to raise the GitHub API rate limit for the user lookup from 60 to 5000 requests per hour. Without it the server calls GitHub anonymously.

3. Apply the migrations in `packages/db/prisma/migrations` to your database:

```bash
pnpm run db:migrate
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
From `apps/native`, run the `ios` script for iOS or the `android` script for Android to build and launch the app. See [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) for device setup.
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@zyk-dyna-admin/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `pnpm run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform. Schemas carry localhost defaults for non-secret URLs, so locally only `DATABASE_URL` and `BETTER_AUTH_SECRET` need to be set.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

Run standalone Node/Bun tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Testing

- `pnpm run test`: Vitest unit / integration tests (`*.test.ts` in `apps/web` and `packages/api`)
- `pnpm run test:e2e`: Playwright end-to-end tests in `apps/web/e2e`. Playwright starts the server (:3000) and web app (:3001) itself, so stop any running dev servers first.
  - E2E uses a separate PostgreSQL database named `zyk_dyna_admin_test`: the connection string is your `DATABASE_URL` with only the database name replaced. It is migrated and **all business tables are emptied** before each run, so never point it at data you want to keep.
  - Install the browser once before the first run: `pnpm --dir apps/web exec playwright install chromium`
  - GitHub API calls are mocked in E2E; no real GitHub requests are made.
- `pnpm --dir packages/api run test:smoke`: optional smoke test against the real GitHub API (`*.smoke.ts`, run manually; not part of `pnpm run test`)

## Git Hooks and Formatting

- Run checks: `pnpm run check`

## Project Structure

```
zyk-dyna-admin/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   ├── native/      # Mobile application (React Native, Expo)
│   └── server/      # Backend API (Hono, TRPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run dev:native`: Start the React Native/Expo development server
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
- `pnpm run check`: Run Biome formatting and linting
- `pnpm run fix`: Auto-fix Biome formatting and lint issues
- `pnpm run test`: Run unit / integration tests (Vitest)
- `pnpm run test:e2e`: Run Web end-to-end tests (Playwright)

## Deployment (Cloudflare, work in progress)

`apps/web` includes OpenNext for Cloudflare config (`open-next.config.ts`, `wrangler.jsonc`, with `@opennextjs/cloudflare` and `wrangler` installed). Build output goes to `.open-next/` and `.wrangler/`, both git-ignored. No build / preview / deploy scripts have been added yet.

## Better Auth Schema Generation

After changing auth plugins or schema options, run `pnpm run auth:generate` from the project root. The script runs the Better Auth CLI through `varlock run` from the owning app directory, loading the auth instance from `src/services.ts`. Review the schema changes, then use your ORM's migration workflow to apply them.
