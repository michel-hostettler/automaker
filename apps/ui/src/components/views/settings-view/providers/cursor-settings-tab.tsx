import { useState, useEffect, useCallback } from 'react';
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
import { getHttpApiClient } from '@/lib/http-api-client';
import { useAppStore } from '@/store/app-store';
import type { CursorModelId, CursorModelConfig, CursorCliConfig } from '@automaker/types';
import { CURSOR_MODEL_MAP } from '@automaker/types';

interface CursorStatus {
  installed: boolean;
  version?: string;
  authenticated: boolean;
  method?: string;
}

export function CursorSettingsTab() {
  const { currentProject } = useAppStore();
  const [status, setStatus] = useState<CursorStatus | null>(null);
  const [config, setConfig] = useState<CursorCliConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<CursorModelConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = getHttpApiClient();
      const statusResult = await api.setup.getCursorStatus();

      if (statusResult.success) {
        setStatus({
          installed: statusResult.installed ?? false,
          version: statusResult.version ?? undefined,
          authenticated: statusResult.auth?.authenticated ?? false,
          method: statusResult.auth?.method,
        });
      }

      // Only load config if we have a project path
      if (currentProject?.path) {
        const configResult = await api.setup.getCursorConfig(currentProject.path);
        if (configResult.success) {
          setConfig({
            defaultModel: configResult.config?.defaultModel as CursorModelId | undefined,
            models: configResult.config?.models as CursorModelId[] | undefined,
            mcpServers: configResult.config?.mcpServers,
            rules: configResult.config?.rules,
          });
          if (configResult.availableModels) {
            setAvailableModels(configResult.availableModels as CursorModelConfig[]);
          } else {
            setAvailableModels(Object.values(CURSOR_MODEL_MAP));
          }
        } else {
          // Set defaults if no config
          setAvailableModels(Object.values(CURSOR_MODEL_MAP));
        }
      } else {
        // No project, just show available models
        setAvailableModels(Object.values(CURSOR_MODEL_MAP));
      }
    } catch (error) {
      console.error('Failed to load Cursor settings:', error);
      toast.error('Failed to load Cursor settings');
    } finally {
      setIsLoading(false);
    }
  }, [currentProject?.path]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDefaultModelChange = async (model: CursorModelId) => {
    if (!currentProject?.path) {
      toast.error('No project selected');
      return;
    }

    setIsSaving(true);
    try {
      const api = getHttpApiClient();
      const result = await api.setup.setCursorDefaultModel(currentProject.path, model);

      if (result.success) {
        setConfig((prev) => (prev ? { ...prev, defaultModel: model } : { defaultModel: model }));
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
    if (!currentProject?.path) {
      toast.error('No project selected');
      return;
    }

    const currentModels = config?.models || ['auto'];
    const newModels = enabled
      ? [...currentModels, model]
      : currentModels.filter((m) => m !== model);

    setIsSaving(true);
    try {
      const api = getHttpApiClient();
      const result = await api.setup.setCursorModels(currentProject.path, newModels);

      if (result.success) {
        setConfig((prev) => (prev ? { ...prev, models: newModels } : { models: newModels }));
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
      {status?.installed && currentProject && (
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
                value={config?.defaultModel || 'auto'}
                onValueChange={(v) => handleDefaultModelChange(v as CursorModelId)}
                disabled={isSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(config?.models || ['auto']).map((modelId) => {
                    const model = CURSOR_MODEL_MAP[modelId as CursorModelId];
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
                  const isEnabled = config?.models?.includes(model.id) ?? model.id === 'auto';
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

      {/* No Project Selected */}
      {status?.installed && !currentProject && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No project selected.</p>
            <p className="text-sm mt-2">Select a project to configure Cursor models.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CursorSettingsTab;
