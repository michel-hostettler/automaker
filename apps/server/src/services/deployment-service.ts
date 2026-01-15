/**
 * Deployment Service - Handles dev deployment and E2E testing
 *
 * Provides:
 * - Deployment configuration management (.automaker/deployment.json)
 * - Build step execution
 * - Deploy step execution
 * - Health check waiting
 * - E2E test execution
 * - Event streaming for real-time UI updates
 */

import path from 'path';
import { spawn } from 'child_process';
import { createLogger } from '@automaker/utils';
import * as secureFs from '../lib/secure-fs.js';
import { ensureAutomakerDir } from '@automaker/platform';
import type {
  DeploymentConfig,
  DeploymentResult,
  DeploymentStatus,
  DeploymentEvent,
  DeploymentEventType,
  StepResult,
  E2ETestResult,
  DeploymentStep,
} from '@automaker/types';
import { DEFAULT_DEPLOYMENT_CONFIG } from '@automaker/types';
import type { EventEmitter } from '../lib/events.js';

const logger = createLogger('DeploymentService');

/**
 * Atomic file write - write to temp file then rename
 */
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  const content = JSON.stringify(data, null, 2);

  try {
    await secureFs.writeFile(tempPath, content, 'utf-8');
    await secureFs.rename(tempPath, filePath);
  } catch (error) {
    try {
      await secureFs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Safely read JSON file with fallback to default
 */
async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = (await secureFs.readFile(filePath, 'utf-8')) as string;
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultValue;
    }
    logger.error(`Error reading ${filePath}:`, error);
    return defaultValue;
  }
}

/**
 * Generate unique deployment ID
 */
function generateDeploymentId(): string {
  return `deploy_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Get the deployment config file path for a project
 */
function getDeploymentConfigPath(projectPath: string): string {
  return path.join(projectPath, '.automaker', 'deployment.json');
}

/**
 * Wait for a URL to be available
 */
async function waitForUrl(
  url: string,
  timeoutMs: number = 60000,
  intervalMs: number = 2000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok || response.status < 500) {
        return true;
      }
    } catch {
      // Connection failed, keep trying
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

/**
 * Execute a command and capture output
 */
async function executeCommand(
  command: string,
  workingDirectory: string,
  env: Record<string, string> = {},
  timeoutMs: number = 300000
): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/sh';
    const shellArgs = isWindows ? ['/c', command] : ['-c', command];

    const child = spawn(shell, shellArgs, {
      cwd: workingDirectory,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        success: false,
        output: stdout,
        error: `Command timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        success: code === 0,
        output: stdout + (stderr ? `\n[stderr]\n${stderr}` : ''),
        error: code !== 0 ? `Exit code: ${code}` : undefined,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        output: stdout,
        error: err.message,
      });
    });
  });
}

/**
 * DeploymentService - Manages deployment and E2E testing
 */
export class DeploymentService {
  private currentDeployment: DeploymentResult | null = null;
  private eventEmitter: EventEmitter | null = null;

  /**
   * Set event emitter for streaming deployment events
   */
  setEventEmitter(emitter: EventEmitter): void {
    this.eventEmitter = emitter;
  }

  /**
   * Emit deployment event
   */
  private emitEvent(type: DeploymentEventType, data?: DeploymentEvent['data']): void {
    if (!this.eventEmitter || !this.currentDeployment) return;

    const event: DeploymentEvent = {
      type,
      deploymentId: this.currentDeployment.id,
      timestamp: new Date().toISOString(),
      data,
    };

    this.eventEmitter.emit('deployment_event', event);
  }

  /**
   * Get deployment configuration for a project
   */
  async getDeploymentConfig(projectPath: string): Promise<DeploymentConfig> {
    const configPath = getDeploymentConfigPath(projectPath);
    const config = await readJsonFile<DeploymentConfig>(configPath, DEFAULT_DEPLOYMENT_CONFIG);

    return {
      ...DEFAULT_DEPLOYMENT_CONFIG,
      ...config,
    };
  }

  /**
   * Check if deployment config exists for a project
   */
  async hasDeploymentConfig(projectPath: string): Promise<boolean> {
    const configPath = getDeploymentConfigPath(projectPath);
    try {
      await secureFs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save deployment configuration
   */
  async saveDeploymentConfig(projectPath: string, config: DeploymentConfig): Promise<void> {
    await ensureAutomakerDir(projectPath);
    const configPath = getDeploymentConfigPath(projectPath);
    await atomicWriteJson(configPath, config);
    logger.info(`Deployment config saved for project: ${projectPath}`);
  }

  /**
   * Get current deployment status
   */
  getCurrentDeployment(): DeploymentResult | null {
    return this.currentDeployment;
  }

  /**
   * Check if a deployment is currently running
   */
  isDeploymentRunning(): boolean {
    return (
      this.currentDeployment !== null &&
      !['success', 'failed', 'idle'].includes(this.currentDeployment.status)
    );
  }

  /**
   * Execute a single deployment step
   */
  private async executeStep(
    step: DeploymentStep,
    projectPath: string,
    stepType: 'build' | 'deploy'
  ): Promise<StepResult> {
    const startTime = Date.now();
    const workDir = step.workingDirectory
      ? path.join(projectPath, step.workingDirectory)
      : projectPath;

    this.emitEvent(`${stepType}_step_started`, {
      stepName: step.name,
      status: 'running',
    });

    logger.info(`Executing ${stepType} step: ${step.name}`);

    const result = await executeCommand(
      step.command,
      workDir,
      step.env || {},
      step.timeout || 300000
    );

    const stepResult: StepResult = {
      stepName: step.name,
      status: result.success ? 'success' : 'failed',
      output: result.output,
      error: result.error,
      durationMs: Date.now() - startTime,
    };

    this.emitEvent(`${stepType}_step_completed`, {
      stepName: step.name,
      status: stepResult.status,
      output: stepResult.output,
      error: stepResult.error,
      result: stepResult,
    });

    return stepResult;
  }

  /**
   * Execute full deployment pipeline
   */
  async deploy(
    projectPath: string,
    trigger: 'manual' | 'auto_mode_complete',
    featureIds?: string[]
  ): Promise<DeploymentResult> {
    if (this.isDeploymentRunning()) {
      throw new Error('A deployment is already in progress');
    }

    const config = await this.getDeploymentConfig(projectPath);
    const deploymentId = generateDeploymentId();

    this.currentDeployment = {
      id: deploymentId,
      startedAt: new Date().toISOString(),
      status: 'building',
      buildResults: [],
      deployResults: [],
      trigger,
      featureIds,
    };

    this.emitEvent('deployment_started', {
      status: 'building',
    });

    logger.info(`Starting deployment ${deploymentId} (trigger: ${trigger})`);

    try {
      // Execute build steps
      for (const step of config.buildSteps) {
        const result = await this.executeStep(step, projectPath, 'build');
        this.currentDeployment.buildResults.push(result);

        if (result.status === 'failed' && !step.continueOnError) {
          throw new Error(`Build step failed: ${step.name}`);
        }
      }

      // Execute deploy steps
      this.currentDeployment.status = 'deploying';
      this.emitEvent('deployment_started', { status: 'deploying' });

      for (const step of config.deploySteps) {
        const result = await this.executeStep(step, projectPath, 'deploy');
        this.currentDeployment.deployResults.push(result);

        if (result.status === 'failed' && !step.continueOnError) {
          throw new Error(`Deploy step failed: ${step.name}`);
        }
      }

      // Wait for health check
      if (config.healthCheckUrl) {
        this.currentDeployment.status = 'waiting_for_health';
        this.emitEvent('health_check_started', {
          status: 'waiting',
        });

        const healthOk = await waitForUrl(
          config.healthCheckUrl,
          config.healthCheckTimeout || 30000
        );

        this.emitEvent('health_check_completed', {
          status: healthOk ? 'success' : 'failed',
        });

        if (!healthOk) {
          throw new Error(`Health check failed: ${config.healthCheckUrl} not available`);
        }
      }

      // Run E2E tests
      if (config.e2eTests) {
        this.currentDeployment.status = 'running_tests';
        this.emitEvent('e2e_started', { status: 'running' });

        const e2eResult = await this.runE2ETests(projectPath, config);
        this.currentDeployment.e2eResult = e2eResult;

        this.emitEvent('e2e_completed', {
          status: e2eResult.status,
          result: e2eResult,
        });

        if (e2eResult.status === 'failed') {
          throw new Error('E2E tests failed');
        }
      }

      // Success
      this.currentDeployment.status = 'success';
      this.currentDeployment.finishedAt = new Date().toISOString();

      this.emitEvent('deployment_completed', {
        status: 'success',
        result: this.currentDeployment,
      });

      logger.info(`Deployment ${deploymentId} completed successfully`);
    } catch (error) {
      this.currentDeployment.status = 'failed';
      this.currentDeployment.finishedAt = new Date().toISOString();
      this.currentDeployment.error = error instanceof Error ? error.message : String(error);

      this.emitEvent('deployment_failed', {
        status: 'failed',
        error: this.currentDeployment.error,
        result: this.currentDeployment,
      });

      logger.error(`Deployment ${deploymentId} failed:`, error);
    }

    return this.currentDeployment;
  }

  /**
   * Run E2E tests
   */
  private async runE2ETests(projectPath: string, config: DeploymentConfig): Promise<E2ETestResult> {
    if (!config.e2eTests) {
      return {
        status: 'skipped',
        output: 'No E2E tests configured',
        durationMs: 0,
      };
    }

    const e2eConfig = config.e2eTests;
    const startTime = Date.now();
    const workDir = e2eConfig.workingDirectory
      ? path.join(projectPath, e2eConfig.workingDirectory)
      : projectPath;

    // Wait for target URL if specified
    if (e2eConfig.waitForUrl) {
      const urlAvailable = await waitForUrl(e2eConfig.waitForUrl, e2eConfig.waitTimeout || 60000);

      if (!urlAvailable) {
        return {
          status: 'failed',
          output: `Target URL not available: ${e2eConfig.waitForUrl}`,
          error: 'Target URL timeout',
          durationMs: Date.now() - startTime,
        };
      }
    }

    logger.info(`Running E2E tests: ${e2eConfig.command}`);

    const result = await executeCommand(
      e2eConfig.command,
      workDir,
      e2eConfig.env || {},
      e2eConfig.timeout || 600000
    );

    // Try to parse test counts from output (common formats)
    let passed: number | undefined;
    let failed: number | undefined;
    let skipped: number | undefined;

    // Playwright format: "X passed, Y failed, Z skipped"
    const playwrightMatch = result.output.match(/(\d+) passed.*?(\d+) failed.*?(\d+) skipped/i);
    if (playwrightMatch) {
      passed = parseInt(playwrightMatch[1], 10);
      failed = parseInt(playwrightMatch[2], 10);
      skipped = parseInt(playwrightMatch[3], 10);
    }

    return {
      status: result.success ? 'passed' : 'failed',
      output: result.output,
      error: result.error,
      durationMs: Date.now() - startTime,
      passed,
      failed,
      skipped,
    };
  }

  /**
   * Cancel current deployment (if possible)
   */
  cancelDeployment(): void {
    if (this.currentDeployment && this.isDeploymentRunning()) {
      this.currentDeployment.status = 'failed';
      this.currentDeployment.finishedAt = new Date().toISOString();
      this.currentDeployment.error = 'Deployment cancelled by user';

      this.emitEvent('deployment_failed', {
        status: 'failed',
        error: 'Cancelled by user',
      });

      logger.info(`Deployment ${this.currentDeployment.id} cancelled`);
    }
  }

  /**
   * Get deployment history for a project
   * (Future: store history in .automaker/deployment-history.json)
   */
  async getDeploymentHistory(projectPath: string, limit: number = 10): Promise<DeploymentResult[]> {
    // For now, just return current deployment if exists
    // TODO: Implement persistent history
    return this.currentDeployment ? [this.currentDeployment] : [];
  }
}

// Export singleton instance
export const deploymentService = new DeploymentService();
