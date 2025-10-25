#!/usr/bin/env node
/**
 * YouTube Upload Node Standalone Execution Script
 *
 * Usage:
 *   ts-node src/scripts/run-youtube-upload.ts
 *   ts-node src/scripts/run-youtube-upload.ts --config config/youtube-upload-config.json
 *   ts-node src/scripts/run-youtube-upload.ts --config config/youtube-upload-config.json --output-dir output/test
 *
 * Options:
 *   --config <path>       Path to config file (default: config/youtube-upload-config.json)
 *   --output-dir <path>   Output directory (default: output/[YYYY-MM-DD])
 *   --help                Show this help message
 *
 * Requirements:
 *   - config/credentials.json must exist with valid YouTube OAuth credentials
 *   - video.mp4 must exist in the output directory
 *
 * Note:
 *   This script requires valid YouTube API credentials with OAuth 2.0 refresh token.
 *   See config/README.md for setup instructions.
 */

import { YouTubeUploadNode } from '../nodes/youtube-upload-node.js';
import { YouTubeUploadNodeConfig, NodeInput } from '../types/index.js';
import { readJson } from '../utils/file-utils.js';
import { createDateOutputDir } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
import path from 'path';

/**
 * Parse command line arguments
 */
function parseArgs(): { configPath: string; outputDir?: string; showHelp: boolean } {
  const args = process.argv.slice(2);
  let configPath = 'config/youtube-upload-config.json';
  let outputDir: string | undefined;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg === '--config' || arg === '-c') {
      configPath = args[++i];
    } else if (arg === '--output-dir' || arg === '-o') {
      outputDir = args[++i];
    }
  }

  return { configPath, outputDir, showHelp };
}

/**
 * Show help message
 */
function displayHelp(): void {
  console.log(`
YouTube Upload Node Standalone Execution Script

Usage:
  ts-node src/scripts/run-youtube-upload.ts [options]

Options:
  --config, -c <path>       Path to config file (default: config/youtube-upload-config.json)
  --output-dir, -o <path>   Output directory (default: output/[YYYY-MM-DD])
  --help, -h                Show this help message

Examples:
  # Run with default config
  ts-node src/scripts/run-youtube-upload.ts

  # Run with custom config
  ts-node src/scripts/run-youtube-upload.ts --config config/youtube-upload-config.custom.json

  # Run with custom output directory
  ts-node src/scripts/run-youtube-upload.ts --output-dir output/test

Requirements:
  - config/credentials.json must exist with valid YouTube OAuth credentials
  - video.mp4 must exist in the output directory

Setup:
  1. Create OAuth 2.0 credentials in Google Cloud Console
  2. Enable YouTube Data API v3
  3. Complete OAuth flow to get refresh_token
  4. Add credentials to config/credentials.json

For detailed setup instructions, see config/README.md

Environment Variables:
  LOG_LEVEL                 Set log level (DEBUG, INFO, WARN, ERROR)
  `);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    // Parse arguments
    const { configPath, outputDir, showHelp } = parseArgs();

    if (showHelp) {
      displayHelp();
      process.exit(0);
    }

    logger.info('='.repeat(60));
    logger.info('YouTube Upload Node Standalone Execution');
    logger.info('='.repeat(60));

    // Load configuration
    logger.info(`Loading configuration from: ${configPath}`);
    const config = await readJson<YouTubeUploadNodeConfig>(path.resolve(configPath));

    logger.info('Configuration loaded successfully');
    logger.debug(`Config: ${JSON.stringify(config, null, 2)}`);

    // Determine output directory
    const workDir = outputDir
      ? path.resolve(outputDir)
      : await createDateOutputDir('output');

    logger.info(`Output directory: ${workDir}`);
    logger.info(`Privacy status: ${config.privacyStatus}`);
    logger.info(`Category: ${config.category}`);

    // Create YouTube Upload Node
    const youtubeUploadNode = new YouTubeUploadNode(config);

    // Prepare input
    const input: NodeInput = {
      config,
      workDir,
      previousOutput: undefined
    };

    // Execute node
    logger.info('Starting YouTube Upload Node execution...');
    logger.info('Note: This will upload the video to YouTube');
    logger.warn(`Privacy status: ${config.privacyStatus}`);
    const startTime = Date.now();

    const output = await youtubeUploadNode.execute(input);

    const duration = Date.now() - startTime;

    // Display results
    logger.info('='.repeat(60));
    if (output.success) {
      logger.info('✓ YouTube Upload Node completed successfully');
      logger.info(`Execution time: ${(duration / 1000).toFixed(1)}s`);
      logger.info(`Result file: ${output.outputPath}`);
      logger.info(`Video ID: ${output.data?.videoId || 'N/A'}`);
      logger.info(`Video URL: ${output.data?.url || 'N/A'}`);
      logger.info(`Title: ${output.data?.title || 'N/A'}`);
      logger.info(`Privacy Status: ${output.data?.privacyStatus || 'N/A'}`);
    } else {
      logger.error('✗ YouTube Upload Node failed');
      logger.error(`Error: ${output.data?.error || 'Unknown error'}`);
      logger.error('\nTroubleshooting:');
      logger.error('  1. Ensure config/credentials.json exists and contains valid OAuth credentials');
      logger.error('  2. Verify that refresh_token is valid');
      logger.error('  3. Check that video.mp4 exists in the output directory');
      logger.error('  4. Verify YouTube Data API v3 is enabled in Google Cloud Console');
      logger.error('  5. Check YouTube API quota (10,000 units/day default)');
      process.exit(1);
    }
    logger.info('='.repeat(60));

    process.exit(0);
  } catch (error) {
    logger.error('Fatal error during execution:');
    logger.error((error as Error).message);
    if ((error as Error).stack) {
      logger.debug((error as Error).stack!);
    }
    process.exit(1);
  }
}

// Execute main function
main();
