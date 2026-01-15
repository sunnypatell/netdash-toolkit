# Contributing to NetDash Toolkit

thanks for your interest in contributing! this guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+

### Getting Started

```bash
# clone the repo
git clone https://github.com/sunnypatell/netdash-toolkit.git
cd netdash-toolkit

# install dependencies
pnpm install

# start development server
pnpm dev
```

### Available Scripts

| command | description |
|---------|-------------|
| `pnpm dev` | start next.js dev server |
| `pnpm build` | production build |
| `pnpm lint` | run eslint |
| `pnpm typecheck` | run typescript compiler |
| `pnpm electron:dev` | start electron dev mode |
| `pnpm dist:mac` | build macos electron app |
| `pnpm dist:win` | build windows electron app |
| `pnpm dist:linux` | build linux electron app |

## Project Structure

```
netdash-toolkit/
├── app/                 # next.js app router
├── components/
│   ├── ui/              # shadcn/ui primitives
│   └── tools/           # network tool components
├── lib/                 # core utilities & business logic
├── hooks/               # react hooks
├── electron/            # electron main process
└── public/              # static assets
```

## Contributing Guidelines

### Branch Naming

- `feat/description` - new features
- `fix/description` - bug fixes
- `docs/description` - documentation
- `refactor/description` - code refactoring

### Commit Messages

we use [conventional commits](https://www.conventionalcommits.org/):

```
type(scope): description

- bullet point explaining change
- another point if needed
```

types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

### Pull Requests

1. fork the repo and create your branch from `main`
2. make your changes
3. ensure `pnpm lint` and `pnpm build` pass
4. submit a PR using the template

### Code Style

- typescript for all new code
- use existing patterns in the codebase
- keep components focused and single-purpose
- prefer composition over inheritance

## Adding a New Tool

1. create component in `components/tools/`
2. add utility functions in `lib/` if needed
3. register the tool in the sidebar
4. test thoroughly before submitting PR

## Reporting Issues

- use the appropriate [issue template](https://github.com/sunnypatell/netdash-toolkit/issues/new/choose)
- include reproduction steps for bugs
- check existing issues before creating new ones

## License

by contributing, you agree that your contributions will be licensed under the MIT License.
