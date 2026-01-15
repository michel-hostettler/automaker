/**
 * Deployment routes - Config management, deployment execution, and status
 *
 * Mounted at /api/deployment in the main server.
 */

import path from 'path';
import { Router } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { DeploymentConfig } from '@automaker/types';
import { deploymentService } from '../../services/deployment-service.js';
import { createLogger } from '@automaker/utils';
import { CLAUDE_MODEL_MAP } from '@automaker/model-resolver';
import * as secureFs from '../../lib/secure-fs.js';

const logger = createLogger('DeploymentRoutes');

/**
 * Create deployment routes
 */
export function createDeploymentRoutes(): Router {
  const router = Router();

  /**
   * GET /api/deployment/config
   *
   * Get deployment configuration for a project.
   * Query: { projectPath: string }
   */
  router.get('/config', async (req, res) => {
    try {
      const projectPath = req.query.projectPath as string;

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      const config = await deploymentService.getDeploymentConfig(projectPath);
      const hasConfig = await deploymentService.hasDeploymentConfig(projectPath);

      res.json({
        success: true,
        config,
        exists: hasConfig,
      });
    } catch (error) {
      logger.error('Error getting deployment config:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/deployment/config
   *
   * Save deployment configuration for a project.
   * Body: { projectPath: string, config: DeploymentConfig }
   */
  router.post('/config', async (req, res) => {
    try {
      const { projectPath, config } = req.body as {
        projectPath: string;
        config: DeploymentConfig;
      };

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      if (!config) {
        res.status(400).json({
          success: false,
          error: 'config is required',
        });
        return;
      }

      await deploymentService.saveDeploymentConfig(projectPath, config);

      res.json({
        success: true,
        message: 'Deployment config saved',
      });
    } catch (error) {
      logger.error('Error saving deployment config:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/deployment/deploy
   *
   * Start a deployment.
   * Body: { projectPath: string, featureIds?: string[] }
   */
  router.post('/deploy', async (req, res) => {
    try {
      const { projectPath, featureIds } = req.body as {
        projectPath: string;
        featureIds?: string[];
      };

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      // Check if deployment config exists
      const hasConfig = await deploymentService.hasDeploymentConfig(projectPath);
      if (!hasConfig) {
        res.status(400).json({
          success: false,
          error: 'No deployment configuration found. Please configure deployment first.',
        });
        return;
      }

      // Check if deployment is already running
      if (deploymentService.isDeploymentRunning()) {
        res.status(409).json({
          success: false,
          error: 'A deployment is already in progress',
        });
        return;
      }

      // Start deployment in background
      const result = deploymentService.deploy(projectPath, 'manual', featureIds);

      // Return immediately with deployment ID
      res.json({
        success: true,
        message: 'Deployment started',
        deploymentId: (await result).id,
      });
    } catch (error) {
      logger.error('Error starting deployment:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/deployment/status
   *
   * Get current deployment status.
   */
  router.get('/status', (_req, res) => {
    try {
      const deployment = deploymentService.getCurrentDeployment();
      const isRunning = deploymentService.isDeploymentRunning();

      res.json({
        success: true,
        isRunning,
        deployment,
      });
    } catch (error) {
      logger.error('Error getting deployment status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/deployment/cancel
   *
   * Cancel current deployment.
   */
  router.post('/cancel', (_req, res) => {
    try {
      if (!deploymentService.isDeploymentRunning()) {
        res.status(400).json({
          success: false,
          error: 'No deployment is running',
        });
        return;
      }

      deploymentService.cancelDeployment();

      res.json({
        success: true,
        message: 'Deployment cancelled',
      });
    } catch (error) {
      logger.error('Error cancelling deployment:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/deployment/history
   *
   * Get deployment history for a project.
   * Query: { projectPath: string, limit?: number }
   */
  router.get('/history', async (req, res) => {
    try {
      const projectPath = req.query.projectPath as string;
      const limit = parseInt(req.query.limit as string, 10) || 10;

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      const history = await deploymentService.getDeploymentHistory(projectPath, limit);

      res.json({
        success: true,
        history,
      });
    } catch (error) {
      logger.error('Error getting deployment history:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/deployment/generate
   *
   * Generate deployment configuration based on project analysis.
   * Body: { projectPath: string }
   */
  router.post('/generate', async (req, res) => {
    try {
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      const config = await generateDeploymentConfig(projectPath);

      res.json({
        success: true,
        config,
      });
    } catch (error) {
      logger.error('Error generating deployment config:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/deployment/generate-ai
   *
   * Generate deployment configuration using AI analysis.
   * Body: { projectPath: string }
   */
  router.post('/generate-ai', async (req, res) => {
    try {
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      const config = await generateDeploymentConfigWithAI(projectPath);

      res.json({
        success: true,
        config,
      });
    } catch (error) {
      logger.error('Error generating deployment config with AI:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

/**
 * Analyze project and generate a deployment configuration
 */
async function generateDeploymentConfig(projectPath: string): Promise<DeploymentConfig> {
  const config: DeploymentConfig = {
    version: 1,
    autoDeployOnComplete: false,
    buildSteps: [],
    deploySteps: [],
  };

  // Check for package.json
  let packageJson: {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null = null;

  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = (await secureFs.readFile(packageJsonPath, 'utf-8')) as string;
    packageJson = JSON.parse(content);
  } catch {
    // No package.json
  }

  // Check for docker-compose.yml and read its content
  let hasDockerCompose = false;
  let dockerComposeContent = '';
  for (const name of ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']) {
    try {
      const composePath = path.join(projectPath, name);
      await secureFs.access(composePath);
      dockerComposeContent = (await secureFs.readFile(composePath, 'utf-8')) as string;
      hasDockerCompose = true;
      break;
    } catch {
      // Not found
    }
  }

  // Check for Dockerfile
  let hasDockerfile = false;
  try {
    await secureFs.access(path.join(projectPath, 'Dockerfile'));
    hasDockerfile = true;
  } catch {
    // Not found
  }

  // If docker-compose handles everything, skip npm build steps
  // Docker-compose projects typically build inside containers
  if (hasDockerCompose) {
    // No build steps needed - docker compose build handles it
    config.buildSteps = [];

    config.deploySteps.push({
      name: 'Build Docker images',
      command: 'docker compose build --no-cache',
    });
    config.deploySteps.push({
      name: 'Start services',
      command: 'docker compose up -d',
    });

    // Try to detect port from docker-compose.yml
    let port = 8080; // Default for most backend apps
    const portMatch = dockerComposeContent.match(/(\d+):(\d+)/);
    if (portMatch) {
      port = parseInt(portMatch[1], 10);
    }
    // Check for common port patterns
    if (dockerComposeContent.includes('3000:')) {
      port = 3000;
    } else if (dockerComposeContent.includes('8080:')) {
      port = 8080;
    } else if (dockerComposeContent.includes('80:')) {
      port = 80;
    }

    config.healthCheckUrl = `http://localhost:${port}`;
    config.healthCheckTimeout = 120000; // Longer timeout for docker builds
  } else if (hasDockerfile) {
    // Single Dockerfile project
    config.deploySteps.push({
      name: 'Build Docker image',
      command: 'docker build -t app .',
    });
    config.deploySteps.push({
      name: 'Start container',
      command: 'docker run -d -p 3000:3000 app',
    });
    config.healthCheckUrl = 'http://localhost:3000';
    config.healthCheckTimeout = 60000;
  } else {
    // Non-Docker project - use npm scripts
    if (packageJson?.scripts) {
      const scripts = packageJson.scripts;

      // Install dependencies
      if (packageJson.dependencies || packageJson.devDependencies) {
        config.buildSteps.push({
          name: 'Install dependencies',
          command: 'npm install',
        });
      }

      // Build step
      if (scripts.build) {
        config.buildSteps.push({
          name: 'Build application',
          command: 'npm run build',
        });
      } else if (scripts['build:packages']) {
        config.buildSteps.push({
          name: 'Build packages',
          command: 'npm run build:packages',
        });
      }

      // Deploy/start step
      if (scripts.start) {
        config.deploySteps.push({
          name: 'Start application',
          command: 'npm run start',
        });
      } else if (scripts.dev) {
        config.deploySteps.push({
          name: 'Start development server',
          command: 'npm run dev',
        });
      }

      // Detect port from scripts
      let port = 3000;
      const portMatch = (scripts.dev || scripts.start || '').match(
        /--port[=\s](\d+)|PORT[=\s](\d+)/
      );
      if (portMatch) {
        port = parseInt(portMatch[1] || portMatch[2], 10);
      }
      config.healthCheckUrl = `http://localhost:${port}`;
      config.healthCheckTimeout = 60000;
    }
  }

  // E2E tests configuration (check regardless of docker)
  if (packageJson?.scripts) {
    const scripts = packageJson.scripts;
    if (scripts['test:e2e'] || scripts.e2e || scripts['test:playwright']) {
      config.e2eTests = {
        command: scripts['test:e2e']
          ? 'npm run test:e2e'
          : scripts.e2e
            ? 'npm run e2e'
            : 'npm run test:playwright',
        waitForUrl: config.healthCheckUrl,
        waitTimeout: 60000,
        timeout: 600000,
      };
    }
  }

  // Ensure we have at least some deploy steps
  if (config.deploySteps.length === 0) {
    config.deploySteps.push({
      name: 'Start application',
      command: 'npm start',
    });
    config.healthCheckUrl = 'http://localhost:3000';
    config.healthCheckTimeout = 60000;
  }

  logger.info(`Generated deployment config for ${projectPath}`, {
    buildSteps: config.buildSteps.length,
    deploySteps: config.deploySteps.length,
    hasDockerCompose,
    hasE2E: !!config.e2eTests,
  });

  return config;
}

/**
 * Extract text from Claude SDK stream
 */
async function extractTextFromStream(
  stream: AsyncIterable<{
    type: string;
    subtype?: string;
    result?: string;
    message?: {
      content?: Array<{ type: string; text?: string }>;
    };
  }>
): Promise<string> {
  let responseText = '';

  for await (const msg of stream) {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text) {
          responseText += block.text;
        }
      }
    } else if (msg.type === 'result' && msg.subtype === 'success') {
      responseText = msg.result || responseText;
    }
  }

  return responseText;
}

/**
 * Generate deployment configuration using AI analysis
 */
async function generateDeploymentConfigWithAI(projectPath: string): Promise<DeploymentConfig> {
  // Gather project information
  const projectInfo: string[] = [];

  // Read docker-compose.yml
  for (const name of ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']) {
    try {
      const content = (await secureFs.readFile(path.join(projectPath, name), 'utf-8')) as string;
      projectInfo.push(`=== ${name} ===\n${content}`);
      break;
    } catch {
      // Not found
    }
  }

  // Read package.json
  try {
    const content = (await secureFs.readFile(
      path.join(projectPath, 'package.json'),
      'utf-8'
    )) as string;
    projectInfo.push(`=== package.json ===\n${content}`);
  } catch {
    // Not found
  }

  // Read Dockerfile(s) - including subdirectories for custom images
  for (const name of [
    'Dockerfile',
    'Dockerfile.backend',
    'Dockerfile.frontend',
    'backend/Dockerfile',
    'frontend/Dockerfile',
    'n8n/Dockerfile',
    'worker/Dockerfile',
  ]) {
    try {
      const content = (await secureFs.readFile(path.join(projectPath, name), 'utf-8')) as string;
      projectInfo.push(`=== ${name} ===\n${content.substring(0, 2000)}`);
    } catch {
      // Not found
    }
  }

  // Read .env files to detect environment configuration
  for (const name of ['.env', '.env.build', '.env.local', '.env.production']) {
    try {
      const content = (await secureFs.readFile(path.join(projectPath, name), 'utf-8')) as string;
      // Only include variable names, not values (for security)
      const varNames = content
        .split('\n')
        .filter((line) => line.includes('=') && !line.startsWith('#'))
        .map((line) => line.split('=')[0])
        .join('\n');
      projectInfo.push(`=== ${name} (variable names only) ===\n${varNames}`);
    } catch {
      // Not found
    }
  }

  // Read README for context
  for (const name of ['README.md', 'readme.md', 'README.txt']) {
    try {
      const content = (await secureFs.readFile(path.join(projectPath, name), 'utf-8')) as string;
      projectInfo.push(`=== ${name} ===\n${content.substring(0, 3000)}`);
      break;
    } catch {
      // Not found
    }
  }

  // List top-level directories
  try {
    const entries = await secureFs.readdir(projectPath);
    projectInfo.push(`=== Project Structure ===\n${entries.join('\n')}`);
  } catch {
    // Error reading directory
  }

  const systemPrompt = `You are a deployment configuration expert. Analyze the provided project files and generate a deployment configuration JSON.

The configuration must follow this exact TypeScript interface:

interface DeploymentConfig {
  version: number;  // Always 1
  autoDeployOnComplete: boolean;  // Whether to auto-deploy when all features complete
  buildSteps: Array<{
    name: string;
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    timeout?: number;
    continueOnError?: boolean;
  }>;
  deploySteps: Array<{
    name: string;
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    timeout?: number;
    continueOnError?: boolean;
  }>;
  healthCheckUrl?: string;
  healthCheckTimeout?: number;
  e2eTests?: {
    command: string;
    workingDirectory?: string;
    waitForUrl?: string;
    waitTimeout?: number;
    env?: Record<string, string>;
    timeout?: number;
  };
}

Rules:
1. If the project uses docker-compose, buildSteps should be EMPTY (docker compose build handles everything)
2. For docker-compose projects, the deploy steps should be: (1) "docker compose down --remove-orphans" with continueOnError:true, (2) "docker compose build --no-cache", (3) "docker compose up -d"
3. IMPORTANT: If .env.build file exists, use "--env-file .env.build" flag in ALL docker compose commands (build and up)
4. IMPORTANT: If docker-compose.yml references custom images (like "image: custom-name:tag") AND there's a Dockerfile in a matching subdirectory (like n8n/Dockerfile for stk-n8n), add a deploy step BEFORE docker compose to build it: "docker build -t <image-name:tag> ./<directory>"
5. Detect the correct health check port from docker-compose.yml port mappings (e.g., "8080:8080" means port 8080)
6. IMPORTANT: Look for context paths in environment variables like SERVER_SERVLET_CONTEXT_PATH=/api. If found, the health check URL MUST include the context path (e.g., http://localhost:8080/api/actuator/health)
7. For Spring Boot apps with actuator, use /actuator/health as the health endpoint (with context path if configured)
8. Only add E2E tests if there's evidence of test scripts in package.json
9. Set reasonable timeouts (300000ms for image builds, 120000ms for health checks)
10. Output ONLY valid JSON, no markdown, no explanation`;

  const userPrompt = `Analyze this project and generate a deployment configuration JSON:

${projectInfo.join('\n\n')}

Output only the JSON configuration, nothing else.`;

  logger.info(`Generating AI deployment config for ${projectPath}`);

  const stream = query({
    prompt: userPrompt,
    options: {
      model: CLAUDE_MODEL_MAP.haiku,
      systemPrompt,
      maxTurns: 1,
      allowedTools: [],
      permissionMode: 'default',
    },
  });

  const responseText = await extractTextFromStream(stream);

  // Parse the JSON response
  let config: DeploymentConfig;
  try {
    // Clean up response - remove markdown code blocks if present
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    config = JSON.parse(jsonStr);

    // Validate required fields
    if (!config.version) config.version = 1;
    if (!Array.isArray(config.buildSteps)) config.buildSteps = [];
    if (!Array.isArray(config.deploySteps)) config.deploySteps = [];
    if (typeof config.autoDeployOnComplete !== 'boolean') config.autoDeployOnComplete = false;

    logger.info(`AI generated deployment config for ${projectPath}`, {
      buildSteps: config.buildSteps.length,
      deploySteps: config.deploySteps.length,
      hasE2E: !!config.e2eTests,
    });
  } catch (parseError) {
    logger.error('Failed to parse AI response:', parseError, responseText);
    // Fall back to basic generation
    return generateDeploymentConfig(projectPath);
  }

  return config;
}
