/**
 * Utility functions for performance optimization
 */

/**
 * Creates a debounced version of a function that delays execution
 * until after wait milliseconds have elapsed since the last call.
 * 
 * @param fn The function to debounce
 * @param wait The number of milliseconds to delay (default: 16ms - one frame at 60fps)
 * @returns A debounced version of the function
 */
export function debounce<T extends unknown[], R>(
  fn: (...args: T) => R,
  wait: number = 16
): (...args: T) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: T): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Creates a throttled version of a function that limits execution
 * to at most once per specified interval.
 * 
 * @param fn The function to throttle
 * @param limit The minimum time between calls in milliseconds (default: 100ms)
 * @returns A throttled version of the function
 */
export function throttle<T extends unknown[], R>(
  fn: (...args: T) => R,
  limit: number = 100
): (...args: T) => void {
  let inThrottle = false;
  let lastArgs: T | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: T): void {
    if (inThrottle) {
      lastArgs = args;
      return;
    }

    fn.apply(this, args);
    inThrottle = true;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      inThrottle = false;
      timeoutId = null;

      if (lastArgs !== null) {
        const pendingArgs = lastArgs;
        lastArgs = null;
        fn.apply(this, pendingArgs);
        inThrottle = true;

        timeoutId = setTimeout(() => {
          inThrottle = false;
          timeoutId = null;
        }, limit);
      }
    }, limit);
  };
}
