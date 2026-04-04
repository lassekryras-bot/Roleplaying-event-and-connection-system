const MVP_MODE = true;

function logMeasure(name: string, startMark: string, endMark: string): void {
  performance.measure(name, startMark, endMark);
  const entries = performance.getEntriesByName(name);
  const latest = entries[entries.length - 1];

  if (MVP_MODE && latest) {
    console.info(`[mvp:perf] ${name} ${latest.duration.toFixed(2)}ms`);
  }
}

export function markInitialLoadStart(): void {
  performance.mark('initial-load-start');
}

export function markInitialLoadEnd(): void {
  performance.mark('initial-load-end');
  logMeasure('initial-page-load', 'initial-load-start', 'initial-load-end');
}

export function markRouteTransitionStart(route: string): void {
  performance.mark(`route-start:${route}`);
}

export function markRouteTransitionEnd(route: string): void {
  const endMark = `route-end:${route}`;
  const startMark = `route-start:${route}`;

  performance.mark(endMark);
  logMeasure(`route-transition:${route}`, startMark, endMark);
}
