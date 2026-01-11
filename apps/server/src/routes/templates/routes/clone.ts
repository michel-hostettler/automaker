/**
 * POST /clone endpoint - Clone a GitHub template to a new project directory
 */

import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import * as secureFs from '../../../lib/secure-fs.js';
import { PathNotAllowedError } from '@automaker/platform';
import { logger, getErrorMessage, logError } from '../common.js';

export function createCloneHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoUrl, projectName, parentDir, branch, preserveHistory } = req.body as {
        repoUrl: string;
        projectName: string;
        parentDir: string;
        branch?: string; // Optional: specific branch to clone
        preserveHistory?: boolean; // Optional: keep git history and remote (default: false for templates)
      };

      // Validate inputs
      if (!repoUrl || !projectName || !parentDir) {
        res.status(400).json({
          success: false,
          error: 'repoUrl, projectName, and parentDir are required',
        });
        return;
      }

      logger.info(
        `[Templates] Clone request - Repo: ${repoUrl}, Project: ${projectName}, Parent: ${parentDir}, Branch: ${branch || 'default'}, PreserveHistory: ${preserveHistory || false}`
      );

      // Validate repo URL is a valid GitHub URL (with optional .git suffix)
      // Also accept URLs with /tree/branch for branch selection
      const githubUrlPattern =
        /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(\.git)?(\/tree\/[\w./-]+)?$/;
      if (!githubUrlPattern.test(repoUrl)) {
        res.status(400).json({
          success: false,
          error: 'Invalid GitHub repository URL',
        });
        return;
      }

      // Extract branch from URL if present (e.g., https://github.com/user/repo/tree/branch-name)
      let effectiveBranch = branch;
      let cleanRepoUrl = repoUrl;
      const treeMatch = repoUrl.match(/\/tree\/([\w./-]+)$/);
      if (treeMatch) {
        effectiveBranch = effectiveBranch || treeMatch[1];
        cleanRepoUrl = repoUrl.replace(/\/tree\/[\w./-]+$/, '');
      }
      // Ensure URL ends with .git for clone
      if (!cleanRepoUrl.endsWith('.git')) {
        cleanRepoUrl = cleanRepoUrl + '.git';
      }

      // Sanitize project name (allow alphanumeric, dash, underscore)
      const sanitizedName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-');
      if (sanitizedName !== projectName) {
        logger.info(`[Templates] Sanitized project name: ${projectName} -> ${sanitizedName}`);
      }

      // Build full project path
      const projectPath = path.join(parentDir, sanitizedName);

      const resolvedParent = path.resolve(parentDir);
      const resolvedProject = path.resolve(projectPath);
      const relativePath = path.relative(resolvedParent, resolvedProject);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        res.status(400).json({
          success: false,
          error: 'Invalid project name; potential path traversal attempt.',
        });
        return;
      }

      // Check if directory already exists (secureFs.access also validates path is allowed)
      try {
        await secureFs.access(projectPath);
        res.status(400).json({
          success: false,
          error: `Directory "${sanitizedName}" already exists in ${parentDir}`,
        });
        return;
      } catch (accessError) {
        if (accessError instanceof PathNotAllowedError) {
          res.status(403).json({
            success: false,
            error: `Project path not allowed: ${projectPath}. Must be within ALLOWED_ROOT_DIRECTORY.`,
          });
          return;
        }
        // Directory doesn't exist, which is what we want
      }

      // Ensure parent directory exists
      try {
        // Check if parentDir is a root path (Windows: C:\, D:\, etc. or Unix: /)
        const isWindowsRoot = /^[A-Za-z]:\\?$/.test(parentDir);
        const isUnixRoot = parentDir === '/' || parentDir === '';
        const isRoot = isWindowsRoot || isUnixRoot;

        if (isRoot) {
          // Root paths always exist, just verify access
          logger.info(`[Templates] Using root path: ${parentDir}`);
          await secureFs.access(parentDir);
        } else {
          // Check if parent directory exists
          let parentExists = false;
          try {
            await secureFs.access(parentDir);
            parentExists = true;
          } catch {
            parentExists = false;
          }

          if (!parentExists) {
            logger.info(`[Templates] Creating parent directory: ${parentDir}`);
            await secureFs.mkdir(parentDir, { recursive: true });
          } else {
            logger.info(`[Templates] Parent directory exists: ${parentDir}`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[Templates] Failed to access parent directory:', parentDir, error);
        res.status(500).json({
          success: false,
          error: `Failed to access parent directory: ${errorMessage}`,
        });
        return;
      }

      logger.info(
        `[Templates] Cloning ${cleanRepoUrl} to ${projectPath}${effectiveBranch ? ` (branch: ${effectiveBranch})` : ''}`
      );

      // Clone the repository
      const cloneResult = await new Promise<{
        success: boolean;
        error?: string;
      }>((resolve) => {
        // Build clone arguments
        const cloneArgs = ['clone'];
        if (effectiveBranch) {
          cloneArgs.push('--branch', effectiveBranch);
        }
        cloneArgs.push(cleanRepoUrl, projectPath);

        const gitProcess = spawn('git', cloneArgs, {
          cwd: parentDir,
        });

        let stderr = '';

        gitProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        gitProcess.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              error: stderr || `Git clone failed with code ${code}`,
            });
          }
        });

        gitProcess.on('error', (error) => {
          resolve({
            success: false,
            error: `Failed to spawn git: ${error.message}`,
          });
        });
      });

      if (!cloneResult.success) {
        res.status(500).json({
          success: false,
          error: cloneResult.error || 'Failed to clone repository',
        });
        return;
      }

      // Handle git history based on preserveHistory option
      if (preserveHistory) {
        // Keep git history and remote - just log success
        logger.info('[Templates] Preserved git history and remote origin');
      } else {
        // Template mode: Remove .git directory and start fresh
        try {
          const gitDir = path.join(projectPath, '.git');
          await secureFs.rm(gitDir, { recursive: true, force: true });
          logger.info('[Templates] Removed .git directory');
        } catch (error) {
          logger.warn('[Templates] Could not remove .git directory:', error);
          // Continue anyway - not critical
        }

        // Initialize a fresh git repository
        await new Promise<void>((resolve) => {
          const gitInit = spawn('git', ['init'], {
            cwd: projectPath,
          });

          gitInit.on('close', () => {
            logger.info('[Templates] Initialized fresh git repository');
            resolve();
          });

          gitInit.on('error', () => {
            logger.warn('[Templates] Could not initialize git');
            resolve();
          });
        });
      }

      logger.info(
        `[Templates] Successfully cloned ${preserveHistory ? 'repository' : 'template'} to ${projectPath}`
      );

      res.json({
        success: true,
        projectPath,
        projectName: sanitizedName,
      });
    } catch (error) {
      logError(error, 'Clone template failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
