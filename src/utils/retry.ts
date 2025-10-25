/**
 * Retry logic with exponential backoff
 * Based on: .kiro/specs/auto-video-generation/requirements.md (Requirements 4.4, 5.5)
 *          .kiro/specs/auto-video-generation/design.md
 *
 * Features:
 * - Exponential backoff (1s, 2s, 4s)
 * - Configurable max retries
 * - Retryable error detection
 * - Detailed logging
 */

import { ErrorType, PipelineError, TimeoutError } from '../types/error-types.js';
import { Logger } from './logger.js';

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries?: number; // Default: 3
  baseDelay?: number; // Base delay in milliseconds, default: 1000
  maxDelay?: number; // Maximum delay in milliseconds, default: 10000
  retryableErrors?: ErrorType[]; // Errors that should trigger retry
  onRetry?: (attempt: number, error: Error) => void; // Callback on retry
}

/**
 * Default retryable error types
 */
const DEFAULT_RETRYABLE_ERRORS: ErrorType[] = [
  ErrorType.NETWORK_ERROR,
  ErrorType.TIMEOUT_ERROR,
  ErrorType.CLI_EXECUTION_ERROR,
  ErrorType.API_ERROR
];

/**
 * Sleep function
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Check if error is retryable
 *
 * @param error - Error to check
 * @param retryableErrors - List of retryable error types
 * @returns boolean - true if error is retryable
 */
const isRetryableError = (error: Error, retryableErrors: ErrorType[]): boolean => {
  if (error instanceof PipelineError) {
    return retryableErrors.includes(error.type);
  }

  // Check for common retryable error patterns in message
  const errorMessage = error.message.toLowerCase();
  const retryablePatterns = [
    'timeout',
    'network',
    'econnrefused',
    'econnreset',
    'etimedout',
    'enotfound',
    'socket hang up'
  ];

  return retryablePatterns.some((pattern) => errorMessage.includes(pattern));
};

/**
 * Calculate delay with exponential backoff
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns number - Delay in milliseconds
 */
const calculateBackoffDelay = (attempt: number, baseDelay: number, maxDelay: number): number => {
  // Exponential backoff: baseDelay * 2^attempt
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
};

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Promise<T> - Result from function
 * @throws Error - If all retries fail
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const logger = new Logger('Retry');
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 1000; // 1 second
  const maxDelay = options.maxDelay ?? 10000; // 10 seconds
  const retryableErrors = options.retryableErrors ?? DEFAULT_RETRYABLE_ERRORS;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Log retry attempt
      if (attempt > 0) {
        logger.info(`Retry attempt ${attempt}/${maxRetries}`);
      }

      // Execute function
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if this is the last attempt
      if (attempt === maxRetries) {
        logger.error(`All ${maxRetries} retry attempts failed`, lastError);
        throw lastError;
      }

      // Check if error is retryable
      if (!isRetryableError(lastError, retryableErrors)) {
        logger.error('Error is not retryable, aborting', lastError);
        throw lastError;
      }

      // Calculate backoff delay
      const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
      logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`);

      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(attempt + 1, lastError);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError || new Error('Retry failed with unknown error');
};

/**
 * Retry with custom retry condition
 *
 * @param fn - Function to retry
 * @param shouldRetry - Function that determines if retry should happen
 * @param options - Retry options
 * @returns Promise<T> - Result from function
 */
export const retryIf = async <T>(
  fn: () => Promise<T>,
  shouldRetry: (error: Error) => boolean,
  options: RetryOptions = {}
): Promise<T> => {
  const logger = new Logger('Retry');
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 1000;
  const maxDelay = options.maxDelay ?? 10000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`Retry attempt ${attempt}/${maxRetries}`);
      }

      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        logger.error(`All ${maxRetries} retry attempts failed`, lastError);
        throw lastError;
      }

      if (!shouldRetry(lastError)) {
        logger.error('Custom retry condition returned false, aborting', lastError);
        throw lastError;
      }

      const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
      logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`);

      if (options.onRetry) {
        options.onRetry(attempt + 1, lastError);
      }

      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
};

/**
 * Execute function with timeout and retry
 *
 * @param fn - Function to execute
 * @param timeout - Timeout in milliseconds
 * @param retryOptions - Retry options
 * @returns Promise<T> - Result from function
 */
export const retryWithTimeout = async <T>(
  fn: () => Promise<T>,
  timeout: number,
  retryOptions: RetryOptions = {}
): Promise<T> => {
  return retry(async () => {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new TimeoutError('Retry', `Operation timed out after ${timeout}ms`)),
          timeout
        )
      )
    ]);
  }, retryOptions);
};
