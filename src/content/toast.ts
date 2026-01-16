/**
 * Toast Notification Component
 *
 * Implements T021: Toast notification with success/error/info types
 */

import type { ToastType } from '../types';

/** Currently visible toast element */
let currentToast: HTMLElement | null = null;

/** Timeout for auto-hiding toast */
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Show a toast notification
 * @param message Message to display
 * @param type Toast type (success, error, info)
 * @param duration Duration in ms before auto-hide (default: 3000)
 */
export function showToast(message: string, type: ToastType = 'info', duration = 3000): void {
  // Remove existing toast if any
  hideToast();

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `ype-toast ype-toast--${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  // Add to document
  document.body.appendChild(toast);
  currentToast = toast;

  // Trigger animation (need to wait for element to be in DOM)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('ype-toast--visible');
    });
  });

  // Auto-hide after duration
  hideTimeout = setTimeout(() => {
    hideToast();
  }, duration);
}

/**
 * Hide the current toast
 */
export function hideToast(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  if (currentToast) {
    currentToast.classList.remove('ype-toast--visible');

    // Remove from DOM after animation
    const toast = currentToast;
    setTimeout(() => {
      toast.remove();
    }, 300); // Match CSS transition duration

    currentToast = null;
  }
}

/**
 * Show success toast
 */
export function showSuccess(message: string, duration?: number): void {
  showToast(message, 'success', duration);
}

/**
 * Show error toast
 */
export function showError(message: string, duration?: number): void {
  showToast(message, 'error', duration);
}

/**
 * Show info toast
 */
export function showInfo(message: string, duration?: number): void {
  showToast(message, 'info', duration);
}
