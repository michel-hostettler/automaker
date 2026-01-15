import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import {
  Rocket,
  Play,
  Square,
  RefreshCw,
  Settings2,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  Brain,
} from 'lucide-react';
import type { DeploymentConfig, DeploymentResult } from '@automaker/types';

const API_BASE = '/api/deployment';

export function DeploymentView() {
  const { currentProject } = useAppStore();
  const [config, setConfig] = useState<DeploymentConfig | null>(null);
  const [configExists, setConfigExists] = useState(false);
  const [deployment, setDeployment] = useState<DeploymentResult | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState<string>('');

  // Load config and status
  const loadData = useCallback(async () => {
    if (!currentProject?.path) return;

    try {
      // Load config
      const configRes = await fetch(
        `${API_BASE}/config?projectPath=${encodeURIComponent(currentProject.path)}`
      );
      const configData = await configRes.json();
      if (configData.success) {
        setConfig(configData.config);
        setConfigExists(configData.exists);
        setEditedConfig(JSON.stringify(configData.config, null, 2));
      }

      // Load status
      const statusRes = await fetch(`${API_BASE}/status`);
      const statusData = await statusRes.json();
      if (statusData.success) {
        setDeployment(statusData.deployment);
        setIsDeploying(statusData.isRunning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deployment data');
    }
  }, [currentProject?.path]);

  useEffect(() => {
    loadData();
    // Poll for status updates while deploying
    const interval = setInterval(() => {
      if (isDeploying) {
        loadData();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [loadData, isDeploying]);

  // Save config
  const handleSaveConfig = async () => {
    if (!currentProject?.path) return;

    try {
      const parsedConfig = JSON.parse(editedConfig);
      const res = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: currentProject.path,
          config: parsedConfig,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(parsedConfig);
        setConfigExists(true);
        setIsEditing(false);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  // Start deployment
  const handleDeploy = async () => {
    if (!currentProject?.path) return;

    try {
      setIsDeploying(true);
      setError(null);
      const res = await fetch(`${API_BASE}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: currentProject.path }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        setIsDeploying(false);
      }
      // Status will be updated by polling
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start deployment');
      setIsDeploying(false);
    }
  };

  // Cancel deployment
  const handleCancel = async () => {
    try {
      const res = await fetch(`${API_BASE}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsDeploying(false);
        loadData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  // Generate config based on project analysis
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleGenerateConfig = async (useAI: boolean = false) => {
    if (!currentProject?.path) return;

    try {
      if (useAI) {
        setIsGeneratingAI(true);
      } else {
        setIsGenerating(true);
      }
      setError(null);

      const endpoint = useAI ? `${API_BASE}/generate-ai` : `${API_BASE}/generate`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: currentProject.path }),
      });
      const data = await res.json();

      if (data.success) {
        setEditedConfig(JSON.stringify(data.config, null, 2));
        setIsEditing(true);
      } else {
        setError(data.error || 'Failed to generate configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate configuration');
    } finally {
      setIsGenerating(false);
      setIsGeneratingAI(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a project to configure deployment
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden content-bg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Rocket className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Deployment</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 rounded-md hover:bg-accent" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Status section */}
      {deployment && (
        <div className="mb-6 p-4 rounded-lg border bg-card">
          <h2 className="text-lg font-medium mb-3">Current Deployment</h2>
          <div className="flex items-center gap-3 mb-2">
            {deployment.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {deployment.status === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
            {isDeploying && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
            <span className="font-medium capitalize">{deployment.status}</span>
            <span className="text-muted-foreground text-sm">
              ({deployment.trigger === 'auto_mode_complete' ? 'Auto' : 'Manual'})
            </span>
          </div>
          <div className="text-sm text-muted-foreground mb-2">
            <span>Started: {new Date(deployment.startedAt).toLocaleString()}</span>
            {deployment.finishedAt && (
              <span className="ml-4">
                Finished: {new Date(deployment.finishedAt).toLocaleString()}
              </span>
            )}
          </div>
          {deployment.error && (
            <div className="text-sm text-destructive mt-2">{deployment.error}</div>
          )}
          {deployment.e2eResult && (
            <div className="text-sm mt-2">
              E2E Tests: {deployment.e2eResult.status}
              {deployment.e2eResult.passed !== undefined && (
                <span className="text-muted-foreground ml-2">
                  ({deployment.e2eResult.passed} passed, {deployment.e2eResult.failed} failed)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        {!isDeploying ? (
          <button
            onClick={handleDeploy}
            disabled={!configExists}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Deploy Now
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Square className="h-4 w-4" />
            Cancel
          </button>
        )}
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-2 px-4 py-2 rounded-md border hover:bg-accent"
        >
          <Settings2 className="h-4 w-4" />
          {isEditing ? 'Cancel Edit' : 'Edit Config'}
        </button>
        {!configExists && (
          <>
            <button
              onClick={() => handleGenerateConfig(false)}
              disabled={isGenerating || isGeneratingAI}
              className="flex items-center gap-2 px-4 py-2 rounded-md border hover:bg-accent disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? 'Analyzing...' : 'Quick Generate'}
            </button>
            <button
              onClick={() => handleGenerateConfig(true)}
              disabled={isGenerating || isGeneratingAI}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isGeneratingAI ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              {isGeneratingAI ? 'AI Analyzing...' : 'Generate with AI'}
            </button>
          </>
        )}
      </div>

      {/* Config editor */}
      {isEditing ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-medium">Edit Configuration</h2>
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save
            </button>
          </div>
          <textarea
            value={editedConfig}
            onChange={(e) => setEditedConfig(e.target.value)}
            className="flex-1 p-3 rounded-md border bg-background font-mono text-sm resize-none"
            spellCheck={false}
          />
        </div>
      ) : config ? (
        <div className="flex-1 overflow-auto">
          <h2 className="text-lg font-medium mb-3">Configuration</h2>
          <div className="space-y-4">
            {/* Auto deploy toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoDeploy"
                checked={config.autoDeployOnComplete}
                onChange={async (e) => {
                  const newConfig = { ...config, autoDeployOnComplete: e.target.checked };
                  setConfig(newConfig);
                  setEditedConfig(JSON.stringify(newConfig, null, 2));
                  // Auto-save
                  const res = await fetch(`${API_BASE}/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      projectPath: currentProject.path,
                      config: newConfig,
                    }),
                  });
                  const data = await res.json();
                  if (!data.success) setError(data.error);
                }}
                className="h-4 w-4"
              />
              <label htmlFor="autoDeploy" className="text-sm">
                Auto-deploy when all Auto-Mode features complete
              </label>
            </div>

            {/* Build steps */}
            <div>
              <h3 className="font-medium mb-2">Build Steps ({config.buildSteps.length})</h3>
              <div className="space-y-1">
                {config.buildSteps.map((step, i) => (
                  <div key={i} className="text-sm text-muted-foreground">
                    {i + 1}. {step.name}:{' '}
                    <code className="text-xs bg-muted px-1 rounded">{step.command}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Deploy steps */}
            <div>
              <h3 className="font-medium mb-2">Deploy Steps ({config.deploySteps.length})</h3>
              <div className="space-y-1">
                {config.deploySteps.map((step, i) => (
                  <div key={i} className="text-sm text-muted-foreground">
                    {i + 1}. {step.name}:{' '}
                    <code className="text-xs bg-muted px-1 rounded">{step.command}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Health check */}
            {config.healthCheckUrl && (
              <div>
                <h3 className="font-medium mb-1">Health Check</h3>
                <div className="text-sm text-muted-foreground">
                  URL:{' '}
                  <code className="text-xs bg-muted px-1 rounded">{config.healthCheckUrl}</code>
                </div>
              </div>
            )}

            {/* E2E tests */}
            {config.e2eTests && (
              <div>
                <h3 className="font-medium mb-1">E2E Tests</h3>
                <div className="text-sm text-muted-foreground">
                  Command:{' '}
                  <code className="text-xs bg-muted px-1 rounded">{config.e2eTests.command}</code>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="mb-4">No deployment configuration found.</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleGenerateConfig(false)}
                disabled={isGenerating || isGeneratingAI}
                className="flex items-center gap-2 px-4 py-2 rounded-md border hover:bg-accent disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating ? 'Analyzing...' : 'Quick Generate'}
              </button>
              <button
                onClick={() => handleGenerateConfig(true)}
                disabled={isGenerating || isGeneratingAI}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isGeneratingAI ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
                {isGeneratingAI ? 'AI Analyzing...' : 'Generate with AI'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
