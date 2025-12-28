import { useAppStore } from '@/store/app-store';
import { useCliStatus } from '../hooks/use-cli-status';
import { ClaudeCliStatus } from '../cli-status/claude-cli-status';
import { ClaudeMdSettings } from '../claude/claude-md-settings';
import { ClaudeUsageSection } from '../api-keys/claude-usage-section';

export function ClaudeSettingsTab() {
  const { apiKeys, autoLoadClaudeMd, setAutoLoadClaudeMd } = useAppStore();

  // Use CLI status hook
  const { claudeCliStatus, isCheckingClaudeCli, handleRefreshClaudeCli } = useCliStatus();

  // Hide usage tracking when using API key (only show for Claude Code CLI users)
  // Also hide on Windows for now (CLI usage command not supported)
  const isWindows =
    typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('win');
  const showUsageTracking = !apiKeys.anthropic && !isWindows;

  return (
    <div className="space-y-6">
      <ClaudeCliStatus
        status={claudeCliStatus}
        isChecking={isCheckingClaudeCli}
        onRefresh={handleRefreshClaudeCli}
      />
      <ClaudeMdSettings
        autoLoadClaudeMd={autoLoadClaudeMd}
        onAutoLoadClaudeMdChange={setAutoLoadClaudeMd}
      />
      {showUsageTracking && <ClaudeUsageSection />}
    </div>
  );
}

export default ClaudeSettingsTab;
