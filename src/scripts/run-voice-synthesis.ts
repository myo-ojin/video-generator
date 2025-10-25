#!/usr/bin/env node
/**
 * Voice Synthesis Node Standalone Execution Script
 *
 * Usage:
 *   ts-node src/scripts/run-voice-synthesis.ts
 *   ts-node src/scripts/run-voice-synthesis.ts --config config/voice-synthesis-config.json
 *   ts-node src/scripts/run-voice-synthesis.ts --config config/voice-synthesis-config.json --output-dir output/test
 *
 * Options:
 *   --config <path>       Path to config file (default: config/voice-synthesis-config.json)
 *   --output-dir <path>   Output directory (default: output/[YYYY-MM-DD])
 *   --help                Show this help message
 *
 * Requirements:
 *   - VOICEVOX must be running on http://localhost:50021
 *   - script.txt must exist in the output directory
 */

import { VoiceSynthesisNode } from '../nodes/voice-synthesis-node.js';
import { VoiceSynthesisNodeConfig, NodeInput } from '../types/index.js';
import { readJson } from '../utils/file-utils.js';
import { createDateOutputDir } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
import path from 'path';

/**
 * Parse command line arguments
 */
function parseArgs(): { configPath: string; outputDir?: string; showHelp: boolean } {
  const args = process.argv.slice(2);
  let configPath = 'config/voice-synthesis-config.json';
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
Voice Synthesis Node Standalone Execution Script

Usage:
  ts-node src/scripts/run-voice-synthesis.ts [options]

Options:
  --config, -c <path>       Path to config file (default: config/voice-synthesis-config.json)
  --output-dir, -o <path>   Output directory (default: output/[YYYY-MM-DD])
  --help, -h                Show this help message

Examples:
  # Run with default config
  ts-node src/scripts/run-voice-synthesis.ts

  # Run with custom config (different voice character)
  ts-node src/scripts/run-voice-synthesis.ts --config config/voice-synthesis-config.zundamon.json

  # Run with custom output directory
  ts-node src/scripts/run-voice-synthesis.ts --output-dir output/test

Requirements:
  - VOICEVOX must be running on http://localhost:50021 (or configured host)
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
    logger.info('Voice Synthesis Node Standalone Execution');
    logger.info('='.repeat(60));

    // Load configuration
    logger.info(`Loading configuration from: ${configPath}`);
    const config = await readJson<VoiceSynthesisNodeConfig>(path.resolve(configPath));

    logger.info('Configuration loaded successfully');
    logger.debug(`Config: ${JSON.stringify(config, null, 2)}`);

    // Determine output directory
    const workDir = outputDir
      ? path.resolve(outputDir)
      : await createDateOutputDir('output');

    logger.info(`Output directory: ${workDir}`);
    logger.info(`VOICEVOX host: ${config.voicevoxHost || 'http://localhost:50021'}`);

    // Create Voice Synthesis Node
    const voiceSynthesisNode = new VoiceSynthesisNode(config);

    // Prepare input
    const input: NodeInput = {
      config,
      workDir,
      previousOutput: undefined
    };

    // Execute node
    logger.info('Starting Voice Synthesis Node execution...');
    logger.info('Checking VOICEVOX availability...');
    const startTime = Date.now();

    const output = await voiceSynthesisNode.execute(input);

    const duration = Date.now() - startTime;

    // Display results
    logger.info('='.repeat(60));
    if (output.success) {
      logger.info('✓ Voice Synthesis Node completed successfully');
      logger.info(`Execution time: ${duration}ms`);
      logger.info(`Output file: ${output.outputPath}`);
      logger.info(`Audio size: ${((output.data?.filePath ? require('fs').statSync(output.data.filePath).size : 0) / 1024).toFixed(2)} KB`);
      logger.info(`Estimated duration: ${output.data?.duration || 0}s`);
      logger.info(`Speaker ID: ${output.data?.speaker || 'N/A'}`);
      logger.info(`Format: ${output.data?.format || 'wav'}`);
    } else {
      logger.error('✗ Voice Synthesis Node failed');
      logger.error(`Error: ${output.data?.error || 'Unknown error'}`);
      logger.error('\nTroubleshooting:');
      logger.error('  1. Ensure VOICEVOX is running');
      logger.error('  2. Check that script.txt exists in the output directory');
      logger.error('  3. Verify VOICEVOX host configuration');
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
