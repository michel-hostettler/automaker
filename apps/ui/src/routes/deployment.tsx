import { createFileRoute } from '@tanstack/react-router';
import { DeploymentView } from '@/components/views/deployment-view';

export const Route = createFileRoute('/deployment')({
  component: DeploymentView,
});
