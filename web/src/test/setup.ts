import '@testing-library/jest-dom/vitest';

import { vi } from 'vitest';

if (typeof window === 'undefined') {
  // Node-environment tests do not expose browser globals.
} else {
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (!window.scrollTo) {
  window.scrollTo = vi.fn();
}

const svgPrototype = window.SVGElement.prototype as SVGElement & {
  getBBox?: () => { x: number; y: number; width: number; height: number };
};

if (!svgPrototype.getBBox) {
  svgPrototype.getBBox = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
}

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  value: 1280,
});

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  value: 720,
});
}
