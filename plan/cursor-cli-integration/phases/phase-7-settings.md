# Phase 7: Settings View Provider Tabs

**Status:** `completed`
**Dependencies:** Phase 4 (Routes)
**Estimated Effort:** Medium (React components)

---

## Objective

Create a tabbed interface in Settings for managing different AI providers (Claude and Cursor), with provider-specific configuration options.

---

## Tasks

### Task 7.1: Create Cursor Settings Tab Component

**Status:** `completed`

**File:** `apps/ui/src/components/views/settings-view/providers/cursor-settings-tab.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Terminal, CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/http-api-client';
import {
  CursorModelId,
  CursorModelConfig,
  CursorCliConfig,
  CURSOR_MODEL_MAP,
} from '@automaker/types';

interface CursorStatus {
  installed: boolean;
  version?: string;
  authenticated: boolean;
  method?: string;
}

export function CursorSettingsTab() {
  const [status, setStatus] = useState<CursorStatus | null>(null);
  const [config, setConfig] = useState<CursorCliConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<CursorModelConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statusData, configData] = await Promise.all([
        api.setup.getCursorStatus(),
        api.setup.getCursorConfig(),
      ]);

      if (statusData.success) {
        setStatus({
          installed: statusData.installed ?? false,
          version: statusData.version,
          authenticated: statusData.auth?.authenticated ?? false,
          method: statusData.auth?.method,
        });
      }

      if (configData.success) {
        setConfig(configData.config);
        setAvailableModels(configData.availableModels || Object.values(CURSOR_MODEL_MAP));
      }
    } catch (error) {
      console.error('Failed to load Cursor settings:', error);
      toast.error('Failed to load Cursor settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDefaultModelChange = async (model: CursorModelId) => {
    if (!config) return;

    setIsSaving(true);
    try {
      const result = await api.setup.setCursorDefaultModel(model);

      if (result.success) {
        setConfig({ ...config, defaultModel: model });
        toast.success('Default model updated');
      } else {
        toast.error(result.error || 'Failed to update default model');
      }
    } catch (error) {
      toast.error('Failed to update default model');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModelToggle = async (model: CursorModelId, enabled: boolean) => {
    if (!config) return;

    const newModels = enabled
      ? [...(config.models || []), model]
      : (config.models || []).filter((m) => m !== model);

    setIsSaving(true);
    try {
      const result = await api.setup.setCursorModels(newModels);

      if (result.success) {
        setConfig({ ...config, models: newModels });
      } else {
        toast.error(result.error || 'Failed to update models');
      }
    } catch (error) {
      toast.error('Failed to update models');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal className="w-5 h-5" />
            Cursor CLI Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Installation */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Installation</span>
            {status?.installed ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-mono">v{status.version}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="w-4 h-4" />
                <span className="text-xs">Not installed</span>
              </div>
            )}
          </div>

          {/* Authentication */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Authentication</span>
            {status?.authenticated ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs capitalize">
                  {status.method === 'api_key' ? 'API Key' : 'Browser Login'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <XCircle className="w-4 h-4" />
                <span className="text-xs">Not authenticated</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>
            {!status?.installed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://cursor.com/docs/cli', '_blank')}
              >
                Installation Guide
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Model Configuration */}
      {status?.installed && config && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Model Configuration</CardTitle>
            <CardDescription>
              Configure which Cursor models are available and set the default
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Default Model */}
            <div className="space-y-2">
              <Label>Default Model</Label>
              <Select
                value={config.defaultModel || 'auto'}
                onValueChange={(v) => handleDefaultModelChange(v as CursorModelId)}
                disabled={isSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(config.models || ['auto']).map((modelId) => {
                    const model = CURSOR_MODEL_MAP[modelId];
                    if (!model) return null;
                    return (
                      <SelectItem key={modelId} value={modelId}>
                        <div className="flex items-center gap-2">
                          <span>{model.label}</span>
                          {model.hasThinking && (
                            <Badge variant="outline" className="text-xs">
                              Thinking
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Enabled Models */}
            <div className="space-y-3">
              <Label>Available Models</Label>
              <div className="grid gap-3">
                {availableModels.map((model) => {
                  const isEnabled = config.models?.includes(model.id) ?? false;
                  const isAuto = model.id === 'auto';

                  return (
                    <div
                      key={model.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleModelToggle(model.id, !!checked)}
                          disabled={isSaving || isAuto}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{model.label}</span>
                            {model.hasThinking && (
                              <Badge variant="outline" className="text-xs">
                                Thinking
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{model.description}</p>
                        </div>
                      </div>
                      <Badge variant={model.tier === 'free' ? 'default' : 'secondary'}>
                        {model.tier}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not Installed State */}
      {!status?.installed && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Cursor CLI is not installed.</p>
            <p className="text-sm mt-2">Install it to use Cursor models in AutoMaker.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CursorSettingsTab;
```

### Task 7.2: Create Provider Tabs Container

**Status:** `completed`

**File:** `apps/ui/src/components/views/settings-view/providers/provider-tabs.tsx`

```tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Terminal } from 'lucide-react';
import { CursorSettingsTab } from './cursor-settings-tab';
import { ClaudeSettingsTab } from './claude-settings-tab';

interface ProviderTabsProps {
  defaultTab?: 'claude' | 'cursor';
}

export function ProviderTabs({ defaultTab = 'claude' }: ProviderTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="claude" className="flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Claude
        </TabsTrigger>
        <TabsTrigger value="cursor" className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          Cursor
        </TabsTrigger>
      </TabsList>

      <TabsContent value="claude">
        <ClaudeSettingsTab />
      </TabsContent>

      <TabsContent value="cursor">
        <CursorSettingsTab />
      </TabsContent>
    </Tabs>
  );
}

export default ProviderTabs;
```

### Task 7.3: Create Claude Settings Tab (if not exists)

**Status:** `completed`

**File:** `apps/ui/src/components/views/settings-view/providers/claude-settings-tab.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/http-api-client';

interface ClaudeStatus {
  installed: boolean;
  version?: string;
  authenticated: boolean;
  method?: string;
}

export function ClaudeSettingsTab() {
  const [status, setStatus] = useState<ClaudeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const result = await api.setup.getClaudeStatus();

      if (result.success) {
        setStatus({
          installed: result.installed ?? true,
          version: result.version,
          authenticated: result.authenticated ?? false,
          method: result.method,
        });
      }
    } catch (error) {
      console.error('Failed to load Claude status:', error);
      toast.error('Failed to load Claude status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="w-5 h-5" />
            Claude Status
          </CardTitle>
          <CardDescription>Claude is the primary AI provider for AutoMaker</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">SDK Status</span>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs">Active</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Authentication</span>
            {status?.authenticated ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs capitalize">{status.method}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <XCircle className="w-4 h-4" />
                <span className="text-xs">Not authenticated</span>
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={loadStatus}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Status
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default ClaudeSettingsTab;
```

### Task 7.4: Update Settings View Navigation

**Status:** `completed`

**File:** `apps/ui/src/components/views/settings-view/config/navigation.ts`

Add or update providers section:

```typescript
export const SETTINGS_NAVIGATION = [
  // Existing sections...
  {
    id: 'providers',
    label: 'AI Providers',
    icon: 'bot',
    description: 'Configure Claude and Cursor AI providers',
  },
  // ... other sections
];
```

### Task 7.5: Integrate Provider Tabs in Settings

**Status:** `completed`

Update the settings view to render ProviderTabs for the providers section.

---

## Verification

### Test 1: Tab Switching

1. Navigate to Settings → Providers
2. Click on "Claude" tab
3. Verify Claude settings are displayed
4. Click on "Cursor" tab
5. Verify Cursor settings are displayed

### Test 2: Cursor Status Display

1. With Cursor CLI installed: verify version is shown
2. With Cursor authenticated: verify green checkmark
3. Without Cursor installed: verify "Not installed" state

### Test 3: Model Selection

1. Enable/disable models via checkboxes
2. Verify changes persist after refresh
3. Change default model
4. Verify default is highlighted in selector

### Test 4: Responsive Design

1. Test on different screen sizes
2. Verify tabs are usable on mobile
3. Verify model list scrolls properly

---

## Verification Checklist

Before marking this phase complete:

- [ ] ProviderTabs component renders correctly
- [ ] Tab switching works smoothly
- [ ] CursorSettingsTab shows correct status
- [ ] ClaudeSettingsTab shows correct status
- [ ] Model checkboxes toggle state
- [ ] Default model selector works
- [ ] Settings persist after page refresh
- [ ] Loading states displayed
- [ ] Error states handled gracefully
- [ ] Settings navigation includes providers

---

## Files Changed

| File                                                                           | Action | Description   |
| ------------------------------------------------------------------------------ | ------ | ------------- |
| `apps/ui/src/components/views/settings-view/providers/cursor-settings-tab.tsx` | Create | Cursor config |
| `apps/ui/src/components/views/settings-view/providers/claude-settings-tab.tsx` | Create | Claude config |
| `apps/ui/src/components/views/settings-view/providers/provider-tabs.tsx`       | Create | Tab container |
| `apps/ui/src/components/views/settings-view/config/navigation.ts`              | Modify | Add section   |

---

## Design Notes

- Tabs use consistent icons (Bot for Claude, Terminal for Cursor)
- Model cards show tier badges (free/pro)
- Thinking models have a "Thinking" badge
- The "auto" model cannot be disabled
- Settings auto-save on change (no explicit save button)
