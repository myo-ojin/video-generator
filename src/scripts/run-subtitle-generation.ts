#!/usr/bin/env node
/**
 * Subtitle Generation Node Standalone Execution Script
 *
 * Usage:
 *   ts-node src/scripts/run-subtitle-generation.ts
 *   ts-node src/scripts/run-subtitle-generation.ts --config config/subtitle-generation-config.json
 *   ts-node src/scripts/run-subtitle-generation.ts --config config/subtitle-generation-config.json --output-dir output/test
 *
 * Options:
 *   --config <path>       Path to config file (default: config/subtitle-generation-config.json)
 *   --output-dir <path>   Output directory (default: output/[YYYY-MM-DD])
 *   --help                Show this help message
 *
 * Note: This script requires script.txt to exist in the output directory.
 */

import { SubtitleGenerationNode } from '../nodes/subtitle-generation-node.js';
import { SubtitleGenerationNodeConfig, NodeInput } from '../types/index.js';
import { readJson, createDateOutputDir, fileExists } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
import path from 'path';

/**
 * Parse command line arguments
 */
function parseArgs(): { configPath: string; outputDir?: string; showHelp: boolean } {
  const args = process.argv.slice(2);
  let configPath = 'config/subtitle-generation-config.json';
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
Subtitle Generation Node Standalone Execution Script

Usage:
  ts-node src/scripts/run-subtitle-generation.ts [options]

Options:
  --config, -c <path>       Path to config file (default: config/subtitle-generation-config.json)
  --output-dir, -o <path>   Output directory (default: output/[YYYY-MM-DD])
  --help, -h                Show this help message

Examples:
  # Run with default configuration
  ts-node src/scripts/run-subtitle-generation.ts

  # Run with custom configuration
  ts-node src/scripts/run-subtitle-generation.ts --config config/subtitle-generation-config.json

  # Run with custom output directory
  ts-node src/scripts/run-subtitle-generation.ts --output-dir output/test

Requirements:
  - script.txt must exist in the output directory

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
    logger.info('Subtitle Generation Node Standalone Execution');
    logger.info('='.repeat(60));

    // Determine output directory
    const workDir = outputDir
      ? path.resolve(outputDir)
      : await createDateOutputDir('output');

    logger.info(`Output directory: ${workDir}`);

    // Load configuration
    let config: SubtitleGenerationNodeConfig;
    if (await fileExists(configPath)) {
      config = await readJson(configPath);
      logger.info(`Loaded configuration from: ${configPath}`);
    } else {
      // Use default configuration
      config = {
        enabled: true,
        timeout: 60000,
        retryCount: 2,
        retryDelay: 1000,
        format: 'srt',
        maxCharsPerLine: 42,
        maxLines: 2,
        readingSpeed: 5.8
      };
      logger.warn(`Configuration file not found: ${configPath}. Using default configuration.`);
    }

    // Create Subtitle Generation Node
    const subtitleGenerationNode = new SubtitleGenerationNode(config);

    // Prepare input
    const input: NodeInput = {
      config,
      workDir,
      previousOutput: undefined
    };

    // Execute node
    logger.info('Starting Subtitle Generation Node execution...');
    const startTime = Date.now();

    const output = await subtitleGenerationNode.execute(input);

    const duration = Date.now() - startTime;

    // Display results
    logger.info('='.repeat(60));
    if (output.success) {
      logger.info('✓ Subtitle Generation Node completed successfully');
      logger.info(`Execution time: ${duration}ms`);
      logger.info(`Output file: ${output.outputPath}`);
      logger.info(`Segments: ${output.data?.segments?.length || 0}`);
      logger.info(`Total duration: ${output.data?.totalDuration?.toFixed(1) || 0}s`);

      if (output.data?.segments && output.data.segments.length > 0) {
        logger.info('\nFirst 3 segments:');
        output.data.segments.slice(0, 3).forEach((segment: any) => {
          logger.info(`  [${segment.index}] ${segment.startTime} --> ${segment.endTime}`);
          logger.info(`      ${segment.text.replace(/\n/g, '\n      ')}`);
        });
      }
    } else {
      logger.error('✗ Subtitle Generation Node failed');
      logger.error(`Error: ${output.data?.error || 'Unknown error'}`);
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
