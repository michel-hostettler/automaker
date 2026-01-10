---
name: agentic-jumpstart-react
description: React 19 patterns with TanStack Router, TanStack Query, Zustand, Radix UI, Tailwind CSS 4, and TypeScript. Use when writing React components, hooks, state management, routing, data fetching, or when the user mentions React, components, hooks, state, UI, or frontend.
---

# React Development Patterns

## Project Structure

```
apps/ui/src/
├── components/
│   ├── ui/           # Radix UI primitives (button, dialog, etc.)
│   └── views/        # Main view components
├── routes/           # TanStack Router file-based routing
├── store/            # Zustand stores
├── hooks/            # Custom React hooks
└── lib/              # Utilities and API client
```

## Component Patterns

### Functional Components with TypeScript

```typescript
interface FeatureCardProps {
  feature: Feature;
  onSelect: (id: string) => void;
  isSelected?: boolean;
}

export function FeatureCard({ feature, onSelect, isSelected = false }: FeatureCardProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border",
        isSelected && "border-primary bg-primary/5"
      )}
      onClick={() => onSelect(feature.id)}
    >
      <h3 className="font-medium">{feature.title}</h3>
      <p className="text-sm text-muted-foreground">{feature.description}</p>
    </div>
  );
}
```

### Compound Components with Radix UI

```typescript
import * as Dialog from '@radix-ui/react-dialog';

export function ConfirmDialog({ trigger, title, description, onConfirm }: Props) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-6 rounded-lg">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-2">
            {description}
          </Dialog.Description>
          <div className="flex gap-2 mt-4 justify-end">
            <Dialog.Close asChild>
              <Button variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button onClick={onConfirm}>Confirm</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

## TanStack Router

### File-based Routes

```typescript
// routes/__root.tsx
export const Route = createRootRoute({
  component: RootLayout,
});

// routes/index.tsx
export const Route = createFileRoute('/')({
  component: HomePage,
});

// routes/project/$projectId.tsx
export const Route = createFileRoute('/project/$projectId')({
  component: ProjectPage,
  loader: ({ params }) => fetchProject(params.projectId),
});
```

### Navigation

```typescript
import { Link, useNavigate, useParams } from '@tanstack/react-router';

function Navigation() {
  const navigate = useNavigate();
  const { projectId } = useParams({ from: '/project/$projectId' });

  return (
    <nav>
      <Link to="/" className="[&.active]:text-primary">Home</Link>
      <Link to="/project/$projectId" params={{ projectId }}>Project</Link>
      <button onClick={() => navigate({ to: '/settings' })}>Settings</button>
    </nav>
  );
}
```

## TanStack Query

### Data Fetching

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query hook
export function useFeatures(projectPath: string) {
  return useQuery({
    queryKey: ['features', projectPath],
    queryFn: () => api.getFeatures(projectPath),
    staleTime: 5 * 60 * 1000,
  });
}

// Mutation with optimistic updates
export function useUpdateFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updateFeature,
    onMutate: async (newFeature) => {
      await queryClient.cancelQueries({ queryKey: ['features'] });
      const previous = queryClient.getQueryData(['features']);
      queryClient.setQueryData(['features'], (old) =>
        old?.map((f) => (f.id === newFeature.id ? newFeature : f))
      );
      return { previous };
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(['features'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
  });
}
```

## Zustand State Management

### Store Definition

```typescript
// store/app-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  selectedFeatureId: string | null;
  sidebarOpen: boolean;
  setSelectedFeature: (id: string | null) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedFeatureId: null,
      sidebarOpen: true,
      setSelectedFeature: (id) => set({ selectedFeatureId: id }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    { name: 'app-store' }
  )
);
```

### Using Selectors

```typescript
// Always use selectors for better performance
const selectedFeatureId = useAppStore((state) => state.selectedFeatureId);
const setSelectedFeature = useAppStore((state) => state.setSelectedFeature);

// NOT: const { selectedFeatureId, setSelectedFeature } = useAppStore();
```

## Tailwind CSS 4

### Class Utilities with cn()

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
<div className={cn(
  "p-4 rounded-lg",
  isActive && "bg-primary text-primary-foreground",
  className
)} />
```

### CSS Variables for Theming

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --muted-foreground: 215.4 16.3% 46.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

## Custom Hooks

### WebSocket Hook

```typescript
export function useWebSocket(url: string) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('disconnected');

    return () => ws.close();
  }, [url]);

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  return { status, send, ws: wsRef.current };
}
```

### Debounced Value Hook

```typescript
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

## Error Boundaries

```typescript
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="p-4 border border-destructive rounded-lg">
      <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
      <pre className="text-sm mt-2">{error.message}</pre>
      <Button onClick={resetErrorBoundary} className="mt-4">Try again</Button>
    </div>
  );
}

// Usage
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <FeatureList />
</ErrorBoundary>
```

## Import Conventions

```typescript
// UI components from local ui folder
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

// Hooks
import { useFeatures } from '@/hooks/useFeatures';

// Store
import { useAppStore } from '@/store/app-store';

// Types from shared package
import type { Feature } from '@automaker/types';
```
