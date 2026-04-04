export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  createdAt: number;
}

type ToastListener = (toast: ToastMessage) => void;

const listeners = new Set<ToastListener>();

export function subscribeToToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitToast(toast: ToastMessage): void {
  listeners.forEach((listener) => listener(toast));
}

export function showToast(input: Omit<ToastMessage, 'id' | 'createdAt'>): void {
  emitToast({
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
}

export function notifyNetworkFailure(description: string): void {
  showToast({
    type: 'error',
    title: 'Network request failed',
    description,
  });
}

export function notifyRefreshSuccess(target: string): void {
  showToast({
    type: 'success',
    title: 'Refresh complete',
    description: `${target} is up to date.`,
  });
}

export function notifyRoleSwitch(role: string): void {
  showToast({
    type: 'success',
    title: 'Role switched',
    description: `You are now viewing as ${role}.`,
  });
}
