import { markRouteTransitionEnd, markRouteTransitionStart } from './performance';

export type Navigate = (route: string) => Promise<void>;

export async function optimisticNavigate(
  route: string,
  navigate: Navigate,
  onStart: () => void,
  onEnd: () => void,
): Promise<void> {
  markRouteTransitionStart(route);
  onStart();

  try {
    await navigate(route);
  } finally {
    markRouteTransitionEnd(route);
    onEnd();
  }
}
