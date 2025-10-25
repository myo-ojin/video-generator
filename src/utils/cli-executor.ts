/**
 * CLI Executor utility
 * Based on: .kiro/specs/auto-video-generation/requirements.md (Requirements 4.1, 5.1, 12.2)
 *
 * Features:
 * - Execute CLI commands with timeout
 * - Capture stdout and stderr
 * - Detailed error logging
 * - Windows path handling
 */

import { spawn } from 'child_process';
import { CLIExecutionError, TimeoutError } from '../types/error-types.js';
import { Logger } from './logger.js';

/**
 * CLI execution options
 */
export interface ExecOptions {
  timeout?: number; // milliseconds, default 30000 (30 seconds)
  cwd?: string; // working directory
  env?: NodeJS.ProcessEnv; // environment variables
}

/**
 * CLI execution result
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number; // milliseconds
}

/**
 * Execute a CLI command
 *
 * @param command - Command to execute
 * @param args - Command arguments
 * @param options - Execution options
 * @returns Promise with execution result
 * @throws CLIExecutionError if command fails
 * @throws TimeoutError if command times out
 */
export const execCommand = async (
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> => {
  const logger = new Logger('CLI-Executor');
  const timeout = options.timeout || 30000; // Default 30 seconds
  const startTime = Date.now();

  logger.debug(`Executing command: ${command} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      shell: true, // Enable shell for Windows compatibility
      windowsHide: true // Hide console window on Windows
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');

      // Force kill after 5 seconds if process doesn't terminate
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    // Capture stdout
    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Capture stderr
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle process exit
    child.on('close', (exitCode: number | null) => {
      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;

      if (timedOut) {
        const error = new TimeoutError(
          'CLI-Executor',
          `Command timed out after ${timeout}ms: ${command} ${args.join(' ')}`
        );
        logger.error(`Command timed out: ${command}`, error);
        reject(error);
        return;
      }

      const result: ExecResult = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode ?? -1,
        executionTime
      };

      logger.debug(`Command completed in ${executionTime}ms with exit code ${exitCode}`);

      if (exitCode !== 0) {
        const error = new CLIExecutionError(
          'CLI-Executor',
          `Command failed with exit code ${exitCode}: ${command} ${args.join(' ')}\nStderr: ${stderr}`
        );
        logger.error(`Command failed: ${command}`, error);
        reject(error);
        return;
      }

      resolve(result);
    });

    // Handle process error (e.g., command not found)
    child.on('error', (error: Error) => {
      clearTimeout(timeoutId);
      const cliError = new CLIExecutionError(
        'CLI-Executor',
        `Failed to execute command: ${command} ${args.join(' ')}`,
        error
      );
      logger.error(`Command execution failed: ${command}`, cliError);
      reject(cliError);
    });
  });
};

/**
 * Check if a command is available in the system
 *
 * @param command - Command to check
 * @returns Promise<boolean> - true if command exists
 */
export const checkCommandExists = async (command: string): Promise<boolean> => {
  const logger = new Logger('CLI-Executor');

  try {
    // Use 'where' on Windows, 'which' on Unix
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';
    await execCommand(checkCommand, [command], { timeout: 5000 });
    logger.debug(`Command found: ${command}`);
    return true;
  } catch (error) {
    logger.debug(`Command not found: ${command}`);
    return false;
  }
};

/**
 * Execute command with input piped to stdin
 *
 * @param command - Command to execute
 * @param args - Command arguments
 * @param input - Input to pipe to stdin
 * @param options - Execution options
 * @returns Promise with execution result
 */
export const execCommandWithInput = async (
  command: string,
  args: string[] = [],
  input: string,
  options: ExecOptions = {}
): Promise<ExecResult> => {
  const logger = new Logger('CLI-Executor');
  const timeout = options.timeout || 30000;
  const startTime = Date.now();

  logger.debug(`Executing command with input: ${command} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      shell: true,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    // Write input to stdin and close
    if (child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode: number | null) => {
      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;

      if (timedOut) {
        const error = new TimeoutError(
          'CLI-Executor',
          `Command timed out after ${timeout}ms: ${command} ${args.join(' ')}`
        );
        reject(error);
        return;
      }

      const result: ExecResult = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode ?? -1,
        executionTime
      };

      if (exitCode !== 0) {
        const error = new CLIExecutionError(
          'CLI-Executor',
          `Command failed with exit code ${exitCode}: ${command} ${args.join(' ')}\nStderr: ${stderr}`
        );
        reject(error);
        return;
      }

      resolve(result);
    });

    child.on('error', (error: Error) => {
      clearTimeout(timeoutId);
      const cliError = new CLIExecutionError(
        'CLI-Executor',
        `Failed to execute command: ${command} ${args.join(' ')}`,
        error
      );
      reject(cliError);
    });
  });
};
