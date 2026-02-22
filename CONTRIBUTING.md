# Contributing to YukeBox

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
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

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org):

```
feat: add queue shuffle feature
fix: volume slider not updating on mobile
docs: update API endpoint documentation
refactor: extract player state to custom hook
chore: update Docker base image
test: add schedule edge case tests
```

**Format:** `type: description in English`

**Types:** `feat` | `fix` | `docs` | `refactor` | `chore` | `test` | `style` | `ci`

---

## Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes following the coding standards below
4. Write or update tests as needed
5. Commit with conventional commit messages
6. Push and open a Pull Request against `main`

### PR Checklist

- [ ] Code follows project coding standards
- [ ] Tests pass (`npm test` in backend)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] Commit messages follow conventional commits

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
