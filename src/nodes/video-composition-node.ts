/**
 * Video Composition Node
 *
 * Combines audio, subtitles, and background into a final video file using FFmpeg.
 */

import { BaseNode } from './base/base-node.js';
import { NodeInput, NodeOutput } from '../types/node-types.js';
import { VideoCompositionNodeConfig } from '../types/config-types.js';
import { PipelineError, ErrorType } from '../types/error-types.js';
import { logger } from '../utils/logger.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

type SubtitleFilterFormat = 'srt' | 'vtt' | 'ass';

/**
 * Video configuration interface
 */
export interface VideoConfig {
  resolution: string;
  fps: number;
  codec: string;
  preset?: string;
  crf?: number;
  backgroundImage?: string;
  backgroundVideo?: string;
  subtitleStyle?: {
    fontSize?: number;
    primaryColor?: string;
    outlineColor?: string;
    outline?: number;
  };
  subtitleFormat?: SubtitleFilterFormat;
}

/**
 * Video Composition Node
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export class VideoCompositionNode extends BaseNode {
  protected declare config: VideoCompositionNodeConfig;

  constructor(config: VideoCompositionNodeConfig) {
    super('VideoCompositionNode', config);
  }

  /**
   * Build FFmpeg command arguments
   */
  private buildFFmpegCommand(
    audioPath: string,
    subtitlePath: string,
    outputPath: string,
    config: VideoConfig,
    subtitleFormat: SubtitleFilterFormat
  ): string[] {
    const args: string[] = [];

    if (config.backgroundVideo) {
      args.push('-i', config.backgroundVideo);
    } else if (config.backgroundImage) {
      args.push('-loop', '1', '-i', config.backgroundImage);
    } else {
      args.push('-f', 'lavfi', '-i', `color=c=black:s=${config.resolution}:r=${config.fps}`);
    }

    args.push('-i', audioPath);
    args.push('-shortest');

    args.push(
      '-c:v',
      config.codec || 'libx264',
      '-preset',
      config.preset || 'medium',
      '-crf',
      String(config.crf || 23),
      '-pix_fmt',
      'yuv420p'
    );

    args.push('-c:a', 'aac', '-b:a', '192k');

    const escapedSubtitlePath = subtitlePath.replace(/\\/g, '\\\\').replace(/:/g, '\\:');

    if (subtitleFormat === 'ass') {
      args.push('-vf', `ass='${escapedSubtitlePath}'`);
    } else {
      const subtitleStyle = config.subtitleStyle || {
        fontSize: 24,
        primaryColor: '&HFFFFFF&',
        outlineColor: '&H000000&',
        outline: 2
      };
      const subtitleFilter = `subtitles='${escapedSubtitlePath}':force_style='FontSize=${subtitleStyle.fontSize},PrimaryColour=${subtitleStyle.primaryColor},OutlineColour=${subtitleStyle.outlineColor},Outline=${subtitleStyle.outline}'`;
      args.push('-vf', subtitleFilter);
    }

    args.push('-s', config.resolution, '-r', String(config.fps));
    args.push('-y', outputPath);

    return args;
  }

  /**
   * Execute FFmpeg command
   */
  private async executeFFmpeg(
    audioPath: string,
    subtitlePath: string,
    config: VideoConfig,
    timeout: number,
    subtitleFormat: SubtitleFilterFormat
  ): Promise<string> {
    const outputPath = path.join(path.dirname(audioPath), 'video.mp4');
    const command = 'ffmpeg';
    const args = this.buildFFmpegCommand(
      audioPath,
      subtitlePath,
      outputPath,
      config,
      config.subtitleFormat ?? subtitleFormat
    );

    logger.info(`Executing FFmpeg command:`);
    logger.info(`  ${command} ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        timeout,
        shell: false, // Don't use shell on Windows to avoid escaping issues
      });

      let stderr = '';
      let lastProgress = '';

      process.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;

        // Extract progress information
        const progressMatch = output.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (progressMatch && progressMatch[1] !== lastProgress) {
          lastProgress = progressMatch[1];
          logger.debug(`FFmpeg progress: time=${lastProgress}`);
        }
      });

      process.on('close', (code) => {
        if (code === 0) {
          logger.info('FFmpeg execution completed successfully');
          resolve(outputPath);
        } else {
          reject(
            new Error(
              `FFmpeg failed with exit code ${code}\nOutput: ${stderr}`
            )
          );
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute FFmpeg: ${error.message}`));
      });
    });
  }

  /**
   * Validate video output
   */
  private async validateVideoOutput(videoPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(videoPath);

      if (stats.size === 0) {
        logger.error('Video file is empty');
        return false;
      }

      if (stats.size < 1024) {
        logger.warn('Video file is suspiciously small');
        return false;
      }

      logger.info(
        `Video file validated: ${(stats.size / 1024 / 1024).toFixed(2)} MB`
      );
      return true;
    } catch (error) {
      logger.error(
        `Video validation failed: ${(error as Error).message}`
      );
      return false;
    }
  }

  /**
   * Execute video composition node
   */
  protected async executeInternal(input: NodeInput): Promise<NodeOutput> {
    const startTime = Date.now();

    try {
      logger.info('Starting Video Composition Node');
      logger.info(`Work directory: ${input.workDir}`);

      // Validate input files
      const audioPath = path.join(input.workDir, 'audio.wav');
      try {
        await fs.access(audioPath);
      } catch {
        throw new PipelineError(
          ErrorType.FILE_NOT_FOUND,
          this.name,
          `Audio file not found: ${audioPath}`,
          new Error('Audio file does not exist')
        );
      }

      const subtitleCandidates: Array<{ format: SubtitleFilterFormat; filename: string }> = [
        { format: 'ass', filename: 'subtitles.ass' },
        { format: 'srt', filename: 'subtitles.srt' },
        { format: 'vtt', filename: 'subtitles.vtt' }
      ];

      let subtitlePath: string | undefined;
      let subtitleFormat: SubtitleFilterFormat | undefined;

      for (const candidate of subtitleCandidates) {
        const candidatePath = path.join(input.workDir, candidate.filename);
        try {
          await fs.access(candidatePath);
          subtitlePath = candidatePath;
          subtitleFormat = candidate.format;
          break;
        } catch {
          continue;
        }
      }

      if (!subtitlePath || !subtitleFormat) {
        throw new PipelineError(
          ErrorType.FILE_NOT_FOUND,
          this.name,
          'Subtitle file not found: expected subtitles.ass / subtitles.srt / subtitles.vtt',
          new Error('Subtitle file does not exist')
        );
      }

      const resolvedSubtitlePath = subtitlePath as string;
      const resolvedSubtitleFormat = subtitleFormat as SubtitleFilterFormat;


      // Check if background file exists (if specified)
      if (this.config.backgroundImage) {
        try {
          await fs.access(this.config.backgroundImage);
        } catch {
          logger.warn(
            `Background image not found: ${this.config.backgroundImage}, will use solid color`
          );
          this.config.backgroundImage = undefined;
        }
      }

      if (this.config.backgroundVideo) {
        try {
          await fs.access(this.config.backgroundVideo);
        } catch {
          logger.warn(
            `Background video not found: ${this.config.backgroundVideo}, will use solid color`
          );
          this.config.backgroundVideo = undefined;
        }
      }

      // Get audio file info
      const audioStats = await fs.stat(audioPath);
      logger.info(
        `Audio file: ${(audioStats.size / 1024).toFixed(2)} KB`
      );

      // Get subtitle file info
      const subtitleStats = await fs.stat(resolvedSubtitlePath);
      logger.info(
        `Subtitle file: ${(subtitleStats.size / 1024).toFixed(2)} KB`
      );

      // Prepare video config
      const videoConfig: VideoConfig = {
        resolution: this.config.resolution || '1280x720',
        fps: this.config.fps || 30,
        codec: this.config.codec || 'libx264',
        preset: this.config.preset || 'medium',
        crf: this.config.crf || 23,
        backgroundImage: this.config.backgroundImage,
        backgroundVideo: this.config.backgroundVideo,
        subtitleStyle: this.config.subtitleStyle,
        subtitleFormat: resolvedSubtitleFormat,
      };

      logger.info(`Video resolution: ${videoConfig.resolution}`);
      logger.info(`Video FPS: ${videoConfig.fps}`);
      logger.info(`Video codec: ${videoConfig.codec}`);

      if (videoConfig.backgroundImage) {
        logger.info(`Background image: ${videoConfig.backgroundImage}`);
      } else if (videoConfig.backgroundVideo) {
        logger.info(`Background video: ${videoConfig.backgroundVideo}`);
      } else {
        logger.info('Background: Solid black color');
      }

      // Execute FFmpeg
      logger.info('Executing FFmpeg...');
      const timeout = this.config.timeout || 600000; // 10 minutes default
      const outputPath = await this.executeFFmpeg(
        audioPath,
        resolvedSubtitlePath,
        videoConfig,
        timeout,
        resolvedSubtitleFormat
      );

      // Validate output
      const isValid = await this.validateVideoOutput(outputPath);
      if (!isValid) {
        throw new PipelineError(
          ErrorType.VALIDATION_ERROR,
          this.name,
          'Video output validation failed',
          new Error('Generated video file is invalid')
        );
      }

      const duration = Date.now() - startTime;
      logger.info(
        `Video Composition Node completed in ${(duration / 1000).toFixed(1)}s`
      );
      logger.info(`Output: ${outputPath}`);

      return {
        success: true,
        data: {
          videoPath: outputPath,
          config: videoConfig,
        },
        outputPath,
        metadata: {
          executionTime: duration,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof PipelineError
          ? error.message
          : `Video composition failed: ${(error as Error).message}`;

      logger.error(errorMessage);

      throw new PipelineError(
        ErrorType.CLI_EXECUTION_ERROR,
        this.name,
        errorMessage,
        error as Error
      );
    }
  }
}
