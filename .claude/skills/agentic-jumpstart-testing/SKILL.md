---
name: agentic-jumpstart-testing
description: Testing patterns with Playwright for E2E tests and Vitest for unit tests. Use when writing tests, test patterns, mocking, assertions, or when the user mentions testing, tests, Playwright, Vitest, E2E, unit tests, coverage, or TDD.
---

# Testing Patterns

## Test Commands

```bash
# E2E tests (Playwright)
npm run test                # Headless
npm run test:headed         # With browser visible

# Unit tests (Vitest)
npm run test:server         # Server unit tests
npm run test:packages       # Shared package tests
npm run test:all            # All unit tests

# Single test file
npm run test:server -- tests/unit/specific.test.ts
```

## Playwright E2E Tests

### Test Structure

```typescript
// tests/e2e/features.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Feature Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should create a new feature', async ({ page }) => {
    // Click add button
    await page.getByRole('button', { name: 'Add Feature' }).click();

    // Fill form
    await page.getByLabel('Title').fill('New Feature');
    await page.getByLabel('Description').fill('Feature description');

    // Submit
    await page.getByRole('button', { name: 'Create' }).click();

    // Assert
    await expect(page.getByText('New Feature')).toBeVisible();
  });

  test('should drag and drop feature to new column', async ({ page }) => {
    const feature = page.getByTestId('feature-card').first();
    const targetColumn = page.getByTestId('column-in-progress');

    await feature.dragTo(targetColumn);

    await expect(targetColumn.getByTestId('feature-card')).toHaveCount(1);
  });
});
```

### Page Object Model

```typescript
// tests/e2e/pages/BoardPage.ts
import { Page, Locator } from '@playwright/test';

export class BoardPage {
  readonly page: Page;
  readonly addButton: Locator;
  readonly featureCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByRole('button', { name: 'Add Feature' });
    this.featureCards = page.getByTestId('feature-card');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async createFeature(title: string, description: string) {
    await this.addButton.click();
    await this.page.getByLabel('Title').fill(title);
    await this.page.getByLabel('Description').fill(description);
    await this.page.getByRole('button', { name: 'Create' }).click();
  }

  async getFeatureCount() {
    return this.featureCards.count();
  }
}

// Usage
test('using page object', async ({ page }) => {
  const board = new BoardPage(page);
  await board.goto();
  await board.createFeature('Test', 'Description');
  expect(await board.getFeatureCount()).toBe(1);
});
```

### API Mocking

```typescript
test('should handle API errors gracefully', async ({ page }) => {
  // Mock API response
  await page.route('**/api/features', (route) => {
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Server error' }),
    });
  });

  await page.goto('/');

  await expect(page.getByText('Failed to load features')).toBeVisible();
});
```

### WebSocket Testing

```typescript
test('should receive real-time updates', async ({ page }) => {
  await page.goto('/');

  // Wait for WebSocket connection
  await page.waitForFunction(() => {
    return (window as any).__wsConnected === true;
  });

  // Trigger update from another source (e.g., API call)
  await page.evaluate(async () => {
    await fetch('/api/features', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Feature' }),
    });
  });

  // Assert update received via WebSocket
  await expect(page.getByText('New Feature')).toBeVisible({ timeout: 5000 });
});
```

## Vitest Unit Tests

### Component Testing

```typescript
// src/components/Counter.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Counter } from './Counter';

describe('Counter', () => {
  it('renders initial count', () => {
    render(<Counter initialCount={5} />);
    expect(screen.getByText('Count: 5')).toBeInTheDocument();
  });

  it('increments count on click', async () => {
    render(<Counter initialCount={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'Increment' }));

    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });

  it('calls onChange when count changes', () => {
    const onChange = vi.fn();
    render(<Counter initialCount={0} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Increment' }));

    expect(onChange).toHaveBeenCalledWith(1);
  });
});
```

### Service Testing

```typescript
// tests/unit/FeatureLoader.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureLoader } from '../../src/services/FeatureLoader';
import * as fs from 'fs/promises';

vi.mock('fs/promises');

describe('FeatureLoader', () => {
  let loader: FeatureLoader;

  beforeEach(() => {
    loader = new FeatureLoader();
    vi.clearAllMocks();
  });

  it('should load features from directory', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['feature-1', 'feature-2'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        id: 'feature-1',
        title: 'Test Feature',
      })
    );

    const features = await loader.loadFeatures('/project');

    expect(features).toHaveLength(2);
    expect(features[0].title).toBe('Test Feature');
  });

  it('should handle missing directory', async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));

    const features = await loader.loadFeatures('/nonexistent');

    expect(features).toEqual([]);
  });
});
```

### Hook Testing

```typescript
// src/hooks/useFeatures.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { useFeatures } from './useFeatures';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useFeatures', () => {
  it('should fetch features', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ features: [{ id: '1', title: 'Test' }] }),
    } as Response);

    const { result } = renderHook(() => useFeatures('/project'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
  });
});
```

### Mocking Patterns

```typescript
// Mock module
vi.mock('@automaker/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock function
const mockFn = vi.fn().mockReturnValue('mocked');
const mockAsync = vi.fn().mockResolvedValue('async mocked');

// Spy on method
const spy = vi.spyOn(service, 'method');
expect(spy).toHaveBeenCalledWith('arg');

// Mock timers
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

## Test Configuration

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // or 'jsdom' for React
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'tests'],
    },
  },
});
```

### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3007',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev:web',
    url: 'http://localhost:3007',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Test Checklist

- [ ] Unit tests for services and utilities
- [ ] Component tests for React components
- [ ] Hook tests with QueryClient wrapper
- [ ] E2E tests for critical user flows
- [ ] API mocking for isolated tests
- [ ] WebSocket testing for real-time features
- [ ] Error handling tests
- [ ] Coverage thresholds met
