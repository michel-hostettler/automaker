/**
 * Login View - Web mode authentication
 *
 * Prompts user to enter username and API key shown in server console.
 * On successful login, sets an HTTP-only session cookie.
 * Username is used to namespace localStorage for multi-user support.
 */

import { useState } from 'react';
import { login } from '@/lib/http-api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, AlertCircle, Loader2, User } from 'lucide-react';

export function LoginView() {
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login(apiKey.trim(), username.trim());
      if (result.success) {
        // Reload the page to reinitialize stores with username-namespaced storage
        // This ensures each user has their own localStorage namespace
        window.location.href = '/';
      } else {
        setError(result.error || 'Invalid API key or username');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Welcome to Automaker</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your username and the API key shown in the server console.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoFocus
              autoComplete="username"
              data-testid="login-username-input"
            />
            <p className="text-xs text-muted-foreground">
              Your username is used to save your preferences and session state.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="apiKey" className="text-sm font-medium">
              API Key
            </label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isLoading}
              className="font-mono"
              data-testid="login-api-key-input"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !apiKey.trim() || !username.trim()}
            data-testid="login-submit-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              'Login'
            )}
          </Button>
        </form>

        {/* Help Text */}
        <div className="rounded-lg border bg-muted/50 p-4 text-sm">
          <p className="font-medium">Where to find the API key:</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
            <li>Look at the server terminal/console output</li>
            <li>Find the box labeled "API Key for Web Mode Authentication"</li>
            <li>Copy the UUID displayed there</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
