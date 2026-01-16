/**
 * Debounce Utility
 *
 * Following Constitution Principle IV (User Experience Preservation):
 * - Use debounce for performance-sensitive operations
 * - Default 150ms for input, 100ms for scroll
 */

/**
 * Creates a debounced version of a function
 * @param func Function to debounce
 * @param wait Delay in milliseconds (default: 150ms)
 * @returns Debounced function with cancel method
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait = 150
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (this: unknown, ...args: Parameters<T>): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  } as T & { cancel: () => void };

  debounced.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Creates a throttled version of a function
 * @param func Function to throttle
 * @param limit Minimum interval in milliseconds (default: 100ms)
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => void>(func: T, limit = 100): T {
  let inThrottle = false;

  return function (this: unknown, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  } as T;
}

/**
 * Delays execution for specified milliseconds
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
