/**
 * Deployment configuration types
 * Stored in .automaker/deployment.json per project
 */

/**
 * Deployment step configuration
 */
export interface DeploymentStep {
  /** Step name for display */
  name: string;
  /** Command to execute */
  command: string;
  /** Working directory (relative to project root) */
  workingDirectory?: string;
  /** Environment variables for this step */
  env?: Record<string, string>;
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
  /** Continue to next step even if this fails */
  continueOnError?: boolean;
}

/**
 * E2E test configuration
 */
export interface E2ETestConfig {
  /** Command to run E2E tests */
  command: string;
  /** Working directory (relative to project root) */
  workingDirectory?: string;
  /** Wait for this URL to be available before running tests */
  waitForUrl?: string;
  /** Max time to wait for URL in ms (default: 60000) */
  waitTimeout?: number;
  /** Environment variables for tests */
  env?: Record<string, string>;
  /** Timeout for test execution in ms (default: 10 minutes) */
  timeout?: number;
}

/**
 * Full deployment configuration stored in .automaker/deployment.json
 */
export interface DeploymentConfig {
  /** Schema version for future migrations */
  version: number;
  /** Enable auto-deploy when all auto-mode features complete */
  autoDeployOnComplete: boolean;
  /** Build steps to run before deployment */
  buildSteps: DeploymentStep[];
  /** Deployment steps to run after build */
  deploySteps: DeploymentStep[];
  /** E2E test configuration (optional) */
  e2eTests?: E2ETestConfig;
  /** URL to check for deployment health */
  healthCheckUrl?: string;
  /** Timeout for health check in ms (default: 30000) */
  healthCheckTimeout?: number;
}

/**
 * Default deployment config
 */
export const DEFAULT_DEPLOYMENT_CONFIG: DeploymentConfig = {
  version: 1,
  autoDeployOnComplete: false,
  buildSteps: [],
  deploySteps: [],
};

/**
 * Deployment execution status
 */
export type DeploymentStatus =
  | 'idle'
  | 'building'
  | 'deploying'
  | 'waiting_for_health'
  | 'running_tests'
  | 'success'
  | 'failed';

/**
 * Step execution result
 */
export interface StepResult {
  stepName: string;
  status: 'success' | 'failed' | 'skipped';
  output: string;
  error?: string;
  durationMs: number;
}

/**
 * E2E test result
 */
export interface E2ETestResult {
  status: 'passed' | 'failed' | 'skipped';
  output: string;
  error?: string;
  durationMs: number;
  /** Number of tests passed */
  passed?: number;
  /** Number of tests failed */
  failed?: number;
  /** Number of tests skipped */
  skipped?: number;
}

/**
 * Full deployment execution result
 */
export interface DeploymentResult {
  /** Unique deployment ID */
  id: string;
  /** When deployment started */
  startedAt: string;
  /** When deployment finished */
  finishedAt?: string;
  /** Overall status */
  status: DeploymentStatus;
  /** Build step results */
  buildResults: StepResult[];
  /** Deploy step results */
  deployResults: StepResult[];
  /** E2E test results */
  e2eResult?: E2ETestResult;
  /** Overall error message if failed */
  error?: string;
  /** What triggered this deployment */
  trigger: 'manual' | 'auto_mode_complete';
  /** Feature IDs that were part of this deployment */
  featureIds?: string[];
}

/**
 * Deployment event types for WebSocket streaming
 */
export type DeploymentEventType =
  | 'deployment_started'
  | 'build_step_started'
  | 'build_step_completed'
  | 'deploy_step_started'
  | 'deploy_step_completed'
  | 'health_check_started'
  | 'health_check_completed'
  | 'e2e_started'
  | 'e2e_output'
  | 'e2e_completed'
  | 'deployment_completed'
  | 'deployment_failed';

/**
 * Deployment stream event
 */
export interface DeploymentEvent {
  type: DeploymentEventType;
  deploymentId: string;
  timestamp: string;
  data?: {
    stepName?: string;
    status?: string;
    output?: string;
    error?: string;
    result?: StepResult | E2ETestResult | DeploymentResult;
  };
}
