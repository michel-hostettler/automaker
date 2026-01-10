---
name: agentic-jumpstart-dependency-management
description: npm workspaces dependency management for monorepo with shared packages. Use when adding dependencies, managing package versions, resolving conflicts, or when the user mentions dependencies, npm, packages, versions, or workspaces.
---

# Dependency Management

## Monorepo Workspace Setup

### Root package.json

```json
{
  "name": "automaker",
  "private": true,
  "workspaces": ["apps/*", "libs/*"],
  "scripts": {
    "build:packages": "npm run build -ws --if-present",
    "test:packages": "npm run test -ws --if-present"
  }
}
```

## Adding Dependencies

### To a specific workspace

```bash
# Add to apps/ui
npm install react-markdown -w apps/ui

# Add to libs/utils
npm install winston -w @automaker/utils

# Add dev dependency
npm install -D vitest -w apps/server
```

### To root (shared tooling)

```bash
# Root dev dependencies (linting, formatting)
npm install -D eslint prettier husky -w
```

### Internal package dependencies

```json
// libs/git-utils/package.json
{
  "dependencies": {
    "@automaker/types": "*",
    "@automaker/utils": "*",
    "@automaker/platform": "*"
  }
}
```

## Dependency Hierarchy Rules

### Package Dependency Order

```
@automaker/types       → No internal dependencies
@automaker/utils       → @automaker/types
@automaker/prompts     → @automaker/types
@automaker/platform    → @automaker/types
@automaker/model-resolver → @automaker/types
@automaker/dependency-resolver → @automaker/types
@automaker/git-utils   → @automaker/types, utils, platform
apps/server            → All @automaker/* packages
apps/ui                → @automaker/types
```

### Adding to Correct Package

| Dependency Type     | Location       |
| ------------------- | -------------- |
| React components    | apps/ui        |
| Express middleware  | apps/server    |
| Shared utilities    | libs/utils     |
| Type definitions    | libs/types     |
| AI prompts          | libs/prompts   |
| Path/security utils | libs/platform  |
| Git operations      | libs/git-utils |

## Version Management

### Pinning Strategies

```json
{
  "dependencies": {
    // Exact version for critical dependencies
    "react": "19.2.3",

    // Caret for compatible updates
    "express": "^5.2.1",

    // Internal packages use wildcard
    "@automaker/types": "*"
  }
}
```

### Node.js Version

```json
{
  "engines": {
    "node": ">=22.0.0 <23.0.0"
  }
}
```

## Common Commands

```bash
# Install all dependencies
npm install

# Clean install (CI)
npm ci

# Update all packages
npm update

# Check for outdated
npm outdated

# Deduplicate dependencies
npm dedupe

# List workspace packages
npm ls -ws

# Run script in all workspaces
npm run build -ws --if-present

# Run script in specific workspace
npm run test -w apps/server
```

## Build Order

Packages must be built in dependency order:

```bash
# Build packages first (they have no internal deps)
npm run build -w @automaker/types
npm run build -w @automaker/utils
npm run build -w @automaker/prompts
npm run build -w @automaker/platform
npm run build -w @automaker/model-resolver
npm run build -w @automaker/dependency-resolver
npm run build -w @automaker/git-utils

# Then build apps
npm run build -w apps/server
npm run build -w apps/ui

# Or use the convenience script
npm run build:packages
```

## Native Dependencies

### node-pty Handling

```json
// apps/server/package.json
{
  "dependencies": {
    "node-pty": "^1.1.0-beta41"
  },
  "scripts": {
    "postinstall": "electron-rebuild -f -w node-pty"
  }
}
```

### Platform-Specific Optional Dependencies

```json
{
  "optionalDependencies": {
    "lightningcss-darwin-arm64": "^1.29.2",
    "lightningcss-darwin-x64": "^1.29.2",
    "lightningcss-linux-x64-gnu": "^1.29.2",
    "lightningcss-win32-x64-msvc": "^1.29.2"
  }
}
```

## Resolving Conflicts

### Peer Dependency Warnings

```bash
# Check for peer dep issues
npm ls --depth=0

# Force resolution if needed (use sparingly)
npm install --legacy-peer-deps
```

### Version Conflicts

```json
// package.json overrides (npm 8.3+)
{
  "overrides": {
    "problematic-package": "2.0.0"
  }
}
```

## Docker Considerations

### Install for Production

```dockerfile
# Install production dependencies only
RUN npm ci --omit=dev

# Rebuild native modules for Linux
RUN npm rebuild node-pty
```

### Multi-stage Build

```dockerfile
# Build stage
FROM node:22-slim AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:22-slim
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
```

## Security

### Audit Dependencies

```bash
# Check for vulnerabilities
npm audit

# Fix automatically (where possible)
npm audit fix

# Fix with breaking changes (careful!)
npm audit fix --force
```

### Lock File

- Always commit `package-lock.json`
- Use `npm ci` in CI/CD for reproducible builds
- Review lock file changes in PRs

## Checklist for Adding Dependencies

- [ ] Add to correct workspace (not root unless shared tooling)
- [ ] Check if similar dependency already exists
- [ ] Verify license compatibility
- [ ] Run `npm audit` after adding
- [ ] Update build scripts if needed
- [ ] Test in Docker build
- [ ] Document purpose if not obvious
