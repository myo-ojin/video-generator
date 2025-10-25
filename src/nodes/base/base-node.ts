/**
 * Base Node Abstract Class
 * Based on: .kiro/specs/auto-video-generation/design.md
 *           .kiro/specs/auto-video-generation/requirements.md (Requirements 1.2, 1.3, 12.1)
 *
 * All nodes must extend this class and implement the abstract methods.
 *
 * Features:
 * - Common execute flow with logging and error handling
 * - Configuration loading and validation
 * - Input/output file path management
 * - Execution time tracking
 */

import { Node, NodeInput, NodeOutput, NodeConfig, ValidationResult } from '../../types/index.js';
import { Logger, createNodeLogger } from '../../utils/logger.js';
import { validateNodeInput } from '../../utils/validator.js';
import { PipelineError } from '../../types/error-types.js';

/**
 * Abstract base class for all nodes
 */
export abstract class BaseNode implements Node {
  protected logger: Logger;
  protected config: NodeConfig;

  /**
   * Constructor
   * @param name - Node name
   * @param config - Node configuration
   */
  constructor(public readonly name: string, config: NodeConfig) {
    this.logger = createNodeLogger(name);
    this.config = config;
  }

  /**
   * Get node configuration
   */
  getConfig(): NodeConfig {
    return this.config;
  }

  /**
   * Validate node input
   * Can be overridden by subclasses for additional validation
   */
  validate(input: NodeInput): ValidationResult {
    return validateNodeInput(input, this.name);
  }

  /**
   * Execute the node
   * This is the main entry point that handles common concerns
   */
  async execute(input: NodeInput): Promise<NodeOutput> {
    const startTime = Date.now();
    this.logger.info(`Starting ${this.name}`);

    try {
      // Validate input
      const validation = this.validate(input);
      if (!validation.valid) {
        throw new PipelineError(
          'VALIDATION_ERROR' as any,
          this.name,
          `Input validation failed: ${validation.errors.join(', ')}`
        );
      }

      // Execute node-specific logic
      this.logger.debug(`Executing node logic for ${this.name}`);
      const result = await this.executeInternal(input);

      // Calculate execution time
      const executionTime = Date.now() - startTime;
      this.logger.info(`${this.name} completed successfully in ${executionTime}ms`);

      // Return result with metadata
      return {
        ...result,
        metadata: {
          executionTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`${this.name} failed after ${executionTime}ms`, error as Error);

      // Return failure output
      return {
        success: false,
        data: null,
        outputPath: '',
        metadata: {
          executionTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Internal execution logic - must be implemented by subclasses
   * This method contains the node-specific logic
   *
   * @param input - Node input
   * @returns Promise<NodeOutput> - Node output (without metadata)
   */
  protected abstract executeInternal(input: NodeInput): Promise<Omit<NodeOutput, 'metadata'>>;

  /**
   * Helper method to create successful output
   */
  protected createSuccessOutput(data: any, outputPath: string): Omit<NodeOutput, 'metadata'> {
    return {
      success: true,
      data,
      outputPath
    };
  }

  /**
   * Helper method to create failure output
   */
  protected createFailureOutput(error: Error): Omit<NodeOutput, 'metadata'> {
    this.logger.error(`Node execution failed: ${error.message}`, error);
    return {
      success: false,
      data: { error: error.message },
      outputPath: ''
    };
  }

  /**
   * Log node configuration (for debugging)
   */
  protected logConfig(): void {
    this.logger.debug(`Node configuration: ${JSON.stringify(this.config, null, 2)}`);
  }

  /**
   * Check if node is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get node timeout in milliseconds
   */
  getTimeout(): number {
    return this.config.timeout;
  }

  /**
   * Get retry count
   */
  getRetryCount(): number {
    return this.config.retryCount;
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(): number {
    return this.config.retryDelay || 1000;
  }
}
