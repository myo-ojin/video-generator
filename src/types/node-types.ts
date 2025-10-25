/**
 * Node type definitions
 * Based on: .kiro/specs/auto-video-generation/design.md
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Node configuration interface
 */
export interface NodeConfig {
  enabled: boolean;
  timeout: number; // milliseconds
  retryCount: number;
  retryDelay: number; // milliseconds
  [key: string]: any; // node-specific config
}

/**
 * Node input interface
 */
export interface NodeInput {
  previousOutput?: any;
  config: NodeConfig;
  workDir: string;
}

/**
 * Node output metadata
 */
export interface NodeOutputMetadata {
  executionTime: number;
  timestamp: string;
}

/**
 * Node output interface
 */
export interface NodeOutput {
  success: boolean;
  data: any;
  outputPath: string;
  metadata: NodeOutputMetadata;
}

/**
 * Base Node interface that all nodes must implement
 */
export interface Node {
  name: string;
  execute(input: NodeInput): Promise<NodeOutput>;
  validate(input: NodeInput): ValidationResult;
  getConfig(): NodeConfig;
}
