# BugBoard

BugBoard is a bug and issue tracking system for small software teams, similar to a simplified Jira board. Teams create
projects, add members, report bugs, assign them to developers, move them through a defined workflow, discuss them in
comments, and follow progress on a dashboard and a Kanban board. It is built with the MERN stack (MongoDB, Express,
React, Node.js) and supports three roles - Admin, Developer and Tester - whose permissions are enforced by the backend API.

## Table of contents
1. [Key features](#1-key-features)
2. [Technology stack](#2-technology-stack)
3. [Project structure](#3-project-structure)
4. [Application architecture](#4-application-architecture)
5. [Authentication and role-based access control](#5-authentication-and-role-based-access-control)
6. [Role and permission matrix](#6-role-and-permission-matrix)
7. [Issue status workflow](#7-issue-status-workflow)
8. [Database models and relationships](#8-database-models-and-relationships)
9. [Indexing decisions](#9-indexing-decisions)
10. [API endpoint documentation](#10-api-endpoint-documentation)
11. [AI features](#11-ai-features)
12. [Prerequisites](#12-prerequisites)
13. [Installation and setup](#13-installation-and-setup)
14. [MongoDB configuration](#14-mongodb-configuration)
15. [Environment variables](#15-environment-variables)
16. [Database seeding](#16-database-seeding)
17. [Demo login credentials](#17-demo-login-credentials)
18. [Running the application](#18-running-the-application)
19. [Running automated tests](#19-running-automated-tests)
20. [Building the frontend](#20-building-the-frontend)
21. [Design decisions](#21-design-decisions)
22. [Troubleshooting](#22-troubleshooting)

## 1. Key features
- **Authentication:** registration, login, logout, JWT sessions that persist across page refreshes, bcrypt password hashing.
- **Role-based access control:** Admin, Developer and Tester roles enforced on every API route.
- **Projects:** unique project keys (for example `WEB`), member management, and per-project issue counts.
- **Issue management:** create, view, edit, assign, change status and delete issues, with severity, priority, reporter and
  assignee. Issues are numbered per project (`WEB-1`, `WEB-2`, ...).
- **Search, filter, sort and pagination** on the issue list (status, priority, severity, project, reporter and assignee).
- **Comments and activity history:** every issue has a discussion thread and a timeline of changes written by the server.
- **Dashboard:** summary cards, status and priority charts, recent and recently updated issues, a project filter, and
  clickable cards that open the matching filtered issue list. All figures come from MongoDB.
- **Kanban board:** drag-and-drop status changes that are validated by the server and reverted if rejected.
- **Responsive interface:** desktop, tablet and mobile layouts with a collapsible sidebar drawer, loading, empty and error
  states, notifications, and confirmation dialogs for destructive actions.
- **Optional AI assistance:** similar-issue detection, AI triage suggestions and a description improver on the Create issue
  page. Suggestions are reviewed and accepted by the user; the application works the same with AI switched off
  (see [AI features](#11-ai-features)).

## 2. Technology stack
| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Axios, Tailwind CSS, Lucide React, React Hook Form, Recharts, @hello-pangea/dnd |
| Backend | Node.js, Express (ES modules), Mongoose, JSON Web Tokens, bcryptjs, Zod, Helmet, CORS, express-rate-limit, Google Gen AI SDK (`@google/genai`, optional AI features) |
| Database | MongoDB |
| Testing | Jest and Supertest (backend), Vitest and Testing Library (frontend) |

## 3. Project structure
```
bugboard/
|-- package.json             root scripts (install:all, dev, seed, test, build)
|-- README.md
|-- .gitignore
|-- server/
|   |-- .env.example
|   |-- package.json
|   |-- src/
|   |   |-- config/          environment and database connection
|   |   |-- models/          User, Project, Issue, Comment, Activity
|   |   |-- routes/          URL to controller wiring
|   |   |-- controllers/     HTTP request/response handling
|   |   |-- services/        business rules (auth, projects, issues, dashboard)
|   |   |-- middleware/      JWT auth, validation, rate limiting, error handling
|   |   |-- validators/      Zod request schemas
|   |   |-- utils/           permissions and workflow, errors, constants
|   |   |-- ai/              AI provider layer (Gemini, mock), usage budgets, redaction, local similarity
|   |   `-- seed/            demo data and seed script
|   `-- tests/               Jest integration tests
`-- client/
    |-- .env.example
    |-- package.json
    `-- src/
        |-- api/             Axios modules for each API area
        |-- components/      reusable UI components
        |-- context/         authentication context
        |-- hooks/           custom hooks
        |-- layouts/         application layout (sidebar and navbar)
        |-- pages/           route pages
        `-- utils/           constants and formatting helpers
```

## 4. Application architecture
A request flows through `route -> validation (Zod) -> controller -> service -> Mongoose model`.

- **Routes** only map URLs to controllers and attach middleware.
- **Controllers** translate HTTP requests and responses.
- **Services** contain the business rules: project access checks, the status workflow, assignment rules, comments and
  activity, and dashboard statistics.
- **Middleware** handles JWT verification, role checks, request validation, authentication rate limiting and a single
  centralised error handler that returns every failure in the same JSON shape.

The React client calls the API through small Axios modules, keeps the signed-in user in an authentication context, and
protects pages with route guards. The route guards improve the user experience; the API is the authority and re-checks
every request.

## 5. Authentication and role-based access control
- Users register with a name, email and password. Public registration creates **Tester** or **Developer** accounts only;
  any `role` value sent by a client is ignored. **Admin** accounts are created by the seed script.
- Passwords are hashed with bcryptjs and are never returned by the API.
- Login returns a JWT signed with `JWT_SECRET` and valid for `JWT_EXPIRES_IN`. The client sends it as
  `Authorization: Bearer <token>`.
- On every request the user is loaded from the database, so the role always comes from the database and never from the
  token, and deactivated users lose access immediately.
- Login and registration are rate limited (20 attempts per 15 minutes per IP address).
- Project membership is checked on every project and issue request. A project you do not belong to returns `404`, so its
  existence is not revealed.
- Reporter, status and role values sent by the client when creating an issue are ignored: the reporter is always the
  authenticated user and new issues always start as `Open`.

## 6. Role and permission matrix
All rules are enforced by the backend. "Member" means a member of the project the issue belongs to.

| Action | Admin | Developer | Tester |
|---|:---:|:---:|:---:|
| Register publicly | No (seed script) | Yes | Yes |
| Create and edit projects | Yes | No | No |
| Add or remove project members | Yes | No | No |
| Browse the user directory | Yes | No | No |
| View a project and its issues | If member | If member | If member |
| Create (report) an issue | Yes, in their projects | Yes, in their projects | Yes, in their projects |
| Assign, reassign or unassign an issue | Yes | No | No |
| Edit an issue (title, description, severity, priority) | Yes | Only issues assigned to them | Yes |
| Change issue status | Any valid transition | `Open -> In Progress`, `In Progress -> Testing` and `In Progress -> Open`, only on issues assigned to them | `Testing -> Resolved`, `Resolved -> Closed`, and rejecting a fix or regression back to `In Progress` |
| Delete an issue | Yes | No | Only their own issue while it is `Open` |
| Add comments | Yes | Yes | Yes |
| View the dashboard | Their projects | Their projects, plus their assigned queue | Their projects, plus issues they reported |

Only Admins can assign an issue, including when creating it. A Developer who reports an issue can therefore edit or move
it only after an Admin assigns it to them.

## 7. Issue status workflow
```
Open --> In Progress --> Testing --> Resolved --> Closed
```
Additional allowed transitions:

| From | To | Allowed roles |
|---|---|---|
| In Progress | Open | Developer (assigned), Admin |
| Testing | In Progress (fix rejected) | Tester, Admin |
| Resolved | In Progress (regression found) | Tester, Admin |
| Closed | Open (reopen) | Admin |

- Work cannot start (`Open -> In Progress`) on an unassigned issue.
- An invalid transition returns `400` with the statuses that are allowed next; a transition the user's role may not make
  returns `403`.
- Assignees must be active Developers who are members of the project.
- A member who still has active (not `Resolved` or `Closed`) issues assigned cannot be removed from a project until those
  issues are reassigned.
- Every status change is recorded in the issue's activity history.

## 8. Database models and relationships
| Collection | Fields | Relationships |
|---|---|---|
| `users` | name, email (unique), password (hash, not selected by default), role, isActive | - |
| `projects` | name, key (unique), description, members, createdBy, issueCounter | `members[]` and `createdBy` reference `users` |
| `issues` | key (unique), number, title, description, project, severity, priority, status, category, component, dueDate, reporter, assignee, severityRank, priorityRank, statusRank | `project` references `projects`; `reporter` and `assignee` reference `users` |
| `comments` | issue, author, text, createdAt | `issue` references `issues`; `author` references `users` |
| `activity` | issue, user, action, from, to, createdAt | `issue` references `issues`; `user` references `users` |

Comments and activity are separate collections rather than arrays inside the issue document, so issues stay small no
matter how long a discussion grows. Referential integrity is verified in the service layer: an issue must reference a
real project the user belongs to, and an assignee must be an active Developer who is a member of that project.
The `*Rank` fields on issues are small numeric copies of severity, priority and status that let lists sort by logical order
(Low, Medium, High, Critical) instead of alphabetically.

## 9. Indexing decisions
Indexes are chosen to match the application's queries.

| Collection | Index | Purpose |
|---|---|---|
| `users` | `email` (unique) | Login and duplicate prevention |
| `projects` | `key` (unique) | Unique project keys |
| `projects` | `members`, `createdBy` | Listing the projects a user can access |
| `projects` | text on `name`, `description` | Project search |
| `issues` | `key` (unique) | Unique issue keys |
| `issues` | `project + status` | Project boards and status filters |
| `issues` | `project + createdAt` | Newest issues per project |
| `issues` | `project + dueDate` | Overdue lookups |
| `issues` | `assignee + status` | "Assigned to me" lists and dashboard |
| `issues` | `reporter`, `priority`, `severity`, `updatedAt` | Filters and recently updated lists |
| `issues` | text on `title`, `description` | Issue search |
| `comments` | `issue + createdAt` | Chronological comment threads |
| `activity` | `issue + createdAt` | Chronological activity timeline |

## 10. API endpoint documentation
Base URL: `http://localhost:5000/api/v1`

All endpoints except `health`, `register` and `login` require the header `Authorization: Bearer <token>`.

Responses use a consistent shape. Success: `{ "success": true, "data": ..., "meta": { ... } }` (`meta` is included for
paginated lists). Failure: `{ "success": false, "message": "...", "errors": [ ... ] }`.

Status codes: `200` OK, `201` created, `400` bad request or invalid workflow transition, `401` unauthenticated,
`403` forbidden, `404` not found, `409` conflict or duplicate, `422` validation failed, `429` too many requests,
`500` server error.

### Authentication and health
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | API and database status |
| POST | `/auth/register` | Public | Body: `name`, `email`, `password`, `accountType` (`Tester` by default, or `Developer`) |
| POST | `/auth/login` | Public | Body: `email`, `password`. Returns `{ user, token }` |
| GET | `/auth/me` | Any user | Current user |

### Users
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/users?search=` | Admin | User directory used when building project teams |

### Projects
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/projects?search=&page=&limit=` | Members | Projects the user belongs to, with issue counts |
| POST | `/projects` | Admin | Body: `name`, `key`, `description`, `members[]` |
| GET | `/projects/:id` | Members | Project details |
| PATCH | `/projects/:id` | Admin | Body: `name`, `description` (the key cannot be changed) |
| PATCH | `/projects/:id/members` | Admin | Body: `{ "add": [userIds], "remove": [userIds] }` |
| GET | `/projects/:id/assignable-users` | Members | Developers in the project |

### Issues
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/issues` | Members | Query: `search`, `status`, `priority`, `severity` (comma-separated lists allowed), `project`, `reporter`, `assignee` (a user id, `me` or `unassigned`), `sortBy`, `order`, `page`, `limit` |
| POST | `/issues` | Admin, Developer, Tester (project members) | Body: `title`, `description`, `project`, `severity`, `priority`, `category` (`Bug`, `Feature` or `Improvement`; default `Bug`), `component` (optional, up to 80 characters), `dueDate` (optional, `YYYY-MM-DD`), `assignee` (optional, Admin only). The reporter and initial status are set by the server |
| POST | `/issues/similar` | Members | Body: `project`, `title`, `description`, `excludeIssueId` (optional), `limit` (optional, up to 10). Returns existing issues of that project ranked by wording similarity. Runs locally; no AI call |
| GET | `/issues/:id` | Members | Issue details, including the caller's `capabilities` |
| PATCH | `/issues/:id` | See the permission matrix | Body: any of `title`, `description`, `severity`, `priority`, `category`, `component`, `dueDate` (`null` clears the due date) |
| PATCH | `/issues/:id/status` | See the permission matrix | Body: `{ "status": "In Progress" }` |
| PATCH | `/issues/:id/assign` | Admin | Body: `{ "assignee": "<userId>" }` or `{ "assignee": null }` |
| DELETE | `/issues/:id` | See the permission matrix | Also deletes the issue's comments and activity |

`sortBy` accepts `createdAt`, `updatedAt`, `priority`, `severity`, `status` and `title`; `order` accepts `asc` or `desc`;
`limit` is at most 100.

### Comments and activity
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/issues/:id/comments` | Members | Comments in chronological order |
| POST | `/issues/:id/comments` | Members | Body: `{ "text": "..." }` |
| GET | `/issues/:id/activity` | Members | Activity history (read-only; entries are created by the server) |

### Dashboard
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/dashboard/stats?project=` | Any user | Summary counts, status, priority and severity distributions, and recent issues for the projects the user can access |
| GET | `/dashboard/assigned` | Any user | The user's active assigned issues |

## 11. AI features
BugBoard includes optional AI assistance on the **Create issue** page. Every AI result is a suggestion: nothing is saved,
assigned or changed until you accept it, and the application works the same with AI switched off.

| Feature | What it does | Uses an AI model |
|---|---|---|
| Similar issues | While you type a title, lists existing issues of the selected project with similar wording, a similarity score and the shared words that explain the match | No. It runs locally on the server (TF-IDF and cosine similarity), uses no quota, and keeps working when AI is unavailable |
| Suggest triage | Suggests a category, severity, priority and component, lists clarifying questions, and, for Admins, suggests an assignee. Each suggestion can be edited, accepted or dismissed separately | Yes |
| Improve description | Rewrites the report into a structured description shown next to your original. You can edit it, regenerate it, and decide whether to replace your text (and optionally the title) | Yes |

How the results are protected:
- The model must answer in JSON, which the server validates. Values outside the application's lists are dropped with a
  warning, and a suggested assignee must be a developer in the selected project, otherwise it is discarded.
- Triage and improve are read-only endpoints. They never create or change records; saving goes through the normal
  create-issue endpoint and its normal authorization.
- AI can only be used on projects you belong to (others receive `404`). Teammate workload (names and counts, no emails) is
  sent to the model only for Admins, because only Admins can assign issues.
- Issue text is sent as JSON data and the model is told to treat it as untrusted. Model output cannot change permissions or
  write data.
- The improver flags versions, browsers, operating systems, URLs and HTTP codes in its output that do not appear in your
  original text, so invented details are visible.
- Emails, tokens, API keys, passwords and card-like numbers are masked before text is sent (`AI_REDACT_SENSITIVE`). This is a
  best-effort safeguard, not a guarantee.
- Usage is limited per user (per minute and per day) and across the whole application per day. Requests have a timeout,
  and a fallback model is tried automatically when the primary model is out of quota or unavailable.
- Similar-issue detection compares only the selected project, using at most the latest `DUPLICATE_CANDIDATE_LIMIT` issues. A
  high score means similar wording; it is not proof that two issues are duplicates.

### Gemini setup (free tier)
1. Create a key in Google AI Studio: https://aistudio.google.com/apikey
2. Put it in `server\.env` as `GEMINI_API_KEY=...`. The key stays on the server and is never sent to the browser or committed.
3. From the project root, check the configuration with one small real request:
   ```powershell
   npm run ai:check
   ```
   It prints the non-secret settings and either the model's answer or an error code from the table below. It never prints the key.
4. Restart the backend.

The defaults, `AI_MODEL=gemini-3.5-flash-lite` and `AI_FALLBACK_MODEL=gemini-3.1-flash-lite`, are models that Google's pricing
page lists as free of charge on the free tier. Model names, availability and free-tier request limits change and are not
hard-coded in BugBoard. Check https://ai.google.dev/gemini-api/docs/pricing and the limits shown in Google AI Studio, then
change the variables below.

Data note: Google's pricing page states that free-tier content may be used to improve Google's products. Do not submit
secrets or personal data. The Create issue page shows this notice when Gemini is the provider.

### Demo mode without a key
Set `AI_PROVIDER=mock` for an offline provider that applies simple keyword rules. The interface labels it
"Demo provider: not a real model". The automated tests always use it, so they never contact Gemini or use quota.

### AI configuration (`server\.env`)
| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | empty | Google AI Studio key (server only) |
| `AI_PROVIDER` | `gemini` | `gemini` or `mock` |
| `AI_ENABLED` | `true` | Master switch for all AI features |
| `AI_MODEL` | `gemini-3.5-flash-lite` | Primary model |
| `AI_FALLBACK_MODEL` | `gemini-3.1-flash-lite` | Used when the primary is out of quota, unavailable or not found. Empty disables it |
| `AI_TIMEOUT_MS` | `20000` | Per-request timeout |
| `AI_MAX_INPUT_CHARS` | `6000` | Maximum characters per text field sent to the model |
| `AI_MAX_OUTPUT_TOKENS` | `2048` | Maximum model output size |
| `AI_RATE_LIMIT_PER_MINUTE` | `6` | Requests per user per minute |
| `AI_DAILY_LIMIT_PER_USER` | `40` | Requests per user per UTC day |
| `AI_DAILY_LIMIT_GLOBAL` | `200` | Requests for the whole application per UTC day |
| `AI_REDACT_SENSITIVE` | `true` | Mask obvious secrets and personal data before sending |
| `DUPLICATE_MIN_SCORE` | `0.25` | Minimum similarity (0 to 1) for a similar issue to be listed |
| `DUPLICATE_MAX_RESULTS` | `5` | Default number of similar issues returned |
| `DUPLICATE_CANDIDATE_LIMIT` | `1000` | Most recent issues of a project that are compared |

The usage limits protect your shared free-tier quota. They are kept in server memory, so they are per process and reset when
the server restarts. Set them according to the limits shown in your Google AI Studio account.

### AI endpoints
All endpoints require authentication and project membership.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/ai/status` | Whether AI is available and why not, provider, model, and the caller's remaining allowance. Never returns the key |
| POST | `/ai/triage` | Body: `project`, `title` (3 to 200 characters), `description` (optional, up to 5000), `context` (optional, up to 1000). Returns suggestions, warnings and metadata |
| POST | `/ai/improve` | Same body. Returns the original, the improved report, warnings and what is still missing |
| POST | `/issues/similar` | Similar issues by wording (see the Issues table above) |

AI errors use the standard error shape with an additional `code`:

| Code | Status | Meaning |
|---|---|---|
| `AI_DISABLED` | 503 | AI is switched off or not configured |
| `AI_RATE_LIMITED`, `AI_DAILY_LIMIT`, `AI_BUDGET_EXHAUSTED` | 429 | A per-minute, per-user daily, or application-wide daily limit was reached |
| `AI_QUOTA_EXHAUSTED` | 503 | The provider's quota is used up on the primary and fallback models |
| `AI_UNAVAILABLE` | 503 | The provider could not be reached or is temporarily down |
| `AI_TIMEOUT` | 504 | The request exceeded `AI_TIMEOUT_MS` |
| `AI_AUTH_FAILED` | 503 | The provider rejected the API key |
| `AI_MODEL_NOT_FOUND` | 503 | The configured model name is not available |
| `AI_REQUEST_REJECTED` | 502 | The provider rejected the request |
| `AI_CONTENT_BLOCKED` | 422 | The provider declined to process the text |
| `AI_INVALID_RESPONSE` | 502 | The reply could not be used (not valid or not usable JSON) |
| `AI_INPUT_TOO_LARGE` | 422 | The text is too long for analysis |

### Current scope
Similar-issue detection uses local text similarity; embedding-based search is not implemented. Triage and the description
improver are the AI-model features.

## 12. Prerequisites
- **Node.js** LTS (version 20 or newer) and npm - https://nodejs.org
- **MongoDB**: either MongoDB Community Server installed locally, or a free MongoDB Atlas cluster
- **Git** (optional) and **Visual Studio Code** (optional)

Verify Node.js in PowerShell:
```powershell
node -v
npm -v
```

## 13. Installation and setup
All commands are for Windows PowerShell. The **project root** is the `bugboard` folder that contains `package.json`,
`server` and `client`.

1. Extract the project ZIP and open PowerShell in the project root:
   ```powershell
   cd C:\path\to\bugboard
   ```
2. Install the dependencies for the root, `server` and `client` (run from the project root):
   ```powershell
   npm run install:all
   ```
3. Create the environment files (run from the project root):
   ```powershell
   Copy-Item server\.env.example server\.env
   Copy-Item client\.env.example client\.env
   ```
4. Configure MongoDB and the environment variables as described in the next two sections.
5. Load the demo data, then start the application ([Database seeding](#16-database-seeding),
   [Running the application](#18-running-the-application)).

## 14. MongoDB configuration
Choose **one** of the options below and put the resulting connection string in `MONGODB_URI` in `server\.env`.

### Option A - MongoDB Atlas (no local installation)
1. Create a free account at https://www.mongodb.com/cloud/atlas and create a free **M0** cluster.
2. Under **Database Access**, create a database user and note the username and password.
3. Under **Network Access**, add an IP address that is allowed to connect. For local development, "Allow access from
   anywhere" is sufficient.
4. Choose **Connect -> Drivers** and copy the connection string. Add the database name `bugboard` before the `?`:
   ```
   mongodb+srv://<username>:<password>@<cluster-host>/bugboard?retryWrites=true&w=majority
   ```
   Special characters in the password must be URL-encoded.

### Option B - MongoDB Community Server (local)
1. Download MongoDB Community Server from https://www.mongodb.com/try/download/community and run the installer, keeping
   **Install MongoDB as a Service** selected.
2. Confirm the service is running:
   ```powershell
   Get-Service MongoDB
   ```
3. Use the default connection string, which is already set in `server\.env.example`:
   ```
   mongodb://127.0.0.1:27017/bugboard
   ```

## 15. Environment variables
### `server\.env`
| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the API listens on | `5000` |
| `NODE_ENV` | Runtime mode | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/bugboard` |
| `JWT_SECRET` | Secret used to sign tokens. Required; use a long random value | (generate below) |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CLIENT_URL` | Allowed browser origin for CORS. Must match the frontend address exactly | `http://localhost:5173` |

Generate a secure `JWT_SECRET` in PowerShell and paste it into `server\.env`:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
The server will not start if `MONGODB_URI` or `JWT_SECRET` is missing, or if `JWT_SECRET` still has the placeholder value.
AI-related variables are optional and are listed in [AI features](#11-ai-features).

### `client\.env`
| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Base URL of the API | `http://localhost:5000/api/v1` |

If you change `PORT` in `server\.env`, update `VITE_API_URL` to match. Restart the frontend after editing `client\.env`.

## 16. Database seeding
From the project root:
```powershell
npm run seed
```
The seed script creates the demo users, two projects (`WEB` and `MOB`), sample issues in different statuses, priorities and
severities, and sample comments and activity history. It is safe to run more than once and does not create duplicates.

To delete all BugBoard data first and recreate the demo data from scratch:
```powershell
npm run seed -- --reset
```

## 17. Demo login credentials
These accounts exist only for local demonstration. The password for every account is `Password123`.

| Role | Email | Projects |
|---|---|---|
| Admin | `admin@bugboard.local` | WEB, MOB |
| Developer | `dev1@bugboard.local` | WEB, MOB |
| Developer | `dev2@bugboard.local` | WEB |
| Tester | `tester1@bugboard.local` | WEB, MOB |
| Tester | `tester2@bugboard.local` | WEB |

## 18. Running the application
From the project root, start the backend and frontend together:
```powershell
npm run dev
```
Then open http://localhost:5173 in a browser and sign in with a demo account.

To run them separately, use two terminals in the project root:
```powershell
npm run dev:server    # API at http://localhost:5000/api/v1
npm run dev:client    # frontend at http://localhost:5173
```
To run the API without file watching (for example on a server), run this from the `server` folder:
```powershell
npm start
```
Check that the API and database are connected at http://localhost:5000/api/v1/health.

## 19. Running automated tests
From the project root:
```powershell
npm run test:server    # backend integration tests (Jest and Supertest)
npm run test:client    # frontend tests (Vitest and Testing Library)
npm run test           # both
```
The backend tests require MongoDB to be running. They use a separate database named `bugboard_test`, so development data is
not affected. To use a different test database, set `MONGODB_TEST_URI` before running the tests, for example:
```powershell
$env:MONGODB_TEST_URI = "mongodb://127.0.0.1:27017/bugboard_test"
npm run test:server
```
The tests clear the test database between runs, so point `MONGODB_TEST_URI` only at a database that holds no data you need.
The frontend tests do not need MongoDB or the API. The AI tests use the offline mock provider and never contact Gemini.

## 20. Building the frontend
From the project root:
```powershell
npm run build
```
The production build is written to `client\dist`. To preview it locally, run this from the `client` folder:
```powershell
npm run preview
```

## 21. Design decisions
- **Authorization lives in the service layer.** Most rules depend on the issue itself (assignee, reporter, current status),
  so the services enforce them, and the frontend only uses the resulting `capabilities` to decide which controls to show.
- **Inaccessible resources return `404`, not `403`,** so the existence of other teams' projects and issues is not disclosed.
- **The role is always read from the database,** never from the token, so role changes and deactivation apply immediately.
- **The status workflow is enforced by the server.** The Kanban board updates optimistically but reverts a card if the
  server rejects the move, so drag-and-drop cannot bypass role or workflow rules.
- **Activity history is append-only and written only by server code.** No endpoint accepts activity from clients.
- **Issue keys are sequential per project** using an atomic counter on the project, with the unique index on `key` as a
  safety net for concurrent requests.
- **AI is isolated behind a provider interface.** Gemini and the mock provider share one small contract, and one service owns
  budgets, redaction, timeouts, model fallback, JSON parsing and error mapping, so no feature depends on a vendor.
- **AI output is advisory and validated.** The server checks every suggestion against the application's lists and project
  records, and a person accepts each change.
- **Duplicate detection starts with a local baseline.** Text similarity needs no key or quota and works when AI is down.
- **Every role can report issues.** Admins, Developers and Testers can create issues in the projects they belong to.
  Assigning issues remains an Admin action.
- **Public registration cannot create Admins.** Registration accepts only the Tester and Developer account types.
- **The issue list adapts to screen size.** Issues are shown as a table on tablets and desktops and as cards on phones,
  so every field stays visible without sideways scrolling.

## 22. Troubleshooting
| Symptom | Solution |
|---|---|
| `Missing required environment variables` or `JWT_SECRET is still the placeholder` | Create `server\.env` from `server\.env.example` and set `MONGODB_URI` and a real `JWT_SECRET` |
| `MongooseServerSelectionError` or `ECONNREFUSED 127.0.0.1:27017` | Local MongoDB: start the service with `net start MongoDB` in an administrator PowerShell. Atlas: check the connection string, the URL-encoded password and the Network Access list |
| The login page shows "Cannot reach the server" | The backend is not running, or `VITE_API_URL` is wrong. Restart both after editing `.env` files |
| CORS error in the browser console | `CLIENT_URL` in `server\.env` must exactly match the frontend address, for example `http://localhost:5173` |
| `EADDRINUSE` on port 5000 | Another program is using the port. Change `PORT` in `server\.env` and `VITE_API_URL` in `client\.env` |
| Cannot sign in as the Admin | Run `npm run seed` first. Admin accounts cannot be created through registration |
| `npm run seed` creates nothing | The data already exists. Run `npm run seed -- --reset` for a clean start |
| PowerShell reports that running scripts is disabled | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then reopen PowerShell |
| Backend tests time out | MongoDB is not running or `MONGODB_TEST_URI` cannot be reached |
| AI buttons are disabled | The page shows the reason (for example a missing `GEMINI_API_KEY`). Set it in `server\.env`, restart the backend, and run `npm run ai:check` |
| `AI_QUOTA_EXHAUSTED` or `AI_RATE_LIMITED` | The free-tier quota or the application's own limit was reached. Wait, or adjust `AI_MODEL` and the `AI_*_LIMIT` variables. The rest of BugBoard is unaffected |
| Changes to `.env` are not applied | Stop and restart `npm run dev`; environment files are read at startup |
