**EngMasterAI — Project Overview**

**Purpose:** concise onboarding document for an automated agent to understand the workspace, how to run the system, and where key responsibilities live.

**Repo layout**

- **Backend:** engmasterai-backend — NestJS API, Prisma schema, auth, Cloudinary, Redis integration.
- **Frontend:** engmasterai-frontend — React + Vite client, routes for public/auth/user/admin pages, integrates with backend APIs and Google GenAI client.

**Quick Start (local)**

- **Backend** (from `engmasterai-backend`):

```bash
cd engmasterai-backend
npm install
npm run start:dev
```

- **Frontend** (from `engmasterai-frontend`):

```bash
cd engmasterai-frontend
npm install
npm run dev
```

**Environment variables (examples)**

- Backend minimal `.env` keys (place in `engmasterai-backend/.env`):

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
PORT=3000
FRONTEND_URL=http://localhost:5174
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

- Frontend minimal `.env` keys (if used by frontend):

```env
VITE_API_BASE_URL=http://localhost:3000
GEMINI_API_KEY=your_google_genai_key
```

**Backend — summary**

- **Framework:** `NestJS` with modules in `src/`.
- **Entry point:** [engmasterai-backend/src/main.ts](engmasterai-backend/src/main.ts#L1) — creates app, enables CORS using `FRONTEND_URL`, sets `ValidationPipe`.
- **Root module:** [engmasterai-backend/src/app.module.ts](engmasterai-backend/src/app.module.ts#L1) — imports `PrismaModule`, `SharedModule`, `AuthModule`, `UserModule`.
- **Auth:** JWT + Passport. See `engmasterai-backend/src/auth` for controllers, `jwt.strategy.ts`, guards, DTOs and `auth.service.ts` for flows.
- **Database:** Prisma (PostgreSQL). Schema at [engmasterai-backend/prisma/schema.prisma](engmasterai-backend/prisma/schema.prisma#L1) — models: `User`, `Course`, `Lesson`, `LessonTask`, `Question`, `LessonTaskProgress`, `Vocabulary`, `LessonVocabulary`.
- **Media/storage:** Cloudinary provider/service in `src/shared/providers` and `src/shared/services`.
- **Caching:** Redis client via `ioredis` (`@nestjs-modules/ioredis`).
- **Scripts:** `npm run start:dev`, `npm run build`, `npm run test`, `npm run test:e2e` (see package.json).

**Frontend — summary**

- **Framework:** React (TypeScript) + Vite.
- **Entry:** [engmasterai-frontend/index.tsx](engmasterai-frontend/index.tsx#L1) mounts `App`.
- **Routing:** [engmasterai-frontend/App.tsx](engmasterai-frontend/App.tsx#L1) — routes for `/`, `/login`, `/register`, `/home`, `/admin`, `/profile`, `/security`.
- **Components:** organized under `components/` (admin, auth, shared, user). Key pages: `HomePage`, `UserHome`, `AdminDashboard`, `ProfilePage`.
- **Services:** API wrappers in `services/` — `authService.ts`, `userService.ts`, `geminiService.ts` (GenAI integration).
- **Dependencies of note:** `@google/genai` for generative features; `react-router-dom` for routing.

**Database & data model highlights**

- Users have `role` (enum `USER` | `ADMIN`), `totalPoints`, `level`, `avatarUrl`.
- Courses contain Lessons; Lessons contain LessonTasks and Vocabularies; `LessonTaskProgress` tracks per-user progress and scores.

**Key files (start here)**

- Backend entry: [engmasterai-backend/src/main.ts](engmasterai-backend/src/main.ts#L1)
- Backend modules: [engmasterai-backend/src/app.module.ts](engmasterai-backend/src/app.module.ts#L1)
- Prisma schema: [engmasterai-backend/prisma/schema.prisma](engmasterai-backend/prisma/schema.prisma#L1)
- Frontend entry: [engmasterai-frontend/index.tsx](engmasterai-frontend/index.tsx#L1)
- Frontend routes: [engmasterai-frontend/App.tsx](engmasterai-frontend/App.tsx#L1)
- Frontend services: [engmasterai-frontend/services/authService.ts](engmasterai-frontend/services/authService.ts#L1)

**Run & test commands**

- Backend:

```bash
cd engmasterai-backend
npm install
npm run start:dev   # development
npm run build       # compile to dist
npm run test        # run unit tests
```

- Frontend:

```bash
cd engmasterai-frontend
npm install
npm run dev
npm run build
npm run preview
```

**Common troubleshooting & notes for an agent**

- Ensure `DATABASE_URL` points to a reachable Postgres instance and run Prisma migrations if needed (Prisma CLI present in backend).
- CORS: backend reads `FRONTEND_URL` from env; if frontend dev runs on a different port update that var.
- Secrets: `JWT_SECRET`, Cloudinary creds, and `GEMINI_API_KEY` must be provided by the operator — never commit them.

**Next actions an agent could take**

- Add `engmasterai-backend/.env.example` and `engmasterai-frontend/.env.example` (I can generate these).
- Run backend tests and report failures.
- Validate frontend `authService` uses `VITE_API_BASE_URL` and matches backend routes.

If you want, I can now generate `.env.example` files and a top-level `README.md` with the same content.
