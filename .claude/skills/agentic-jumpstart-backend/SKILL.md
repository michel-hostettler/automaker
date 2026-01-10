---
name: agentic-jumpstart-backend
description: Express 5 backend patterns with WebSocket, Claude Agent SDK, node-pty terminal management, and TypeScript. Use when writing API routes, services, middleware, WebSocket handlers, terminal management, or when the user mentions backend, API, server, routes, Express, or WebSocket.
---

# Backend Development Patterns

## Project Structure

```
apps/server/src/
├── routes/           # Express route handlers by feature
│   ├── agent.ts      # AI agent operations
│   ├── features.ts   # Feature CRUD
│   ├── auto-mode.ts  # Auto-mode workflow
│   ├── worktree.ts   # Git worktree management
│   └── terminal.ts   # Terminal sessions
├── services/         # Business logic
│   ├── AgentService.ts
│   ├── AutoModeService.ts
│   ├── FeatureLoader.ts
│   └── TerminalService.ts
├── providers/        # AI provider abstraction
├── lib/              # Utilities (events, auth, etc.)
└── index.ts          # Server entry point
```

## Express 5 Route Patterns

### Route Handler

```typescript
// routes/features.ts
import { Router, Request, Response } from 'express';
import type { Feature } from '@automaker/types';
import { createLogger } from '@automaker/utils';

const router = Router();
const logger = createLogger('Features');

router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectPath } = req.query;
    if (!projectPath || typeof projectPath !== 'string') {
      return res.status(400).json({ error: 'projectPath required' });
    }

    const features = await featureLoader.loadFeatures(projectPath);
    res.json({ success: true, features });
  } catch (error) {
    logger.error('Failed to load features', error);
    res.status(500).json({ error: 'Failed to load features' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const feature: Feature = req.body;
    await featureLoader.saveFeature(feature);
    res.json({ success: true, feature });
  } catch (error) {
    logger.error('Failed to save feature', error);
    res.status(500).json({ error: 'Failed to save feature' });
  }
});

export default router;
```

### Middleware

```typescript
// lib/auth.ts
import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey || !isValidApiKey(apiKey as string)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}

// Usage in app
app.use('/api', authMiddleware);
```

## WebSocket Patterns

### Server Setup

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const clientId = crypto.randomUUID();
    logger.info(`Client connected: ${clientId}`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, clientId, message);
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      logger.info(`Client disconnected: ${clientId}`);
      cleanup(clientId);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error: ${clientId}`, error);
    });
  });

  return wss;
}
```

### Message Handler

```typescript
interface WSMessage {
  type: string;
  payload?: unknown;
}

function handleMessage(ws: WebSocket, clientId: string, message: WSMessage) {
  switch (message.type) {
    case 'subscribe':
      subscriptions.set(clientId, message.payload as string[]);
      break;
    case 'terminal:input':
      terminalService.write(clientId, message.payload as string);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}
```

### Broadcasting

```typescript
function broadcast(event: string, data: unknown, filter?: (clientId: string) => boolean) {
  const message = JSON.stringify({ type: event, data });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const clientId = clientMap.get(client);
      if (!filter || filter(clientId!)) {
        client.send(message);
      }
    }
  });
}
```

## Event-Driven Architecture

### Event Emitter Pattern

```typescript
// lib/events.ts
import { EventEmitter } from 'events';

export interface AgentEvent {
  type: 'start' | 'message' | 'tool_use' | 'complete' | 'error';
  data: unknown;
  timestamp: number;
}

export function createEventEmitter() {
  const emitter = new EventEmitter();

  return {
    emit: (event: AgentEvent) => {
      emitter.emit('event', event);
    },
    on: (handler: (event: AgentEvent) => void) => {
      emitter.on('event', handler);
      return () => emitter.off('event', handler);
    },
    stream: (ws: WebSocket) => {
      const handler = (event: AgentEvent) => {
        ws.send(JSON.stringify(event));
      };
      emitter.on('event', handler);
      return () => emitter.off('event', handler);
    },
  };
}
```

## Claude Agent SDK Integration

### Agent Service

```typescript
import { Agent, createAgent } from '@anthropic-ai/claude-agent-sdk';
import { resolveModelString } from '@automaker/model-resolver';

export class AgentService {
  private agent: Agent | null = null;

  async execute(options: ExecuteOptions): Promise<void> {
    const model = resolveModelString(options.model || 'sonnet');

    this.agent = createAgent({
      model,
      systemPrompt: options.systemPrompt,
      tools: options.tools,
    });

    for await (const event of this.agent.run(options.prompt)) {
      this.eventEmitter.emit({
        type: event.type,
        data: event,
        timestamp: Date.now(),
      });
    }
  }

  abort(): void {
    this.agent?.abort();
  }
}
```

## Terminal Service (node-pty)

### Terminal Management

```typescript
import * as pty from 'node-pty';

export class TerminalService {
  private terminals = new Map<string, pty.IPty>();

  create(id: string, options: TerminalOptions): pty.IPty {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    const terminal = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    this.terminals.set(id, terminal);

    terminal.onData((data) => {
      this.emit(id, 'output', data);
    });

    terminal.onExit(({ exitCode }) => {
      this.emit(id, 'exit', exitCode);
      this.terminals.delete(id);
    });

    return terminal;
  }

  write(id: string, data: string): void {
    this.terminals.get(id)?.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.terminals.get(id)?.resize(cols, rows);
  }

  kill(id: string): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.kill();
      this.terminals.delete(id);
    }
  }
}
```

## Service Pattern

### Base Service

```typescript
import { createLogger, Logger } from '@automaker/utils';

export abstract class BaseService {
  protected logger: Logger;

  constructor(name: string) {
    this.logger = createLogger(name);
  }

  protected handleError(operation: string, error: unknown): never {
    this.logger.error(`${operation} failed`, error);
    throw error;
  }
}
```

## Error Handling

### Custom Errors

```typescript
// lib/errors.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

// Error middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

## Import Conventions

```typescript
// Shared packages
import type { Feature, ExecuteOptions } from '@automaker/types';
import { createLogger, classifyError } from '@automaker/utils';
import { getFeatureDir, ensureAutomakerDir } from '@automaker/platform';
import { resolveModelString } from '@automaker/model-resolver';
import { getGitRepositoryDiffs } from '@automaker/git-utils';
```
