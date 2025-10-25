#!/usr/bin/env node
/**
 * Research Node Standalone Execution Script
 *
 * Usage:
 *   ts-node src/scripts/run-research.ts
 *   ts-node src/scripts/run-research.ts --config config/research-config.json
 *   ts-node src/scripts/run-research.ts --config config/research-config.json --output-dir output/test
 *
 * Options:
 *   --config <path>       Path to config file (default: config/research-config.json)
 *   --output-dir <path>   Output directory (default: output/[YYYY-MM-DD])
 *   --help                Show this help message
 */

import { ResearchNode } from '../nodes/research-node.js';
import { ResearchNodeConfig, NodeInput } from '../types/index.js';
import { readJson } from '../utils/file-utils.js';
import { createDateOutputDir } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
import path from 'path';

/**
 * Parse command line arguments
 */
function parseArgs(): { configPath: string; outputDir?: string; showHelp: boolean } {
  const args = process.argv.slice(2);
  let configPath = 'config/research-config.json';
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
Research Node Standalone Execution Script

Usage:
  ts-node src/scripts/run-research.ts [options]

Options:
  --config, -c <path>       Path to config file (default: config/research-config.json)
  --output-dir, -o <path>   Output directory (default: output/[YYYY-MM-DD])
  --help, -h                Show this help message

Examples:
  # Run with default config
  ts-node src/scripts/run-research.ts

  # Run with custom config
  ts-node src/scripts/run-research.ts --config config/research-config.tutorial.json

  # Run with custom output directory
  ts-node src/scripts/run-research.ts --output-dir output/test

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
    logger.info('Research Node Standalone Execution');
    logger.info('='.repeat(60));

    // Load configuration
    logger.info(`Loading configuration from: ${configPath}`);
    const config = await readJson<ResearchNodeConfig>(path.resolve(configPath));

    logger.info('Configuration loaded successfully');
    logger.debug(`Config: ${JSON.stringify(config, null, 2)}`);

    // Determine output directory
    const workDir = outputDir
      ? path.resolve(outputDir)
      : await createDateOutputDir('output');

    logger.info(`Output directory: ${workDir}`);

    // Create Research Node
    const researchNode = new ResearchNode(config);

    // Prepare input
    const input: NodeInput = {
      config,
      workDir,
      previousOutput: undefined
    };

    // Execute node
    logger.info('Starting Research Node execution...');
    const startTime = Date.now();

    const output = await researchNode.execute(input);

    const duration = Date.now() - startTime;

    // Display results
    logger.info('='.repeat(60));
    if (output.success) {
      logger.info('✓ Research Node completed successfully');
      logger.info(`Execution time: ${duration}ms`);
      logger.info(`Output file: ${output.outputPath}`);
      logger.info(`Topics found: ${output.data?.topicCount || 0}`);

      if (output.data?.topics) {
        logger.info('\nTopics:');
        output.data.topics.forEach((topic: any, index: number) => {
          logger.info(`  ${index + 1}. ${topic.title}`);
          if (topic.source) {
            logger.info(`     Source: ${topic.source}`);
          }
        });
      }
    } else {
      logger.error('✗ Research Node failed');
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
