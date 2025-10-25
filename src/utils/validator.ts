/**
 * Validation utility
 * Based on: .kiro/specs/auto-video-generation/requirements.md (Requirement 11.4)
 *
 * Features:
 * - Configuration validation
 * - Node input validation
 * - Path validation
 * - Data structure validation
 */

import { ValidationResult, NodeInput } from '../types/node-types.js';
import { fileExists, dirExists } from './file-utils.js';
import { Logger } from './logger.js';

const logger = new Logger('Validator');

/**
 * Create validation result
 */
const createValidationResult = (valid: boolean, errors: string[] = []): ValidationResult => {
  return { valid, errors };
};

/**
 * Validate pipeline configuration
 *
 * @param config - Pipeline configuration
 * @returns ValidationResult
 */
export const validatePipelineConfig = (config: any): ValidationResult => {
  const errors: string[] = [];

  // Check required fields
  if (!config.outputDir) {
    errors.push('outputDir is required');
  }

  if (!config.logLevel) {
    errors.push('logLevel is required');
  } else if (!['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(config.logLevel)) {
    errors.push('logLevel must be one of: DEBUG, INFO, WARN, ERROR');
  }

  if (!config.nodes) {
    errors.push('nodes configuration is required');
  }

  return createValidationResult(errors.length === 0, errors);
};

/**
 * Validate node configuration
 *
 * @param config - Node configuration
 * @param nodeName - Name of the node
 * @returns ValidationResult
 */
export const validateNodeConfig = (config: any, nodeName: string): ValidationResult => {
  const errors: string[] = [];

  if (typeof config.enabled !== 'boolean') {
    errors.push(`${nodeName}: enabled must be a boolean`);
  }

  if (typeof config.timeout !== 'number' || config.timeout <= 0) {
    errors.push(`${nodeName}: timeout must be a positive number`);
  }

  if (typeof config.retryCount !== 'number' || config.retryCount < 0) {
    errors.push(`${nodeName}: retryCount must be a non-negative number`);
  }

  if (config.retryDelay !== undefined) {
    if (typeof config.retryDelay !== 'number' || config.retryDelay < 0) {
      errors.push(`${nodeName}: retryDelay must be a non-negative number`);
    }
  }

  return createValidationResult(errors.length === 0, errors);
};

/**
 * Validate node input
 *
 * @param input - Node input
 * @param nodeName - Name of the node
 * @returns ValidationResult
 */
export const validateNodeInput = (input: NodeInput, nodeName: string): ValidationResult => {
  const errors: string[] = [];

  if (!input.config) {
    errors.push(`${nodeName}: config is required`);
  } else {
    const configValidation = validateNodeConfig(input.config, nodeName);
    if (!configValidation.valid) {
      errors.push(...configValidation.errors);
    }
  }

  if (!input.workDir) {
    errors.push(`${nodeName}: workDir is required`);
  }

  return createValidationResult(errors.length === 0, errors);
};

/**
 * Validate file path exists
 *
 * @param filePath - File path to validate
 * @param fieldName - Field name for error message
 * @returns Promise<ValidationResult>
 */
export const validateFilePath = async (
  filePath: string,
  fieldName: string = 'file'
): Promise<ValidationResult> => {
  const exists = await fileExists(filePath);
  if (!exists) {
    return createValidationResult(false, [`${fieldName} not found: ${filePath}`]);
  }
  return createValidationResult(true);
};

/**
 * Validate directory path exists
 *
 * @param dirPath - Directory path to validate
 * @param fieldName - Field name for error message
 * @returns Promise<ValidationResult>
 */
export const validateDirPath = async (
  dirPath: string,
  fieldName: string = 'directory'
): Promise<ValidationResult> => {
  const exists = await dirExists(dirPath);
  if (!exists) {
    return createValidationResult(false, [`${fieldName} not found: ${dirPath}`]);
  }
  return createValidationResult(true);
};

/**
 * Validate string is not empty
 *
 * @param value - String to validate
 * @param fieldName - Field name for error message
 * @returns ValidationResult
 */
export const validateNonEmptyString = (value: string, fieldName: string): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return createValidationResult(false, [`${fieldName} must not be empty`]);
  }
  return createValidationResult(true);
};

/**
 * Validate number is in range
 *
 * @param value - Number to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param fieldName - Field name for error message
 * @returns ValidationResult
 */
export const validateNumberRange = (
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValidationResult => {
  if (value < min || value > max) {
    return createValidationResult(false, [`${fieldName} must be between ${min} and ${max}`]);
  }
  return createValidationResult(true);
};

/**
 * Validate script length (for Script Generation Node)
 *
 * @param script - Script content
 * @param minLength - Minimum length
 * @param maxLength - Maximum length
 * @returns ValidationResult
 */
export const validateScriptLength = (
  script: string,
  minLength: number,
  maxLength: number
): ValidationResult => {
  const length = script.length;

  if (length < minLength) {
    return createValidationResult(false, [
      `Script too short: ${length} characters (min: ${minLength})`
    ]);
  }

  if (length > maxLength) {
    return createValidationResult(false, [
      `Script too long: ${length} characters (max: ${maxLength})`
    ]);
  }

  return createValidationResult(true);
};

/**
 * Validate research topics
 *
 * @param topics - Research topics array
 * @param minTopics - Minimum number of topics
 * @returns ValidationResult
 */
export const validateResearchTopics = (topics: any[], minTopics: number): ValidationResult => {
  const errors: string[] = [];

  if (!Array.isArray(topics)) {
    return createValidationResult(false, ['topics must be an array']);
  }

  if (topics.length < minTopics) {
    errors.push(`Not enough topics: ${topics.length} (min: ${minTopics})`);
  }

  topics.forEach((topic, index) => {
    if (!topic.title) {
      errors.push(`Topic ${index + 1}: title is required`);
    }
    if (!topic.summary) {
      errors.push(`Topic ${index + 1}: summary is required`);
    }
  });

  return createValidationResult(errors.length === 0, errors);
};

/**
 * Validate URL format
 *
 * @param url - URL to validate
 * @param fieldName - Field name for error message
 * @returns ValidationResult
 */
export const validateUrl = (url: string, fieldName: string = 'url'): ValidationResult => {
  try {
    new URL(url);
    return createValidationResult(true);
  } catch {
    return createValidationResult(false, [`${fieldName} is not a valid URL: ${url}`]);
  }
};

/**
 * Validate email format
 *
 * @param email - Email to validate
 * @param fieldName - Field name for error message
 * @returns ValidationResult
 */
export const validateEmail = (email: string, fieldName: string = 'email'): ValidationResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return createValidationResult(false, [`${fieldName} is not a valid email: ${email}`]);
  }
  return createValidationResult(true);
};

/**
 * Combine multiple validation results
 *
 * @param results - Array of validation results
 * @returns ValidationResult - Combined result
 */
export const combineValidationResults = (results: ValidationResult[]): ValidationResult => {
  const allErrors: string[] = [];

  for (const result of results) {
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  }

  return createValidationResult(allErrors.length === 0, allErrors);
};

/**
 * Log validation result
 *
 * @param result - Validation result
 * @param context - Context for logging
 */
export const logValidationResult = (result: ValidationResult, context: string): void => {
  if (result.valid) {
    logger.debug(`Validation passed: ${context}`);
  } else {
    logger.error(`Validation failed: ${context}`);
    result.errors.forEach((error) => logger.error(`  - ${error}`));
  }
};
