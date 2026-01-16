/**
 * Structured Logger Utility
 *
 * Following Constitution Principle V (Defensive Error Handling):
 * - Output structured logs with version info
 * - Use console.warn/error only (no alert/confirm)
 */

import { EXTENSION_VERSION } from '../types';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  version: string;
  context?: Record<string, unknown>;
}

/**
 * Logger prefix for identifying extension logs
 */
const LOG_PREFIX = '[YPE]';

/**
 * Format log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  return `${LOG_PREFIX} [${entry.level.toUpperCase()}] ${entry.message}${contextStr}`;
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    version: EXTENSION_VERSION,
    context,
  };
}

/**
 * Structured logger for the extension
 */
export const logger = {
  /**
   * Debug level log (only in development)
   */
  debug(message: string, context?: Record<string, unknown>): void {
    // Use webpack DefinePlugin to inject NODE_ENV at build time
    // @ts-expect-error NODE_ENV is defined by webpack
    if (typeof __NODE_ENV__ !== 'undefined' && __NODE_ENV__ === 'development') {
      const entry = createLogEntry('debug', message, context);
      // eslint-disable-next-line no-console
      console.log(formatLogEntry(entry));
    }
  },

  /**
   * Info level log
   */
  info(message: string, context?: Record<string, unknown>): void {
    const entry = createLogEntry('info', message, context);
    // eslint-disable-next-line no-console
    console.log(formatLogEntry(entry));
  },

  /**
   * Warning level log
   */
  warn(message: string, context?: Record<string, unknown>): void {
    const entry = createLogEntry('warn', message, context);
    console.warn(formatLogEntry(entry));
  },

  /**
   * Error level log
   */
  error(message: string, context?: Record<string, unknown>): void {
    const entry = createLogEntry('error', message, {
      ...context,
      version: EXTENSION_VERSION,
    });
    console.error(formatLogEntry(entry));
  },

  /**
   * Log selector failure for debugging DOM changes
   */
  selectorFailed(selectorName: string, attempted: string[]): void {
    logger.warn('Selector failed - YouTube DOM may have changed', {
      selector: selectorName,
      attempted,
      hint: 'Extension will use fallback or degrade gracefully',
    });
  },
};
