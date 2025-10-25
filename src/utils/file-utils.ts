/**
 * File utility functions
 * Based on: .kiro/specs/auto-video-generation/requirements.md (Requirements 11.1, 11.2)
 *
 * IMPORTANT: All files with Japanese text MUST use UTF-8 encoding
 *
 * Features:
 * - JSON read/write with UTF-8 encoding
 * - Text file read/write with UTF-8 encoding
 * - Directory creation and checking
 * - Relative and absolute path support
 */

import fs from 'fs/promises';
import path from 'path';
import { FileNotFoundError } from '../types/error-types.js';
import { Logger } from './logger.js';

const logger = new Logger('File-Utils');

/**
 * Read JSON file with UTF-8 encoding
 *
 * @param filePath - Path to JSON file
 * @returns Promise<T> - Parsed JSON object
 * @throws FileNotFoundError if file doesn't exist
 */
export const readJson = async <T = any>(filePath: string): Promise<T> => {
  try {
    logger.debug(`Reading JSON file: ${filePath}`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FileNotFoundError('File-Utils', `File not found: ${filePath}`, error as Error);
    }
    throw error;
  }
};

/**
 * Write JSON file with UTF-8 encoding
 *
 * @param filePath - Path to JSON file
 * @param data - Data to write
 * @param pretty - Pretty print JSON (default: true)
 */
export const writeJson = async (
  filePath: string,
  data: any,
  pretty: boolean = true
): Promise<void> => {
  try {
    logger.debug(`Writing JSON file: ${filePath}`);
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await ensureDir(dir);

    await fs.writeFile(filePath, content, 'utf-8');
    logger.debug(`Successfully wrote JSON file: ${filePath}`);
  } catch (error) {
    logger.error(`Failed to write JSON file: ${filePath}`, error as Error);
    throw error;
  }
};

/**
 * Read text file with UTF-8 encoding
 * CRITICAL: Used for Japanese text files (scripts, subtitles)
 *
 * @param filePath - Path to text file
 * @returns Promise<string> - File content
 * @throws FileNotFoundError if file doesn't exist
 */
export const readText = async (filePath: string): Promise<string> => {
  try {
    logger.debug(`Reading text file: ${filePath}`);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FileNotFoundError('File-Utils', `File not found: ${filePath}`, error as Error);
    }
    throw error;
  }
};

/**
 * Write text file with UTF-8 encoding
 * CRITICAL: Used for Japanese text files (scripts, subtitles)
 *
 * @param filePath - Path to text file
 * @param content - Content to write
 */
export const writeText = async (filePath: string, content: string): Promise<void> => {
  try {
    logger.debug(`Writing text file: ${filePath}`);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await ensureDir(dir);

    // Always use UTF-8 encoding for Japanese text
    await fs.writeFile(filePath, content, 'utf-8');
    logger.debug(`Successfully wrote text file: ${filePath}`);
  } catch (error) {
    logger.error(`Failed to write text file: ${filePath}`, error as Error);
    throw error;
  }
};

/**
 * Check if file exists
 *
 * @param filePath - Path to file
 * @returns Promise<boolean> - true if file exists
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if directory exists
 *
 * @param dirPath - Path to directory
 * @returns Promise<boolean> - true if directory exists
 */
export const dirExists = async (dirPath: string): Promise<boolean> => {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

/**
 * Ensure directory exists (create if not exists)
 *
 * @param dirPath - Path to directory
 */
export const ensureDir = async (dirPath: string): Promise<void> => {
  try {
    if (!(await dirExists(dirPath))) {
      logger.debug(`Creating directory: ${dirPath}`);
      await fs.mkdir(dirPath, { recursive: true });
    }
  } catch (error) {
    logger.error(`Failed to create directory: ${dirPath}`, error as Error);
    throw error;
  }
};

/**
 * Delete file if exists
 *
 * @param filePath - Path to file
 */
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    if (await fileExists(filePath)) {
      logger.debug(`Deleting file: ${filePath}`);
      await fs.unlink(filePath);
    }
  } catch (error) {
    logger.error(`Failed to delete file: ${filePath}`, error as Error);
    throw error;
  }
};

/**
 * List files in directory
 *
 * @param dirPath - Path to directory
 * @param extension - Filter by extension (e.g., '.json')
 * @returns Promise<string[]> - Array of file paths
 */
export const listFiles = async (dirPath: string, extension?: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(dirPath, entry.name));

    if (extension) {
      files = files.filter((file) => file.endsWith(extension));
    }

    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

/**
 * Get file size in bytes
 *
 * @param filePath - Path to file
 * @returns Promise<number> - File size in bytes
 */
export const getFileSize = async (filePath: string): Promise<number> => {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FileNotFoundError('File-Utils', `File not found: ${filePath}`, error as Error);
    }
    throw error;
  }
};

/**
 * Resolve path (handles both relative and absolute paths)
 *
 * @param filePath - Path to resolve
 * @param basePath - Base path for relative paths (default: cwd)
 * @returns string - Absolute path
 */
export const resolvePath = (filePath: string, basePath?: string): string => {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(basePath || process.cwd(), filePath);
};

/**
 * Create date-based output directory (output/YYYY-MM-DD/)
 *
 * @param baseDir - Base output directory (default: 'output')
 * @returns Promise<string> - Path to created directory
 */
export const createDateOutputDir = async (baseDir: string = 'output'): Promise<string> => {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const dirPath = path.join(baseDir, date);
  await ensureDir(dirPath);
  logger.info(`Created output directory: ${dirPath}`);
  return dirPath;
};

/**
 * Copy file
 *
 * @param srcPath - Source file path
 * @param destPath - Destination file path
 */
export const copyFile = async (srcPath: string, destPath: string): Promise<void> => {
  try {
    logger.debug(`Copying file: ${srcPath} -> ${destPath}`);

    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    await ensureDir(destDir);

    await fs.copyFile(srcPath, destPath);
    logger.debug(`Successfully copied file: ${destPath}`);
  } catch (error) {
    logger.error(`Failed to copy file: ${srcPath} -> ${destPath}`, error as Error);
    throw error;
  }
};
