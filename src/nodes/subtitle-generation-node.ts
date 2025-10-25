/**
 * Subtitle Generation Node Implementation
 * Based on: .kiro/specs/auto-video-generation/nodes/05-subtitle-generation.md
 *           .kiro/specs/auto-video-generation/requirements.md (Requirement 6)
 *
 * Features:
 * - Script segmentation with character limits (42 chars/line, 2 lines max)
 * - Timestamp assignment based on reading speed (5.8 chars/sec)
 * - SRT format generation
 * - UTF-8 encoded output
 */

import { BaseNode } from './base/base-node.js';
import { NodeInput, NodeOutput, SubtitleGenerationNodeConfig, SubtitleSegment, SubtitleData } from '../types/index.js';
import { readText, writeText, fileExists } from '../utils/file-utils.js';
import path from 'path';

export class SubtitleGenerationNode extends BaseNode {
  constructor(config: SubtitleGenerationNodeConfig) {
    super('SubtitleGenerationNode', config);
  }

  /**
   * Execute the subtitle generation node
   */
  protected async executeInternal(input: NodeInput): Promise<Omit<NodeOutput, 'metadata'>> {
    try {
      this.logger.info('Starting Subtitle Generation Node execution');
      const config = this.config as SubtitleGenerationNodeConfig;

      // Load script
      const scriptPath = path.join(input.workDir, 'script.txt');

      if (!(await fileExists(scriptPath))) {
        throw new Error(`Script file not found: ${scriptPath}`);
      }

      const script = await readText(scriptPath);

      if (!script || script.trim().length === 0) {
        throw new Error('Script is empty');
      }

      this.logger.info(`Loaded script: ${script.length} characters`);

      // Split into segments
      let segments = this.splitIntoSegments(script, config);
      this.logger.info(`Created ${segments.length} subtitle segments`);

      // Assign timestamps
      segments = this.assignTimestamps(segments, config);

      // Generate SRT format
      const srt = this.generateSRT(segments);

      // Prepare output data
      const totalDuration = this.calculateTotalDuration(segments);
      const subtitleData: SubtitleData = {
        format: 'srt',
        segments,
        totalDuration,
        generatedAt: new Date().toISOString()
      };

      // Save output to subtitles.srt (UTF-8)
      const outputPath = path.join(input.workDir, 'subtitles.srt');
      await writeText(outputPath, srt);

      this.logger.info(`Subtitle Generation Node completed: ${segments.length} segments, ${totalDuration}s total`);

      return this.createSuccessOutput(subtitleData, outputPath);
    } catch (error) {
      this.logger.error('Subtitle Generation Node execution failed', error as Error);
      return this.createFailureOutput(error as Error);
    }
  }

  /**
   * Split script into subtitle segments
   */
  private splitIntoSegments(script: string, config: SubtitleGenerationNodeConfig): SubtitleSegment[] {
    const maxCharsPerLine = config.maxCharsPerLine || 42;
    const maxLines = config.maxLines || 2;
    const maxCharsPerSegment = maxCharsPerLine * maxLines;

    // Split by sentences (Japanese punctuation: 。！？)
    const sentences = this.splitBySentences(script);

    const segments: SubtitleSegment[] = [];
    let currentSegment = '';
    let index = 1;

    for (const sentence of sentences) {
      // If adding this sentence exceeds limit, save current segment
      if (currentSegment && (currentSegment + sentence).length > maxCharsPerSegment) {
        segments.push({
          index: index++,
          startTime: '',
          endTime: '',
          text: this.formatSegmentText(currentSegment, maxCharsPerLine, maxLines)
        });
        currentSegment = sentence;
      } else {
        currentSegment += sentence;
      }
    }

    // Add remaining segment
    if (currentSegment.trim()) {
      segments.push({
        index: index++,
        startTime: '',
        endTime: '',
        text: this.formatSegmentText(currentSegment, maxCharsPerLine, maxLines)
      });
    }

    return segments;
  }

  /**
   * Split text by sentences
   */
  private splitBySentences(text: string): string[] {
    // Split by Japanese sentence endings: 。！？ and newlines
    const parts = text.split(/([。！？\n])/g);
    const sentences: string[] = [];

    for (let i = 0; i < parts.length; i += 2) {
      const content = parts[i];
      const punctuation = parts[i + 1] || '';

      if (content.trim()) {
        sentences.push((content + punctuation).trim());
      }
    }

    return sentences;
  }

  /**
   * Format segment text to fit within line limits
   */
  private formatSegmentText(text: string, maxCharsPerLine: number, maxLines: number): string {
    text = text.trim();

    // If text fits in one line, return as is
    if (text.length <= maxCharsPerLine) {
      return text;
    }

    // Try to split into multiple lines at natural break points
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // If current line is at or near max length and we hit a break point
      if (currentLine.length >= maxCharsPerLine && this.isBreakPoint(char)) {
        lines.push(currentLine);
        currentLine = '';
        // Skip the break point character if it's whitespace or comma
        if (/[\s、，,]/.test(char)) {
          continue;
        }
      }

      currentLine += char;

      // Force break if we exceed max chars per line
      if (currentLine.length >= maxCharsPerLine && i < text.length - 1) {
        lines.push(currentLine);
        currentLine = '';
      }
    }

    // Add remaining text
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    // Take only max lines
    return lines.slice(0, maxLines).join('\n');
  }

  /**
   * Check if character is a natural break point
   */
  private isBreakPoint(char: string): boolean {
    // Japanese and English break points: 、。，, and spaces
    return /[、。，,\s！？]/.test(char);
  }

  /**
   * Assign timestamps to segments
   */
  private assignTimestamps(
    segments: SubtitleSegment[],
    config: SubtitleGenerationNodeConfig
  ): SubtitleSegment[] {
    // Reading speed: ~350 characters per minute for Japanese (5.8 chars/sec)
    // This should match VOICEVOX speed setting
    const charsPerSecond = config.readingSpeed || 5.8;
    const minDuration = 2; // seconds
    const maxDuration = 7; // seconds

    let currentTime = 0;

    return segments.map(segment => {
      // Calculate duration based on character count (excluding line breaks)
      const charCount = segment.text.replace(/\n/g, '').length;
      let duration = Math.max(minDuration, charCount / charsPerSecond);
      duration = Math.min(maxDuration, duration);

      const startTime = this.formatTimestamp(currentTime);
      currentTime += duration;
      const endTime = this.formatTimestamp(currentTime);

      return {
        ...segment,
        startTime,
        endTime
      };
    });
  }

  /**
   * Format timestamp in SRT format (HH:MM:SS,mmm)
   */
  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  }

  /**
   * Generate SRT format string
   */
  private generateSRT(segments: SubtitleSegment[]): string {
    return segments
      .map(segment => {
        return `${segment.index}\n${segment.startTime} --> ${segment.endTime}\n${segment.text}\n`;
      })
      .join('\n');
  }

  /**
   * Calculate total duration from segments
   */
  private calculateTotalDuration(segments: SubtitleSegment[]): number {
    if (segments.length === 0) {
      return 0;
    }

    const lastSegment = segments[segments.length - 1];
    return this.parseTimestamp(lastSegment.endTime);
  }

  /**
   * Parse timestamp string to seconds
   */
  private parseTimestamp(timestamp: string): number {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const secondsParts = parts[2].split(',');
    const seconds = parseInt(secondsParts[0], 10);
    const millis = parseInt(secondsParts[1], 10);

    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }
}
