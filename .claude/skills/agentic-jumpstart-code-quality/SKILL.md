---
name: agentic-jumpstart-code-quality
description: Code quality standards with ESLint 9, Prettier, TypeScript strict mode, and Husky git hooks. Use when writing clean code, fixing linting errors, formatting code, or when the user mentions linting, formatting, code style, ESLint, Prettier, TypeScript errors, or code quality.
---

# Code Quality Standards

## Commands

```bash
# Linting
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix ESLint issues

# Formatting
npm run format         # Format with Prettier
npm run format:check   # Check formatting
```

## ESLint 9 Configuration

### Flat Config (eslint.config.mjs)

```javascript
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',

      // React
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.js'],
  },
];
```

## Prettier Configuration

### .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### .prettierignore

```
dist/
node_modules/
package-lock.json
*.md
```

## TypeScript Configuration

### Strict Mode Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Git Hooks (Husky + lint-staged)

### Setup

```bash
npm install -D husky lint-staged
npx husky init
```

### .husky/pre-commit

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

### lint-staged.config.js

```javascript
export default {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml}': ['prettier --write'],
};
```

## Code Style Guidelines

### Naming Conventions

```typescript
// Components: PascalCase
export function FeatureCard() {}

// Hooks: camelCase with use prefix
export function useFeatures() {}

// Constants: UPPER_SNAKE_CASE
export const MAX_RETRIES = 3;

// Types/Interfaces: PascalCase
interface FeatureProps {}
type FeatureStatus = 'pending' | 'active';

// Files: kebab-case or PascalCase for components
// feature-loader.ts
// FeatureCard.tsx
```

### Import Organization

```typescript
// 1. External packages
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal packages
import type { Feature } from '@automaker/types';
import { createLogger } from '@automaker/utils';

// 3. Local imports
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';

// 4. Types (if separate)
import type { FeatureCardProps } from './types';
```

### Function Style

```typescript
// Prefer arrow functions for components
export const FeatureCard = ({ feature }: Props) => {
  return <div>{feature.title}</div>;
};

// Use function declaration for hooks
export function useFeatures(projectPath: string) {
  return useQuery({
    queryKey: ['features', projectPath],
    queryFn: () => fetchFeatures(projectPath),
  });
}

// Async functions
async function fetchFeatures(path: string): Promise<Feature[]> {
  const response = await fetch(`/api/features?path=${path}`);
  return response.json();
}
```

### Error Handling

```typescript
// Use try-catch with specific error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  if (error instanceof NotFoundError) {
    return null;
  }
  logger.error('Operation failed', error);
  throw error;
}

// Never catch and ignore
// ❌ Bad
try {
  doSomething();
} catch {}

// ✅ Good
try {
  doSomething();
} catch (error) {
  logger.warn('Non-critical operation failed', error);
}
```

### Type Assertions

```typescript
// Prefer type guards over assertions
// ❌ Avoid
const feature = data as Feature;

// ✅ Better
function isFeature(data: unknown): data is Feature {
  return typeof data === 'object' && data !== null && 'id' in data && 'title' in data;
}

if (isFeature(data)) {
  // data is typed as Feature
}
```

## Common ESLint Fixes

### Unused Variables

```typescript
// Use underscore prefix for intentionally unused
function handler(_event: Event, data: Data) {
  process(data);
}

// Or destructure what you need
const { id, title } = feature; // Instead of: const feature = ...
```

### Exhaustive Deps

```typescript
// Include all dependencies
useEffect(() => {
  fetchData(projectPath);
}, [projectPath]); // Include projectPath

// Use useCallback for stable references
const fetchData = useCallback(async () => {
  // ...
}, [dependency]);
```

### No Explicit Any

```typescript
// ❌ Avoid
function process(data: any) {}

// ✅ Better
function process(data: unknown) {
  if (typeof data === 'string') {
    // data is string
  }
}

// Or define proper type
interface ProcessData {
  id: string;
  value: number;
}
function process(data: ProcessData) {}
```

## Quality Checklist

- [ ] No ESLint errors or warnings
- [ ] No TypeScript errors
- [ ] Code formatted with Prettier
- [ ] No `any` types (use `unknown` if needed)
- [ ] All imports organized
- [ ] Meaningful variable/function names
- [ ] Error handling in async code
- [ ] No console.log (use logger)
- [ ] Types exported from @automaker/types
