/**
 * Error types for the pipeline
 * Based on: .kiro/specs/auto-video-generation/design.md
 */

export enum ErrorType {
  CONFIG_ERROR = 'CONFIG_ERROR',
  CLI_EXECUTION_ERROR = 'CLI_EXECUTION_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

/**
 * Base error class for pipeline errors
 */
export class PipelineError extends Error {
  constructor(
    public type: ErrorType,
    public node: string,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PipelineError';

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PipelineError);
    }
  }
}

/**
 * Configuration error
 */
export class ConfigError extends PipelineError {
  constructor(node: string, message: string, originalError?: Error) {
    super(ErrorType.CONFIG_ERROR, node, message, originalError);
    this.name = 'ConfigError';
  }
}

/**
 * CLI execution error
 */
export class CLIExecutionError extends PipelineError {
  constructor(node: string, message: string, originalError?: Error) {
    super(ErrorType.CLI_EXECUTION_ERROR, node, message, originalError);
    this.name = 'CLIExecutionError';
  }
}

/**
 * File not found error
 */
export class FileNotFoundError extends PipelineError {
  constructor(node: string, message: string, originalError?: Error) {
    super(ErrorType.FILE_NOT_FOUND, node, message, originalError);
    this.name = 'FileNotFoundError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends PipelineError {
  constructor(node: string, message: string, originalError?: Error) {
    super(ErrorType.TIMEOUT_ERROR, node, message, originalError);
    this.name = 'TimeoutError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends PipelineError {
  constructor(node: string, message: string, originalError?: Error) {
    super(ErrorType.VALIDATION_ERROR, node, message, originalError);
    this.name = 'ValidationError';
  }
}

/**
 * API error
 */
export class APIError extends PipelineError {
  constructor(node: string, message: string, originalError?: Error) {
    super(ErrorType.API_ERROR, node, message, originalError);
    this.name = 'APIError';
  }
}

/**
 * Network error
 */
export class NetworkError extends PipelineError {
  constructor(node: string, message: string, originalError?: Error) {
    super(ErrorType.NETWORK_ERROR, node, message, originalError);
    this.name = 'NetworkError';
  }
}
