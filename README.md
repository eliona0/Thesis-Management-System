# Thesis Management System

## Overview

Thesis Management System is a web application developed for UBT to manage the university thesis lifecycle for students, mentors, committee members, and administrators. It brings together mentor requests, thesis details and version submissions, mentor feedback and final review, committee assignment, defense scheduling, committee evaluations, and thesis completion.

## Features

### Student

- Register and sign in; select a study program during registration.
- View a profile, available mentors, and sent mentor requests; cancel a pending request.
- View and update thesis title and details before mentor approval, and track thesis status.
- Upload PDF thesis versions, keep drafts, submit a version for regular feedback, and submit a final version for mentor evaluation.
- Read mentor feedback and final approval or rejection. After a final rejection, revise and submit a later version.

**Version review states:** `DRAFT` → `SUBMITTED` → `REVIEWED` for regular feedback, or `DRAFT` → `SUBMITTED` → `APPROVED` for final approval. A rejected final submission is returned to `REVIEWED`, allowing a later version to be submitted.

### Mentor

- View mentor profile, incoming requests, assigned theses, and feedback.
- Accept or reject mentor requests; approve or reject proposed thesis details.
- Review thesis versions and submitted work, access authorized thesis PDFs, and provide feedback on submitted versions.
- Approve or reject final thesis submissions with a final evaluation and grade.

### Committee member

- View assigned committees and thesis/student details, defense dates, and evaluation progress.
- Submit one individual grade and optional comments for an assigned thesis when the defense date has arrived.
- As Chair, make the committee’s final grade decision after all three evaluations are submitted.

Individual grades are hidden from other members while evaluations are being collected. At the final decision stage, the Chair can see the three grades.

### Administrator

- View dashboard summaries and search/filter users by role and study program; inspect user details and activate or deactivate accounts.
- View, add, and edit study programs. There is no study program deletion operation, which avoids removing records that may be linked to users.
- Create committees, assign members, and schedule defenses for eligible theses.

## System Workflow

```text
Student registers and requests a mentor
  → Mentor accepts the request
  → Thesis is created as PENDING
  → Student submits thesis title and details
  → Mentor approves (thesis becomes IN_PROGRESS) or rejects
  → Student uploads version(s)
  → Regular submission → mentor feedback (version becomes REVIEWED)
  → Student submits final version → mentor approves or rejects
      → Approval: thesis becomes SUBMITTED
      → Rejection: feedback is recorded; student can prepare another version
  → Admin assigns a three-member committee and schedules a defense
  → Members submit individual evaluations on or after the defense date
  → At 3/3 evaluations, the Chair confirms the final grade
  → Committee and thesis become COMPLETED
```

The thesis status values in the data model are `PENDING`, `APPROVED`, `REJECTED`, `IN_PROGRESS`, `SUBMITTED`, `UNDER_EVALUATION`, and `COMPLETED`. The implemented workflow moves an approved thesis into `IN_PROGRESS`; after mentor final approval it is `SUBMITTED`, and after the committee decision it is `COMPLETED`. Other enum values are defined in the schema but are not presented here as active workflow steps.

## Committee Evaluation

A committee assignment requires three distinct members, exactly one designated Chair, and two members. A committee member must authenticate, belong to the assigned committee, and have no earlier evaluation for that thesis. The database also enforces one evaluation per member and thesis. Evaluations are accepted only when the committee is `SCHEDULED` and the defense date is on or before the current time. Progress is exposed as a count from 0/3 to 3/3.

Once all three evaluations exist, only the assigned Chair can confirm the final decision. If all three grades agree, the confirmed grade must match that common grade. If they differ, the Chair provides the final grade. The application does not calculate an average or apply a majority, highest, or lowest grade rule. Grades must be between 6 and 10 inclusive, in increments of 0.01. Confirmation records the separate committee final grade and marks both committee and thesis `COMPLETED`. The mentor’s final thesis grade is stored separately on the thesis record.

## UBT Regulation Alignment

Selected workflow rules were implemented with reference to the applicable UBT thesis regulation. These include the thesis development period, mentor evaluation after final submission with a seven-day decision window, a three-member defense committee, defense scheduling, individual evaluations, and a 6–10 final grade confirmed by agreement or decided by the Chair when grades differ. This describes implementation intent and does not claim legal certification or official institutional approval.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Client | React 19, Vite 8, React Router 7, Axios 1 |
| Server | Node.js, Express 5, JWT (`jsonwebtoken`), Multer 2 |
| Database | PostgreSQL, Prisma 7 with the PostgreSQL adapter |
| Client quality checks | ESLint 10; Vite production build |
| Server tests | Node.js built-in test runner (`node:test`) with API workflow tests |

Versions are the package manifest ranges; the lockfiles pin the installed dependency versions. The repository does not declare a Node.js version.

## Architecture

The React client calls the Express REST API. Route modules apply authentication and role checks and dispatch to controllers; domain services are used for thesis, committee, mentor-request, feedback, and administrative operations where implemented. Prisma accesses PostgreSQL.

```text
React client → Express routes → authentication / role middleware
             → controllers → services (where implemented) → Prisma → PostgreSQL
```

## Project Structure

```text
Thesis-Management-System/
├── client/
│   ├── src/                 # React app, role-based pages, components, context, routes, API client
│   ├── public/              # Static client assets
│   ├── package.json         # Client scripts and dependencies
│   └── vite.config.js
├── server/
│   ├── src/
│   │   ├── routes/          # API route groups
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # Domain operations
│   │   ├── middleware/      # JWT, role checks, and PDF uploads/access
│   │   └── api-workflows.test.js
│   ├── prisma/              # Schema and migrations
│   ├── uploads/theses/      # Locally stored thesis PDFs
│   ├── seed.js              # Roles, study programs, and development accounts
│   ├── server.js            # Server entry point
│   └── package.json         # Server scripts and dependencies
├── package.json             # Root dependency manifest
├── package-lock.json
└── README.md
```

## Database

The Prisma schema defines these main models:

- `User`, `Role`, `Permission`, and `RolePermission`: accounts, role assignment, and role-permission relationships.
- `StudyProgram`: programs associated with users.
- `StudentProfile`, `MentorProfile`, and `CommitteeMemberProfile`: role-specific profile details.
- `MentorRequest`: student requests and mentor responses.
- `Thesis` and `ThesisVersion`: thesis information, status, stored file reference, uploader, and version state.
- `Feedback`: mentor comments associated with thesis versions.
- `Committee` and `CommitteeMember`: committee assignment, Chair/member roles, defense date, status, and final committee grade.
- `Evaluation`: an assigned member’s grade and optional comments for a thesis.

## API Overview

All API route groups are mounted under `/api`. The main groups and route categories are:

| Base path | Implemented categories |
| --- | --- |
| `/api/auth` | Registration, login, current authenticated user |
| `/api/student` | Student profile and available mentors |
| `/api/mentor-requests` | Student request creation, listing, and cancellation |
| `/api/mentor` | Mentor profile, requests, assigned theses, and feedback |
| `/api/thesis` | Thesis details, versions, regular submission, final submission and mentor final decision |
| `/api/feedback` | Mentor feedback and student feedback retrieval |
| `/api/committee` | Committee assignment, defense scheduling, member dashboards, evaluations, and Chair decision |
| `/api/admin` | Admin dashboard, users/status, and study program management |
| `/api/study-programs` | Active study program listing |

The server also exposes `/api/health` and `/api/health/db` for API and database health checks.

## Authentication and Authorization

The client sends the JWT as a Bearer token on authenticated API requests. Server middleware verifies the token, reloads the active user and role from the database, and applies role-based access checks for students, mentors, committee members, and administrators. Sensitive actions use the authenticated user identity from the verified request context, including committee evaluations and Chair decisions.

## File Uploads

Thesis versions are uploaded as PDF files through Multer and stored locally in `server/uploads/theses/`. Uploads are limited to 10 MB. Thesis file retrieval is authenticated and checks whether the requester is the thesis’s student or assigned mentor; files are served with private, no-store cache headers. The repository implements local disk storage, not cloud storage.

## Getting Started

### Prerequisites

- Node.js and npm
- PostgreSQL

### Configure and start the server

From the repository root, install the server dependencies, configure the environment variables described below, apply the existing Prisma migrations, seed development data if desired, and start the API:

```sh
cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

The server listens on port `5000` by default. `npm start` runs the server without the development watcher.

### Start the client

In a second terminal:

```sh
cd client
npm install
npm run dev
```

Vite prints the local client URL when it starts. The client uses `http://localhost:5000/api` as its default API base URL.

## Environment Variables

The repository contains local `.env` files; do not copy their secret values into documentation or commit them. Configure these names in the appropriate environment:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server / Prisma | PostgreSQL connection string |
| `JWT_SECRET` | Server | Secret used to sign and verify authentication tokens |
| `PORT` | Server | API listening port; defaults to `5000` |
| `VITE_API_BASE_URL` | Client | API base URL; defaults to `http://localhost:5000/api` |

Example with placeholders only:

```dotenv
# server/.env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public"
JWT_SECRET="replace-with-a-local-development-secret"
PORT=5000

# client/.env
VITE_API_BASE_URL="http://localhost:5000/api"
```

## Test Accounts

**Development/Test Accounts — do not use in production.** These accounts and passwords are created or updated by `server/seed.js`.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `test.admin@example.com` | `Admin1234!` |
| Mentor | `test.mentor@example.com` | `Mentor1234!` |
| Committee Chair | `test.chair@example.com` | `Committee1234!` |
| Committee member | `test.member1@example.com` | `Committee1234!` |
| Committee member | `test.member2@example.com` | `Committee1234!` |

The seed does not create a student account.

## Testing

Run these commands from the corresponding project folder:

| Command | What it checks |
| --- | --- |
| `cd server && npm test` | Server API workflow tests using Node’s built-in test runner |
| `cd client && npm run lint` | Client ESLint checks |
| `cd client && npm run build` | Client production build |

There is no Prisma validation script in the package manifests.

## Project Status

The repository includes the core student and mentor thesis workflows, version submission and feedback, mentor final review, committee assignment and defense scheduling, committee evaluations and Chair decision, thesis completion, and administrator pages for dashboards and management. The repository also includes API workflow tests. This documents the current implementation and test setup; it does not assert production readiness, deployment, security certification, or institutional adoption.
