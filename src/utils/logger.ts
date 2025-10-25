/**
 * Logger utility using Winston
 * Based on: .kiro/specs/auto-video-generation/requirements.md (Requirement 12)
 *
 * Requirements:
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Console and file output
 * - Timestamp and node name in format
 * - Singleton pattern
 * - Environment variable for log level control
 */

import winston from 'winston';
import path from 'path';

// Get log level from environment variable or default to INFO
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Log file path
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, `pipeline-${new Date().toISOString().split('T')[0]}.log`);

/**
 * Custom log format: [Level] [NodeName] Message
 */
const customFormat = winston.format.printf(({ level, message, timestamp, nodeName }) => {
  const nodePrefix = nodeName ? `[${nodeName}] ` : '';
  return `${timestamp} [${level.toUpperCase()}] ${nodePrefix}${message}`;
});

/**
 * Create Winston logger instance
 */
const createLogger = () => {
  return winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      customFormat
    ),
    transports: [
      // Console output
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          customFormat
        )
      }),
      // File output
      new winston.transports.File({
        filename: LOG_FILE,
        format: customFormat
      })
    ]
  });
};

// Singleton logger instance
let loggerInstance: winston.Logger | null = null;

/**
 * Get logger instance (singleton)
 */
export const getLogger = (): winston.Logger => {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
};

/**
 * Logger class with node name context
 */
export class Logger {
  private logger: winston.Logger;
  private nodeName?: string;

  constructor(nodeName?: string) {
    this.logger = getLogger();
    this.nodeName = nodeName;
  }

  /**
   * Log debug message
   */
  debug(message: string): void {
    this.logger.debug(message, { nodeName: this.nodeName });
  }

  /**
   * Log info message
   */
  info(message: string): void {
    this.logger.info(message, { nodeName: this.nodeName });
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    this.logger.warn(message, { nodeName: this.nodeName });
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error): void {
    if (error) {
      this.logger.error(`${message}: ${error.message}`, {
        nodeName: this.nodeName,
        stack: error.stack
      });
    } else {
      this.logger.error(message, { nodeName: this.nodeName });
    }
  }

  /**
   * Set node name context
   */
  setNodeName(nodeName: string): void {
    this.nodeName = nodeName;
  }

  /**
   * Get current log level
   */
  getLogLevel(): string {
    return this.logger.level;
  }

  /**
   * Set log level dynamically
   */
  setLogLevel(level: string): void {
    this.logger.level = level;
  }
}

/**
 * Create a logger with node name
 */
export const createNodeLogger = (nodeName: string): Logger => {
  return new Logger(nodeName);
};

/**
 * Default logger instance (no node name)
 */
export const logger = new Logger();
