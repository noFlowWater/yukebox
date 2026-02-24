# Contributing to YukeBox

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 22+
- npm 10+
- Linux with PulseAudio/PipeWire (for audio testing)

### Local Development

```bash
# Backend
cd backend
npm install
npm run dev       # starts on :4000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev       # starts on :3000
```

Next.js automatically proxies `/api/*` requests to the backend.

### Running Tests

```bash
# Backend unit tests
cd backend && npm test

# Frontend E2E tests (requires both servers running)
cd frontend && npm run test:e2e
```

---

## Branch Strategy

We use **GitHub Flow** — all work happens on feature branches merged into `main`.

```
main              ← always deployable, protected
feat/description  ← new features
fix/description   ← bug fixes
refactor/...      ← code restructuring
chore/...         ← tooling, deps, config
docs/...          ← documentation
```

- All PRs target `main`
- No `dev` or `release` branches
- Releases are tagged on `main` (`v0.1.0`, `v0.2.0`, ...)

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org). **PR titles are validated by CI** — your PR title must follow this format:

```
type(scope): description
```

**Types:**

| Type | When to use |
|------|-------------|
| `feat` | New feature visible to users |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `chore` | Dependencies, config, tooling |
| `docs` | Documentation only |
| `test` | Test additions or changes |
| `ci` | CI/CD pipeline changes |
| `style` | Code formatting (no logic change) |
| `perf` | Performance improvement |

**Scopes** (optional):

| Scope | Area |
|-------|------|
| `server` | Backend (Fastify) |
| `frontend` | Frontend (Next.js) |
| `docker` | Docker / infrastructure |

**Examples:**

```
feat(server): add queue shuffle endpoint
fix(frontend): volume slider not updating on mobile
chore(docker): update base image to node 22
refactor(server): extract player state to service
docs: update API endpoint documentation
```

---

## Pull Requests

All PRs are **squash merged** — your PR title becomes the commit message on `main`.

1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes following the coding standards below
4. Write or update tests as needed
5. Push and open a Pull Request against `main`
6. Ensure the PR title follows Conventional Commits format

### PR Checklist

- [ ] PR title follows `type(scope): description` format
- [ ] Code follows project coding standards
- [ ] Tests pass (`cd backend && npm test`)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)

---

## Coding Standards

### General

- All code, comments, and variable names must be in **English**
- Input validation with **Zod** on every API endpoint
- Every `async` function must have `try/catch` error handling

### Backend Architecture

Strict layering — never skip:

```
Routes → Controllers → Services → Repositories
```

- **Routes**: routing only, zero business logic
- **Controllers**: handle request/response
- **Services**: all business logic lives here
- **Repositories**: database access only
- Config values must come from `src/config/index.ts` (not `process.env` directly)

### Frontend

- Icons: **Lucide React** only (no emojis, no other icon libraries)
- API calls: all through `lib/api.ts` (single API client)
- State: React hooks only (no external state libraries)
- Styling: Tailwind CSS with shadcn/ui components

---

## Reporting Issues

- Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template for bugs
- Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template for ideas
- Check existing issues before creating a new one

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
