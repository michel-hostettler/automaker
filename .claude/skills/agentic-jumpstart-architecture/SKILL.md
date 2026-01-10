---
name: agentic-jumpstart-architecture
description: Monorepo architecture with npm workspaces, shared packages, and layered application structure. Use when organizing code, creating new packages, understanding project structure, or when the user mentions architecture, structure, organization, monorepo, packages, or modules.
---

# Architecture Patterns

## Monorepo Structure

```
automaker/
├── apps/
│   ├── ui/              # React + Vite + Electron frontend
│   └── server/          # Express + WebSocket backend
├── libs/                # Shared packages (@automaker/*)
│   ├── types/           # Core TypeScript definitions
│   ├── utils/           # Logging, errors, utilities
│   ├── prompts/         # AI prompt templates
│   ├── platform/        # Path management, security
│   ├── model-resolver/  # Claude model alias resolution
│   ├── dependency-resolver/  # Feature dependency ordering
│   └── git-utils/       # Git operations & worktrees
├── tests/               # E2E tests (Playwright)
└── scripts/             # Build and utility scripts
```

## Package Dependency Hierarchy

Packages can only depend on packages above them:

```
@automaker/types (no dependencies)
    ↓
@automaker/utils, @automaker/prompts, @automaker/platform,
@automaker/model-resolver, @automaker/dependency-resolver
    ↓
@automaker/git-utils
    ↓
apps/server, apps/ui
```

## Shared Package Pattern

### Package Structure

```
libs/utils/
├── src/
│   ├── index.ts         # Public exports
│   ├── logger.ts        # Logger implementation
│   ├── errors.ts        # Error utilities
│   └── context.ts       # Context loading
├── tests/
│   └── logger.test.ts
├── package.json
└── tsconfig.json
```

### Package.json

```json
{
  "name": "@automaker/utils",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "@automaker/types": "*"
  }
}
```

### Index Exports

```typescript
// libs/utils/src/index.ts
export { createLogger, type Logger } from './logger';
export { classifyError, ApiError } from './errors';
export { loadContextFiles } from './context';
```

## Frontend Architecture (apps/ui)

```
apps/ui/src/
├── components/
│   ├── ui/              # Base UI components (Radix wrappers)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   └── views/           # Feature views
│       ├── BoardView.tsx
│       ├── TerminalView.tsx
│       └── SettingsView.tsx
├── routes/              # TanStack Router (file-based)
│   ├── __root.tsx
│   ├── index.tsx
│   └── project/
│       └── $projectId.tsx
├── store/               # Zustand stores
│   ├── app-store.ts
│   └── setup-store.ts
├── hooks/               # Custom React hooks
│   ├── useFeatures.ts
│   └── useWebSocket.ts
├── lib/                 # Utilities
│   ├── api.ts           # API client
│   └── utils.ts         # Helper functions
└── main.tsx             # Entry point
```

## Backend Architecture (apps/server)

```
apps/server/src/
├── routes/              # Express route handlers
│   ├── index.ts         # Route registration
│   ├── agent.ts         # AI agent operations
│   ├── features.ts      # Feature CRUD
│   ├── auto-mode.ts     # Auto-mode workflow
│   ├── worktree.ts      # Git worktree management
│   └── terminal.ts      # Terminal sessions
├── services/            # Business logic
│   ├── AgentService.ts
│   ├── AutoModeService.ts
│   ├── FeatureLoader.ts
│   └── TerminalService.ts
├── providers/           # External service adapters
│   └── claude/          # Claude Agent SDK
├── lib/                 # Utilities
│   ├── events.ts        # Event emitter
│   ├── auth.ts          # Authentication
│   └── websocket.ts     # WebSocket setup
└── index.ts             # Server entry point
```

## Layered Architecture

### Request Flow

```
Client Request
    ↓
Express Routes (routes/)
    ↓
Services (services/)
    ↓
Providers (providers/)
    ↓
Shared Packages (libs/)
```

### Service Pattern

```typescript
// services/FeatureService.ts
import { createLogger } from '@automaker/utils';
import { getFeatureDir } from '@automaker/platform';
import type { Feature } from '@automaker/types';

export class FeatureService {
  private logger = createLogger('FeatureService');

  async getFeature(projectPath: string, featureId: string): Promise<Feature> {
    const dir = getFeatureDir(projectPath, featureId);
    // ... implementation
  }

  async saveFeature(feature: Feature): Promise<void> {
    // ... implementation
  }
}
```

## Event-Driven Communication

### Event Flow

```
Service Event
    ↓
EventEmitter (lib/events.ts)
    ↓
WebSocket Broadcast
    ↓
React State Update (via TanStack Query invalidation)
```

### Implementation

```typescript
// Server: Emit event
eventEmitter.emit({
  type: 'feature:updated',
  data: feature,
  timestamp: Date.now(),
});

// Server: Broadcast via WebSocket
eventEmitter.on((event) => {
  broadcast(event.type, event.data);
});

// Client: Handle update
useEffect(() => {
  ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);
    if (type === 'feature:updated') {
      queryClient.invalidateQueries(['features']);
    }
  };
}, []);
```

## Data Storage Layout

### Per-Project Data (.automaker/)

```
.automaker/
├── features/            # Feature JSON and images
│   └── {featureId}/
│       ├── feature.json
│       ├── agent-output.md
│       └── images/
├── context/             # Context files for AI
├── settings.json        # Project settings
├── spec.md             # Project specification
└── analysis.json       # Project analysis
```

### Global Data (DATA_DIR)

```
data/
├── settings.json        # Global settings
├── credentials.json     # API keys
├── sessions-metadata.json
└── agent-sessions/      # Conversation histories
```

## Import Conventions

### Always use package imports

```typescript
// ✅ Correct - use shared packages
import type { Feature } from '@automaker/types';
import { createLogger } from '@automaker/utils';
import { getFeatureDir } from '@automaker/platform';

// ❌ Wrong - don't use relative paths to other packages
import { Feature } from '../../libs/types/src';
import { createLogger } from '../../../libs/utils/src/logger';
```

### Path aliases in apps

```typescript
// In apps/ui - use @ alias
import { Button } from '@/components/ui/button';
import { useFeatures } from '@/hooks/useFeatures';
```

## Creating New Packages

1. Create directory: `libs/new-package/`
2. Add `package.json` with `@automaker/` prefix
3. Add to root `package.json` workspaces
4. Add `tsconfig.json` extending root config
5. Export from `src/index.ts`
6. Build with `npm run build:packages`
