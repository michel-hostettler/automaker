/**
 * POST /start endpoint - Start a conversation
 */

import type { Request, Response } from 'express';
import { AgentService } from '../../../services/agent-service.js';
import { createLogger } from '@automaker/utils';
import { getErrorMessage, logError } from '../common.js';
import { getRequestUsername } from '../../../lib/auth.js';

const logger = createLogger('Agent');

export function createStartHandler(agentService: AgentService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId, workingDirectory } = req.body as {
        sessionId: string;
        workingDirectory?: string;
      };

      // Get username from session for multi-user event filtering
      const username = getRequestUsername(req) || undefined;

      if (!sessionId) {
        res.status(400).json({ success: false, error: 'sessionId is required' });
        return;
      }

      const result = await agentService.startConversation({
        sessionId,
        workingDirectory,
        username,
      });

      res.json(result);
    } catch (error) {
      logError(error, 'Start conversation failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
