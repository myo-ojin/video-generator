#!/usr/bin/env node
/**
 * Pipeline Execution Script
 *
 * Executes the full video generation pipeline (Node 03-08):
 * 1. Research Node - Topic gathering
 * 2. Script Generation Node - Script creation
 * 3. Voice Synthesis Node - Audio synthesis with VOICEVOX
 * 4. Subtitle Generation Node - Subtitle authoring (ASS/SRT)
 * 5. Video Composition Node - Video assembly with FFmpeg
 * 6. YouTube Upload Node - Video upload to YouTube
 *
 * Usage:
 *   ts-node src/scripts/run-pipeline.ts
 *   ts-node src/scripts/run-pipeline.ts --config config/pipeline-config.json
 *   ts-node src/scripts/run-pipeline.ts --config config/pipeline-config.json --output-dir output/test
 *
 * Options:
 *   --config <path>       Path to pipeline config file (default: config/pipeline-config.json)
 *   --output-dir <path>   Output directory (default: output/[YYYY-MM-DD])
 *   --skip-upload         Skip YouTube upload step
 *   --help                Show this help message
 */

import { ResearchNode } from '../nodes/research-node.js';
import { ScriptGenerationNode } from '../nodes/script-generation-node.js';
import { SubtitleGenerationNode } from '../nodes/subtitle-generation-node.js';
import { VoiceSynthesisNode } from '../nodes/voice-synthesis-node.js';
import { VideoCompositionNode } from '../nodes/video-composition-node.js';
import { YouTubeUploadNode } from '../nodes/youtube-upload-node.js';
import {
  PipelineConfig,
  NodeInput,
  NodeOutput,
  ResearchNodeConfig,
  ScriptGenerationNodeConfig,
  SubtitleGenerationNodeConfig,
  VoiceSynthesisNodeConfig,
  VideoCompositionNodeConfig,
  YouTubeUploadNodeConfig
} from '../types/index.js';
import { readJson } from '../utils/file-utils.js';
import { createDateOutputDir } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
import path from 'path';

/**
 * Node execution result
 */
interface NodeExecutionResult {
  nodeName: string;
  success: boolean;
  output: NodeOutput;
  duration: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): {
  configPath: string;
  outputDir?: string;
  skipUpload: boolean;
  showHelp: boolean;
} {
  const args = process.argv.slice(2);
  let configPath = 'config/pipeline-config.json';
  let outputDir: string | undefined;
  let skipUpload = false;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg === '--config' || arg === '-c') {
      configPath = args[++i];
    } else if (arg === '--output-dir' || arg === '-o') {
      outputDir = args[++i];
    } else if (arg === '--skip-upload') {
      skipUpload = true;
    }
  }

  return { configPath, outputDir, skipUpload, showHelp };
}

/**
 * Show help message
 */
function displayHelp(): void {
  console.log(`
Pipeline Execution Script

Executes the full video generation pipeline (Node 03-08):
  1. Research Node - Topic gathering
  2. Script Generation Node - Script creation
  3. Voice Synthesis Node - Audio synthesis with VOICEVOX
  4. Subtitle Generation Node - Subtitle authoring (ASS/SRT)
  5. Video Composition Node - Video assembly with FFmpeg
  6. YouTube Upload Node - Video upload to YouTube

Usage:
  ts-node src/scripts/run-pipeline.ts [options]

Options:
  --config, -c <path>       Path to pipeline config file (default: config/pipeline-config.json)
  --output-dir, -o <path>   Output directory (default: output/[YYYY-MM-DD])
  --skip-upload             Skip YouTube upload step
  --help, -h                Show this help message

Examples:
  # Run full pipeline with default config
  ts-node src/scripts/run-pipeline.ts

  # Run with custom config
  ts-node src/scripts/run-pipeline.ts --config config/pipeline-config.json

  # Run without YouTube upload
  ts-node src/scripts/run-pipeline.ts --skip-upload

  # Run with custom output directory
  ts-node src/scripts/run-pipeline.ts --output-dir output/test

Environment Variables:
  LOG_LEVEL                 Set log level (DEBUG, INFO, WARN, ERROR)
  `);
}

/**
 * Execute a single node with error handling
 */
async function executeNode(
  node: any,
  nodeName: string,
  input: NodeInput
): Promise<NodeExecutionResult> {
  logger.info('─'.repeat(60));
  logger.info(`Executing: ${nodeName}`);
  logger.info('─'.repeat(60));

  const startTime = Date.now();

  try {
    const output = await node.execute(input);
    const duration = Date.now() - startTime;

    if (output.success) {
      logger.info(`✓ ${nodeName} completed successfully`);
      logger.info(`  Execution time: ${(duration / 1000).toFixed(2)}s`);
      logger.info(`  Output file: ${output.outputPath}`);
    } else {
      logger.error(`✗ ${nodeName} failed`);
      logger.error(`  Error: ${output.data?.error || 'Unknown error'}`);
    }

    return {
      nodeName,
      success: output.success,
      output,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`✗ ${nodeName} threw an exception`);
    logger.error(`  Error: ${(error as Error).message}`);
    if ((error as Error).stack) {
      logger.debug((error as Error).stack!);
    }

    return {
      nodeName,
      success: false,
      output: {
        success: false,
        data: { error: (error as Error).message },
        outputPath: '',
        metadata: {
          executionTime: duration,
          timestamp: new Date().toISOString()
        }
      },
      duration
    };
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    // Parse arguments
    const { configPath, outputDir, skipUpload, showHelp } = parseArgs();

    if (showHelp) {
      displayHelp();
      process.exit(0);
    }

    logger.info('═'.repeat(60));
    logger.info('VIDEO GENERATION PIPELINE - FULL EXECUTION');
    logger.info('═'.repeat(60));

    // Load pipeline configuration
    logger.info(`Loading pipeline configuration from: ${configPath}`);
    const config = await readJson<PipelineConfig>(path.resolve(configPath));
    logger.info('Pipeline configuration loaded successfully');

    // Determine output directory
    const workDir = outputDir
      ? path.resolve(outputDir)
      : await createDateOutputDir(config.outputDir || 'output');

    logger.info(`Output directory: ${workDir}`);
    logger.info('');

    // Track execution results
    const results: NodeExecutionResult[] = [];
    let previousOutput: NodeOutput | undefined;

    // ============================================================
    // Node 03: Research Node
    // ============================================================
    if (config.nodes?.research && config.nodes.research.enabled !== false) {
      const researchNode = new ResearchNode(config.nodes.research as ResearchNodeConfig);
      const input: NodeInput = {
        config: config.nodes.research,
        workDir,
        previousOutput
      };

      const result = await executeNode(researchNode, 'Research Node', input);
      results.push(result);

      if (!result.success) {
        logger.error('Pipeline halted due to Research Node failure');
        process.exit(1);
      }

      previousOutput = result.output;
    } else {
      logger.info('Research Node is disabled, skipping...');
    }

    // ============================================================
    // Node 04: Script Generation Node
    // ============================================================
    if (config.nodes?.scriptGeneration && config.nodes.scriptGeneration.enabled !== false) {
      const scriptGenNode = new ScriptGenerationNode(config.nodes.scriptGeneration as ScriptGenerationNodeConfig);
      const input: NodeInput = {
        config: config.nodes.scriptGeneration,
        workDir,
        previousOutput
      };

      const result = await executeNode(scriptGenNode, 'Script Generation Node', input);
      results.push(result);

      if (!result.success) {
        logger.error('Pipeline halted due to Script Generation Node failure');
        process.exit(1);
      }

      previousOutput = result.output;
    } else {
      logger.info('Script Generation Node is disabled, skipping...');
    }

    // ============================================================
    // Node 05: Voice Synthesis Node
    // ============================================================
    if (config.nodes?.voiceSynthesis && config.nodes.voiceSynthesis.enabled !== false) {
      const voiceNode = new VoiceSynthesisNode(config.nodes.voiceSynthesis as VoiceSynthesisNodeConfig);
      const input: NodeInput = {
        config: config.nodes.voiceSynthesis,
        workDir,
        previousOutput
      };

      const result = await executeNode(voiceNode, 'Voice Synthesis Node', input);
      results.push(result);

      if (!result.success) {
        logger.error('Pipeline halted due to Voice Synthesis Node failure');
        process.exit(1);
      }

      previousOutput = result.output;
    } else {
      logger.info('Voice Synthesis Node is disabled, skipping...');
    }

    // ============================================================
    // Node 06: Subtitle Generation Node
    // ============================================================
    if (config.nodes?.subtitleGeneration && config.nodes.subtitleGeneration.enabled !== false) {
      const subtitleNode = new SubtitleGenerationNode(config.nodes.subtitleGeneration as SubtitleGenerationNodeConfig);
      const input: NodeInput = {
        config: config.nodes.subtitleGeneration,
        workDir,
        previousOutput
      };

      const result = await executeNode(subtitleNode, 'Subtitle Generation Node', input);
      results.push(result);

      if (!result.success) {
        logger.error('Pipeline halted due to Subtitle Generation Node failure');
        process.exit(1);
      }

      previousOutput = result.output;
    } else {
      logger.info('Subtitle Generation Node is disabled, skipping...');
    }

    // ============================================================
    // Node 07: Video Composition Node
    // ============================================================
    if (config.nodes?.videoComposition && config.nodes.videoComposition.enabled !== false) {
      const videoNode = new VideoCompositionNode(config.nodes.videoComposition as VideoCompositionNodeConfig);
      const input: NodeInput = {
        config: config.nodes.videoComposition,
        workDir,
        previousOutput
      };

      const result = await executeNode(videoNode, 'Video Composition Node', input);
      results.push(result);

      if (!result.success) {
        logger.error('Pipeline halted due to Video Composition Node failure');
        process.exit(1);
      }

      previousOutput = result.output;
    } else {
      logger.info('Video Composition Node is disabled, skipping...');
    }

    // ============================================================
    // Node 08: YouTube Upload Node
    // ============================================================
    if (!skipUpload && config.nodes?.youtubeUpload && config.nodes.youtubeUpload.enabled !== false) {
      const uploadNode = new YouTubeUploadNode(config.nodes.youtubeUpload as YouTubeUploadNodeConfig);
      const input: NodeInput = {
        config: config.nodes.youtubeUpload,
        workDir,
        previousOutput
      };

      const result = await executeNode(uploadNode, 'YouTube Upload Node', input);
      results.push(result);

      if (!result.success) {
        logger.error('Pipeline halted due to YouTube Upload Node failure');
        process.exit(1);
      }

      previousOutput = result.output;
    } else {
      if (skipUpload) {
        logger.info('YouTube Upload Node skipped (--skip-upload flag)');
      } else {
        logger.info('YouTube Upload Node is disabled, skipping...');
      }
    }

    // ============================================================
    // Pipeline Completed - Display Summary
    // ============================================================
    logger.info('');
    logger.info('═'.repeat(60));
    logger.info('PIPELINE EXECUTION SUMMARY');
    logger.info('═'.repeat(60));

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const successCount = results.filter(r => r.success).length;

    logger.info(`Total nodes executed: ${results.length}`);
    logger.info(`Successful: ${successCount}`);
    logger.info(`Failed: ${results.length - successCount}`);
    logger.info(`Total execution time: ${(totalDuration / 1000).toFixed(2)}s`);
    logger.info('');

    logger.info('Node execution times:');
    results.forEach(r => {
      const status = r.success ? '✓' : '✗';
      const time = (r.duration / 1000).toFixed(2);
      logger.info(`  ${status} ${r.nodeName}: ${time}s`);
    });

    logger.info('');
    logger.info(`Output directory: ${workDir}`);

    if (previousOutput?.data?.videoId) {
      logger.info(`YouTube video URL: https://www.youtube.com/watch?v=${previousOutput.data.videoId}`);
    }

    logger.info('═'.repeat(60));
    logger.info('✓ PIPELINE COMPLETED SUCCESSFULLY');
    logger.info('═'.repeat(60));

    process.exit(0);
  } catch (error) {
    logger.error('═'.repeat(60));
    logger.error('FATAL ERROR DURING PIPELINE EXECUTION');
    logger.error('═'.repeat(60));
    logger.error((error as Error).message);
    if ((error as Error).stack) {
      logger.debug((error as Error).stack!);
    }
    logger.error('═'.repeat(60));
    process.exit(1);
  }
}

// Execute main function
main();
