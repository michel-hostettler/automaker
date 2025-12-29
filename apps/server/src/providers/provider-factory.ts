/**
 * Provider Factory - Routes model IDs to the appropriate provider
 *
 * This factory implements model-based routing to automatically select
 * the correct provider based on the model string. This makes adding
 * new providers (Cursor, OpenCode, etc.) trivial - just add one line.
 */

import { BaseProvider } from './base-provider.js';
import { ClaudeProvider } from './claude-provider.js';
import { CursorProvider } from './cursor-provider.js';
import type { InstallationStatus, ModelDefinition } from './types.js';
import { CURSOR_MODEL_MAP, type ModelProvider } from '@automaker/types';

export class ProviderFactory {
  /**
   * Determine which provider to use for a given model
   *
   * @param model Model identifier
   * @returns Provider name (ModelProvider type)
   */
  static getProviderNameForModel(model: string): ModelProvider {
    const lowerModel = model.toLowerCase();

    // Check for explicit cursor prefix
    if (lowerModel.startsWith('cursor-')) {
      return 'cursor';
    }

    // Check if it's a known Cursor model ID (without prefix)
    const cursorModelId = lowerModel.replace('cursor-', '');
    if (cursorModelId in CURSOR_MODEL_MAP) {
      return 'cursor';
    }

    // Check for Claude model patterns
    if (
      lowerModel.startsWith('claude-') ||
      ['opus', 'sonnet', 'haiku'].some((n) => lowerModel.includes(n))
    ) {
      return 'claude';
    }

    // Default to Claude
    return 'claude';
  }

  /**
   * Get the appropriate provider for a given model ID
   *
   * @param modelId Model identifier (e.g., "claude-opus-4-5-20251101", "cursor-gpt-4o", "cursor-auto")
   * @returns Provider instance for the model
   */
  static getProviderForModel(modelId: string): BaseProvider {
    const providerName = this.getProviderNameForModel(modelId);

    if (providerName === 'cursor') {
      return new CursorProvider();
    }

    return new ClaudeProvider();
  }

  /**
   * Get all available providers
   */
  static getAllProviders(): BaseProvider[] {
    return [new ClaudeProvider(), new CursorProvider()];
  }

  /**
   * Check installation status for all providers
   *
   * @returns Map of provider name to installation status
   */
  static async checkAllProviders(): Promise<Record<string, InstallationStatus>> {
    const providers = this.getAllProviders();
    const statuses: Record<string, InstallationStatus> = {};

    for (const provider of providers) {
      const name = provider.getName();
      const status = await provider.detectInstallation();
      statuses[name] = status;
    }

    return statuses;
  }

  /**
   * Get provider by name (for direct access if needed)
   *
   * @param name Provider name (e.g., "claude", "cursor")
   * @returns Provider instance or null if not found
   */
  static getProviderByName(name: string): BaseProvider | null {
    const lowerName = name.toLowerCase();

    switch (lowerName) {
      case 'claude':
      case 'anthropic':
        return new ClaudeProvider();

      case 'cursor':
        return new CursorProvider();

      default:
        return null;
    }
  }

  /**
   * Get all available models from all providers
   */
  static getAllAvailableModels(): ModelDefinition[] {
    const providers = this.getAllProviders();
    return providers.flatMap((p) => p.getAvailableModels());
  }
}
