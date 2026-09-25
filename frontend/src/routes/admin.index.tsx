import { createFileRoute, redirect } from '@tanstack/react-router';
import { getUser, getRoleLandingRoute } from '@/lib/api';

export const Route = createFileRoute('/admin/')({
  beforeLoad: () => {
    const user = getUser();
    const landing = getRoleLandingRoute(user?.role);
    throw redirect({ to: landing });
  },
  component: () => null,
});
