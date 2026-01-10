---
name: agentic-jumpstart-security
description: Security best practices for Express/Node.js backend with WebSocket, Electron desktop app, and Claude AI integration. Use when writing secure code, reviewing security concerns, handling authentication, API keys, input validation, XSS prevention, CORS configuration, or when the user mentions security, vulnerabilities, authentication, or authorization.
---

# Security Best Practices

## Authentication & Authorization

### API Key Management

- Store API keys in environment variables, never in code
- Use `credentials.json` in DATA_DIR for persistent storage
- Validate API keys on every request via middleware
- Support multiple auth methods: API key, session token, CLI auth

### Session Management

- Generate cryptographically secure session tokens using `crypto.randomUUID()`
- Store sessions with expiration timestamps
- Clean up expired sessions regularly
- Use httpOnly cookies where applicable

## Input Validation

### Express Routes

```typescript
// Always validate and sanitize input
const sanitizedPath = path.normalize(userInput).replace(/^(\.\.(\/|\\|$))+/, '');

// Validate against allowed directories
if (!sanitizedPath.startsWith(ALLOWED_ROOT_DIRECTORY)) {
  throw new Error('Access denied');
}
```

### Path Traversal Prevention

- Use `path.normalize()` to resolve path components
- Check paths against `ALLOWED_ROOT_DIRECTORY`
- Never trust user-provided file paths directly
- Use the `@automaker/platform` package for secure path operations

## WebSocket Security

### Connection Validation

```typescript
wss.on('connection', (ws, req) => {
  // Validate origin
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    ws.close(1008, 'Origin not allowed');
    return;
  }

  // Authenticate connection
  const token = extractToken(req);
  if (!isValidToken(token)) {
    ws.close(1008, 'Authentication required');
    return;
  }
});
```

### Message Validation

- Validate all incoming WebSocket messages
- Use JSON schema validation for message structure
- Rate limit message frequency per connection

## CORS Configuration

```typescript
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3007',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);
```

## Electron Security

### Context Isolation

```typescript
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

### IPC Security

- Validate all IPC messages
- Use `contextBridge` for safe API exposure
- Never expose Node.js APIs directly to renderer

## Docker Security

### Container Isolation

- Run as non-root user (`automaker`)
- Use `gosu` for privilege dropping
- No privileged mode
- No host network access
- Named volumes only (no host mounts in production)

### File Permissions

```bash
# Fix permissions in entrypoint
chown -R automaker:automaker /projects
chmod 700 /home/automaker/.claude
chmod 600 /home/automaker/.claude/.credentials.json
```

## Claude AI Integration Security

### API Key Protection

- Never log API keys
- Mask keys in error messages
- Use CLI auth (`claude login`) when possible
- Store OAuth credentials securely

### Agent Sandboxing

- Restrict agent file access to project directories
- Validate all tool calls
- Log agent actions for audit

## XSS Prevention (React)

```typescript
// Use React's built-in escaping
<div>{userContent}</div>  // Safe

// For markdown, use rehype-sanitize
import rehypeSanitize from 'rehype-sanitize';
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
  {markdown}
</ReactMarkdown>
```

## Secrets Management

### Environment Variables

- `ANTHROPIC_API_KEY` - Claude API access
- `AUTOMAKER_API_KEY` - Internal API authentication
- `CLAUDE_OAUTH_CREDENTIALS` - CLI OAuth tokens
- `CURSOR_AUTH_TOKEN` - Cursor integration

### .gitignore Requirements

```
.env
.env.local
.env.*.local
credentials.json
*.pem
*.key
```

## Security Checklist

- [ ] All user input validated and sanitized
- [ ] API keys stored in environment variables
- [ ] CORS properly configured
- [ ] WebSocket connections authenticated
- [ ] Electron context isolation enabled
- [ ] Docker runs as non-root user
- [ ] File paths validated against allowed directories
- [ ] No secrets in code or logs
