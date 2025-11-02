/**
 * Subtitle Generation Node Implementation
 * Based on: Kiro Specs Archive/auto-video-generation/nodes/05-subtitle-generation.md
 *           Kiro Specs Archive/auto-video-generation/requirements.md (Requirement 6)
 *
 * Features:
 * - Script segmentation with configurable character limits
 * - Timestamp assignment based on configurable reading speed and min/max duration
 * - Supports SRT, VTT and ASS (stylised) subtitle output
 * - Optional keyword highlighting for ASS output
 */

import { BaseNode } from './base/base-node.js';
import {
  NodeInput,
  NodeOutput,
  SubtitleGenerationNodeConfig,
  SubtitleSegment,
  SubtitleData
} from '../types/index.js';
import { readText, writeText, fileExists } from '../utils/file-utils.js';
import path from 'path';

type SubtitleFormat = 'srt' | 'vtt' | 'ass';

interface AssStyleConfig {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  secondaryColor: string;
  outlineColor: string;
  backColor: string;
  outline: number;
  shadow: number;
  bold: number;
  alignment: number;
  marginV: number;
  marginL: number;
  marginR: number;
  fadeIn: number;
  fadeOut: number;
}

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
      const format = (config.format ?? 'srt') as SubtitleFormat;

      const scriptPath = path.join(input.workDir, 'script.txt');
      if (!(await fileExists(scriptPath))) {
        throw new Error(`Script file not found: ${scriptPath}`);
      }

      const rawScript = await readText(scriptPath);
      if (!rawScript || rawScript.trim().length === 0) {
        throw new Error('Script is empty');
      }

      this.logger.info(`Loaded script: ${rawScript.length} characters`);

      // Segment and timestamp subtitles
      let segments = this.splitIntoSegments(rawScript, config);
      this.logger.info(`Created ${segments.length} subtitle segments`);
      segments = this.assignTimestamps(segments, config);

      // Prepare output depending on requested format
      let outputContent: string;
      let outputFileName: string;
      switch (format) {
        case 'ass':
          outputContent = this.generateASS(segments, config);
          outputFileName = 'subtitles.ass';
          break;
        case 'vtt':
          outputContent = this.generateVTT(segments);
          outputFileName = 'subtitles.vtt';
          break;
        case 'srt':
        default:
          outputContent = this.generateSRT(segments);
          outputFileName = 'subtitles.srt';
          break;
      }

      const outputPath = path.join(input.workDir, outputFileName);
      await writeText(outputPath, outputContent);

      const totalDuration = this.calculateTotalDuration(segments);
      this.logger.info(
        `Subtitle Generation Node completed: ${segments.length} segments, ${totalDuration.toFixed(2)}s total`
      );

      const subtitleData: SubtitleData = {
        format,
        segments,
        totalDuration,
        generatedAt: new Date().toISOString()
      };

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
    const maxCharsPerLine = config.maxCharsPerLine ?? 42;
    const maxLines = config.maxLines ?? 2;
    const maxCharsPerSegment = maxCharsPerLine * maxLines;

    const sentences = this.splitBySentences(script);
    const segments: SubtitleSegment[] = [];
    let currentSegment = '';
    let index = 1;

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) {
        continue;
      }

      if (currentSegment && (currentSegment + trimmed).length > maxCharsPerSegment) {
        segments.push({
          index: index++,
          startTime: '',
          endTime: '',
          text: this.formatSegmentText(currentSegment, maxCharsPerLine, maxLines)
        });
        currentSegment = trimmed;
      } else {
        currentSegment += trimmed;
      }
    }

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
   * Split text by sentences (handles Japanese and English punctuation)
   */
  private splitBySentences(text: string): string[] {
    const parts = text
      .replace(/\r/g, '')
      .split(/([。！？!?]\s*|\n+)/);

    const sentences: string[] = [];
    let buffer = '';

    for (const part of parts) {
      if (!part) {
        continue;
      }

      buffer += part;
      if (/^[。！？!?\n]+$/.test(part)) {
        sentences.push(buffer);
        buffer = '';
      }
    }

    if (buffer.trim()) {
      sentences.push(buffer);
    }

    return sentences;
  }

  /**
   * Break segment into lines respecting maxCharsPerLine/maxLines
   */
  private formatSegmentText(text: string, maxCharsPerLine: number, maxLines: number): string {
    const sanitized = text.replace(/\s+/g, ' ').trim();
    if (sanitized.length <= maxCharsPerLine) {
      return sanitized;
    }

    const lines: string[] = [];
    let currentLine = '';

    for (const char of sanitized) {
      if (currentLine.length >= maxCharsPerLine && this.isBreakPoint(char)) {
        lines.push(currentLine.trim());
        currentLine = '';
        if (/^[,、。\s]$/.test(char)) {
          continue;
        }
      }

      currentLine += char;

      if (currentLine.length >= maxCharsPerLine) {
        lines.push(currentLine.trim());
        currentLine = '';
      }

      if (lines.length === maxLines) {
        currentLine = '';
        break;
      }
    }

    if (currentLine.trim() && lines.length < maxLines) {
      lines.push(currentLine.trim());
    }

    return lines.slice(0, maxLines).join('\n');
  }

  /**
   * Natural break point characters
   */
  private isBreakPoint(char: string): boolean {
    return /[、。.,!?\s]/.test(char);
  }

  /**
   * Assign timestamps to segments
   */
  private assignTimestamps(
    segments: SubtitleSegment[],
    config: SubtitleGenerationNodeConfig
  ): SubtitleSegment[] {
    const readingSpeed = config.readingSpeed ?? 5.8;
    const minDuration = config.minDuration ?? 1.8;
    const maxDuration = config.maxDuration ?? 3.0;

    let currentTime = 0;

    return segments.map(segment => {
      const charCount = segment.text.replace(/\n/g, '').length;
      let duration = charCount / readingSpeed;
      duration = Math.max(minDuration, Math.min(maxDuration, duration));

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
   * Generate SRT content
   */
  private generateSRT(segments: SubtitleSegment[]): string {
    return segments
      .map(segment => {
        return `${segment.index}\n${segment.startTime} --> ${segment.endTime}\n${segment.text}\n`;
      })
      .join('\n');
  }

  /**
   * Generate VTT content
   */
  private generateVTT(segments: SubtitleSegment[]): string {
    const lines: string[] = ['WEBVTT', ''];
    for (const segment of segments) {
      const start = segment.startTime.replace(',', '.');
      const end = segment.endTime.replace(',', '.');
      lines.push(`${start} --> ${end}`);
      lines.push(segment.text.replace(/\n/g, ' '));
      lines.push('');
    }
    return lines.join('\n');
  }

  /**
   * Generate ASS content with styling/highlighting
   */
  private generateASS(
    segments: SubtitleSegment[],
    config: SubtitleGenerationNodeConfig
  ): string {
    const style = this.getAssStyle(config);
    const marginL = Math.max(0, Math.round(style.marginL));
    const marginR = Math.max(0, Math.round(style.marginR));
    const marginV = Math.max(0, Math.round(style.marginV));

    const header = [
      '[Script Info]',
      'ScriptType: v4.00+',
      'PlayResX: 1080',
      'PlayResY: 1920',
      'WrapStyle: 2',
      'ScaledBorderAndShadow: yes',
      '',
      '[V4+ Styles]',
      'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
      `Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},${style.secondaryColor},${style.outlineColor},${style.backColor},${style.bold},0,0,0,100,100,0,0,3,${style.outline},${style.shadow},${style.alignment},${marginL},${marginR},${marginV},1`,
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
    ];

    const dialogues = segments.map(segment => {
      const start = this.formatAsstime(segment.startTime);
      const end = this.formatAsstime(segment.endTime);
      const text = this.prepareAssText(segment.text, config, style);
      return `Dialogue: 0,${start},${end},Default,,${marginL},${marginR},${marginV},,${text}`;
    });

    return header.concat(dialogues).join('\n');
  }

  /**
   * Prepare ASS text with fade and optional highlight
   */
  private prepareAssText(text: string, config: SubtitleGenerationNodeConfig, style: AssStyleConfig): string {
    const baseColor = style.primaryColor ?? '&H00FFFFFF&';
    const highlightEnabled = config.highlight?.enabled ?? true;
    const highlightPattern = config.highlight?.pattern
      ? new RegExp(config.highlight.pattern, 'g')
      : /([0-9０-９]+[0-9０-９.,％万億]*|[A-Z]{2,}[A-Za-z0-9]*)/g;
    const highlightColor = config.highlight?.color ?? '&H0000E0B8&';

    let processed = text.replace(/\r/g, '').replace(/\n/g, '\\N');
    processed = processed.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');

    if (highlightEnabled) {
      processed = processed.replace(highlightPattern, match => `\\{\\1c${highlightColor}}${match}\\{\\1c${baseColor}}`);
      processed = processed.replace(/\\\\\{\\1c/g, '{\\1c').replace(/\\\}/g, '}');
    }

    const fadeIn = Math.max(0, Math.round(style.fadeIn));
    const fadeOut = Math.max(0, Math.round(style.fadeOut));
    return `{\\fad(${fadeIn},${fadeOut})}${processed}`;
  }

  /**
   * Build ASS style from config
   */
  private getAssStyle(config: SubtitleGenerationNodeConfig): AssStyleConfig {
    const style = config.style ?? {};
    return {
      fontName: style.fontName ?? 'Noto Sans JP Bold',
      fontSize: style.fontSize ?? 68,
      primaryColor: style.primaryColor ?? '&H00FFFFFF&',
      secondaryColor: style.primaryColor ?? '&H00FFFFFF&',
      outlineColor: style.outlineColor ?? '&H00000000&',
      backColor: style.backColor ?? '&H60000000&',
      outline: style.outline ?? 4,
      shadow: style.shadow ?? 1,
      bold: style.bold ?? 1,
      alignment: style.alignment ?? 5,
      marginV: style.marginV ?? 320,
      marginL: style.marginL ?? 60,
      marginR: style.marginR ?? 60,
      fadeIn: style.fadeIn ?? 120,
      fadeOut: style.fadeOut ?? 150
    };
  }

  /**
   * Convert SRT timestamp to ASS timestamp (H:MM:SS.CC)
   */
  private formatAsstime(timestamp: string): string {
    const totalSeconds = this.parseTimestamp(timestamp);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor(((totalSeconds % 1) * 100) + 0.5);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format seconds to SRT timestamp
   */
  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
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
    const [hh, mm, rest] = timestamp.split(':');
    const [ss, ms] = rest.split(',');
    return (
      parseInt(hh, 10) * 3600 +
      parseInt(mm, 10) * 60 +
      parseInt(ss, 10) +
      parseInt(ms, 10) / 1000
    );
  }
}
