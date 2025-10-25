#!/usr/bin/env node
/**
 * Video Composition Node Standalone Execution Script
 *
 * Usage:
 *   ts-node src/scripts/run-video-composition.ts
 *   ts-node src/scripts/run-video-composition.ts --config config/video-composition-config.json
 *   ts-node src/scripts/run-video-composition.ts --config config/video-composition-config.json --output-dir output/test
 *
 * Options:
 *   --config <path>       Path to config file (default: config/video-composition-config.json)
 *   --output-dir <path>   Output directory (default: output/[YYYY-MM-DD])
 *   --help                Show this help message
 *
 * Requirements:
 *   - FFmpeg must be installed and available in PATH
 *   - audio.wav must exist in the output directory
 *   - subtitles.srt must exist in the output directory
 */

import { VideoCompositionNode } from '../nodes/video-composition-node.js';
import { VideoCompositionNodeConfig, NodeInput } from '../types/index.js';
import { readJson } from '../utils/file-utils.js';
import { createDateOutputDir } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

/**
 * Parse command line arguments
 */
function parseArgs(): { configPath: string; outputDir?: string; showHelp: boolean } {
  const args = process.argv.slice(2);
  let configPath = 'config/video-composition-config.json';
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
Video Composition Node Standalone Execution Script

Usage:
  ts-node src/scripts/run-video-composition.ts [options]

Options:
  --config, -c <path>       Path to config file (default: config/video-composition-config.json)
  --output-dir, -o <path>   Output directory (default: output/[YYYY-MM-DD])
  --help, -h                Show this help message

Examples:
  # Run with default config
  ts-node src/scripts/run-video-composition.ts

  # Run with custom config (different resolution)
  ts-node src/scripts/run-video-composition.ts --config config/video-composition-config.hd.json

  # Run with custom output directory
  ts-node src/scripts/run-video-composition.ts --output-dir output/test

Requirements:
  - FFmpeg must be installed and available in PATH
  - audio.wav must exist in the output directory
  - subtitles.srt must exist in the output directory

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
    logger.info('Video Composition Node Standalone Execution');
    logger.info('='.repeat(60));

    // Load configuration
    logger.info(`Loading configuration from: ${configPath}`);
    const config = await readJson<VideoCompositionNodeConfig>(path.resolve(configPath));

    logger.info('Configuration loaded successfully');
    logger.debug(`Config: ${JSON.stringify(config, null, 2)}`);

    // Determine output directory
    const workDir = outputDir
      ? path.resolve(outputDir)
      : await createDateOutputDir('output');

    logger.info(`Output directory: ${workDir}`);
    logger.info(`Resolution: ${config.resolution || '1280x720'}`);
    logger.info(`FPS: ${config.fps || 30}`);
    logger.info(`Codec: ${config.codec || 'libx264'}`);

    // Create Video Composition Node
    const videoCompositionNode = new VideoCompositionNode(config);

    // Prepare input
    const input: NodeInput = {
      config,
      workDir,
      previousOutput: undefined
    };

    // Execute node
    logger.info('Starting Video Composition Node execution...');
    logger.info('Checking FFmpeg availability...');
    const startTime = Date.now();

    const output = await videoCompositionNode.execute(input);

    const duration = Date.now() - startTime;

    // Display results
    logger.info('='.repeat(60));
    if (output.success) {
      logger.info('✓ Video Composition Node completed successfully');
      logger.info(`Execution time: ${(duration / 1000).toFixed(1)}s`);
      logger.info(`Output file: ${output.outputPath}`);
      logger.info(`Video size: ${((output.data?.videoPath ? fs.statSync(output.data.videoPath).size : 0) / 1024 / 1024).toFixed(2)} MB`);
      logger.info(`Resolution: ${output.data?.config?.resolution || 'N/A'}`);
      logger.info(`FPS: ${output.data?.config?.fps || 'N/A'}`);
      logger.info(`Codec: ${output.data?.config?.codec || 'N/A'}`);
    } else {
      logger.error('✗ Video Composition Node failed');
      logger.error(`Error: ${output.data?.error || 'Unknown error'}`);
      logger.error('\nTroubleshooting:');
      logger.error('  1. Ensure FFmpeg is installed and available in PATH');
      logger.error('  2. Check that audio.wav exists in the output directory');
      logger.error('  3. Check that subtitles.srt exists in the output directory');
      logger.error('  4. Verify background image/video path (if specified)');
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
