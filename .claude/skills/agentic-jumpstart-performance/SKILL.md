---
name: agentic-jumpstart-performance
description: Performance optimization for React 19, Vite 7, Express 5, WebSocket, Electron, and xterm.js. Use when optimizing code, reducing bundle size, improving load times, memory management, or when the user mentions performance, speed, optimization, memory, caching, or latency.
---

# Performance Optimization Guidelines

## React Performance

### React 19 Optimizations

```typescript
// Use React.memo for expensive components
const ExpensiveList = React.memo(({ items }) => (
  <ul>{items.map(item => <Item key={item.id} {...item} />)}</ul>
));

// Use useMemo for expensive calculations
const sortedItems = useMemo(
  () => items.sort((a, b) => a.priority - b.priority),
  [items]
);

// Use useCallback for stable function references
const handleClick = useCallback((id: string) => {
  setSelected(id);
}, []);
```

### TanStack Query Caching

```typescript
// Configure stale time and cache time
const { data } = useQuery({
  queryKey: ['features', projectPath],
  queryFn: fetchFeatures,
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes cache
});

// Prefetch data
queryClient.prefetchQuery({
  queryKey: ['feature', featureId],
  queryFn: () => fetchFeature(featureId),
});
```

### Zustand Store Optimization

```typescript
// Use selectors to prevent unnecessary re-renders
const features = useAppStore((state) => state.features);
const setFeatures = useAppStore((state) => state.setFeatures);

// Avoid selecting entire store
// Bad: const store = useAppStore();
// Good: const specificValue = useAppStore((s) => s.specificValue);
```

## Vite Build Optimization

### Code Splitting

```typescript
// vite.config.mts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          editor: ['@uiw/react-codemirror', '@codemirror/lang-xml'],
        },
      },
    },
  },
});
```

### Dynamic Imports

```typescript
// Lazy load heavy components
const TerminalView = lazy(() => import('./components/views/TerminalView'));
const FlowView = lazy(() => import('./components/views/FlowView'));

// Use Suspense with fallback
<Suspense fallback={<LoadingSpinner />}>
  <TerminalView />
</Suspense>
```

## Express Backend Performance

### Response Compression

```typescript
import compression from 'compression';
app.use(compression());
```

### Request Caching

```typescript
// Cache expensive operations
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

function getCached<T>(key: string, fetchFn: () => T): T {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### Async Operations

```typescript
// Use Promise.all for parallel operations
const [features, settings, sessions] = await Promise.all([
  loadFeatures(projectPath),
  loadSettings(),
  loadSessions(),
]);
```

## WebSocket Optimization

### Message Batching

```typescript
// Batch multiple updates
const pendingUpdates: Update[] = [];
let batchTimeout: NodeJS.Timeout | null = null;

function queueUpdate(update: Update) {
  pendingUpdates.push(update);
  if (!batchTimeout) {
    batchTimeout = setTimeout(flushUpdates, 16); // ~60fps
  }
}

function flushUpdates() {
  ws.send(JSON.stringify({ type: 'batch', updates: pendingUpdates }));
  pendingUpdates.length = 0;
  batchTimeout = null;
}
```

### Binary Protocol for Large Data

```typescript
// Use binary for large payloads
if (data.length > 10000) {
  ws.send(Buffer.from(JSON.stringify(data)), { binary: true });
}
```

## xterm.js Terminal Performance

### WebGL Renderer

```typescript
import { WebglAddon } from '@xterm/addon-webgl';

const terminal = new Terminal({
  fontFamily: 'Geist Mono, monospace',
  fontSize: 14,
  scrollback: 5000, // Limit scrollback for memory
});

// Use WebGL for better performance
const webglAddon = new WebglAddon();
terminal.loadAddon(webglAddon);
```

### Efficient Output Handling

```typescript
// Batch terminal writes
let writeBuffer = '';
let writeTimeout: NodeJS.Timeout | null = null;

function writeToTerminal(data: string) {
  writeBuffer += data;
  if (!writeTimeout) {
    writeTimeout = setTimeout(() => {
      terminal.write(writeBuffer);
      writeBuffer = '';
      writeTimeout = null;
    }, 16);
  }
}
```

## Electron Performance

### Renderer Process Optimization

```typescript
// Offload heavy work to main process
ipcRenderer.invoke('heavy-computation', data);

// Use Web Workers for CPU-intensive tasks
const worker = new Worker(new URL('./worker.ts', import.meta.url));
```

### Memory Management

```typescript
// Clean up unused windows
win.on('closed', () => {
  win = null;
});

// Limit window memory
new BrowserWindow({
  webPreferences: {
    backgroundThrottling: true,
  },
});
```

## Node.js Memory Management

### Stream Large Files

```typescript
// Don't load entire file into memory
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

await pipeline(createReadStream(filePath), createWriteStream(destPath));
```

### Process Pool for node-pty

```typescript
// Limit concurrent terminal processes
import pLimit from 'p-limit';
const limit = pLimit(10);

const createTerminal = limit(async () => {
  return pty.spawn(shell, [], options);
});
```

## Bundle Analysis

```bash
# Analyze bundle size
npx vite-bundle-visualizer

# Check for duplicate dependencies
npx npm-dedupe
```

## Performance Checklist

- [ ] React components memoized where needed
- [ ] TanStack Query caching configured
- [ ] Zustand selectors used (no full store selection)
- [ ] Code splitting with dynamic imports
- [ ] WebGL enabled for xterm.js
- [ ] WebSocket messages batched
- [ ] Express responses compressed
- [ ] Large files streamed
- [ ] Process pool limits set
