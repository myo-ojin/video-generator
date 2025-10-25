/**
 * Voice Synthesis Node Implementation
 * Based on: .kiro/specs/auto-video-generation/nodes/06-voice-synthesis.md
 *           .kiro/specs/auto-video-generation/requirements.md (Requirement 7)
 *
 * Features:
 * - VOICEVOX HTTP API integration
 * - Voice parameter configuration (speaker, speed, pitch, intonation)
 * - WAV format audio output
 * - VOICEVOX availability check
 */

import { BaseNode } from './base/base-node.js';
import { NodeInput, NodeOutput, VoiceSynthesisNodeConfig, AudioData } from '../types/index.js';
import { readText, fileExists } from '../utils/file-utils.js';
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';

interface VoiceConfig {
  speaker: number;
  speed: number;
  pitch: number;
  intonation: number;
}

export class VoiceSynthesisNode extends BaseNode {
  constructor(config: VoiceSynthesisNodeConfig) {
    super('VoiceSynthesisNode', config);
  }

  /**
   * Execute the voice synthesis node
   */
  protected async executeInternal(input: NodeInput): Promise<Omit<NodeOutput, 'metadata'>> {
    try {
      this.logger.info('Starting Voice Synthesis Node execution');
      const config = this.config as VoiceSynthesisNodeConfig;

      // Check VOICEVOX availability
      const isAvailable = await this.checkVOICEVOXAvailability(config);
      if (!isAvailable) {
        throw new Error('VOICEVOX is not available. Please ensure VOICEVOX is running.');
      }

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

      // Prepare voice config
      const voiceConfig: VoiceConfig = {
        speaker: config.speaker || 1,
        speed: config.speed || 1.0,
        pitch: config.pitch || 0.0,
        intonation: config.intonation || 1.0
      };

      this.logger.info(`Voice config: speaker=${voiceConfig.speaker}, speed=${voiceConfig.speed}, pitch=${voiceConfig.pitch}, intonation=${voiceConfig.intonation}`);

      // Synthesize audio
      const audioBuffer = await this.executeVOICEVOX(script, voiceConfig, config);

      // Save audio file
      const outputPath = path.join(input.workDir, 'audio.wav');
      await this.saveAudioFile(audioBuffer, outputPath);

      // Get audio duration (approximate based on script length and speed)
      const duration = this.estimateAudioDuration(script, voiceConfig.speed);

      // Prepare output data
      const audioData: AudioData = {
        filePath: outputPath,
        duration,
        format: 'wav',
        speaker: voiceConfig.speaker,
        generatedAt: new Date().toISOString()
      };

      this.logger.info(`Voice Synthesis Node completed: ${audioBuffer.length} bytes, ~${duration}s`);

      return this.createSuccessOutput(audioData, outputPath);
    } catch (error) {
      this.logger.error('Voice Synthesis Node execution failed', error as Error);
      return this.createFailureOutput(error as Error);
    }
  }

  /**
   * Check if VOICEVOX is available
   */
  private async checkVOICEVOXAvailability(config: VoiceSynthesisNodeConfig): Promise<boolean> {
    const host = config.voicevoxHost || 'http://localhost:50021';

    try {
      this.logger.debug(`Checking VOICEVOX availability at ${host}`);
      const response = await axios.get(`${host}/version`, {
        timeout: 5000
      });

      if (response.status === 200) {
        this.logger.info(`VOICEVOX is available (version: ${response.data})`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`VOICEVOX is not available at ${host}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Execute VOICEVOX API to synthesize audio
   */
  private async executeVOICEVOX(
    script: string,
    voiceConfig: VoiceConfig,
    config: VoiceSynthesisNodeConfig
  ): Promise<Buffer> {
    const host = config.voicevoxHost || 'http://localhost:50021';
    const timeout = config.timeout || 300000; // 5 minutes default

    try {
      // Step 1: Create audio query
      this.logger.debug('Creating audio query...');
      const queryUrl = `${host}/audio_query?text=${encodeURIComponent(script)}&speaker=${voiceConfig.speaker}`;

      const queryResponse = await axios.post(queryUrl, null, {
        timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (queryResponse.status !== 200) {
        throw new Error(`VOICEVOX audio_query failed: ${queryResponse.statusText}`);
      }

      const audioQuery = queryResponse.data;

      // Step 2: Apply voice parameters
      audioQuery.speedScale = voiceConfig.speed;
      audioQuery.pitchScale = voiceConfig.pitch;
      audioQuery.intonationScale = voiceConfig.intonation;

      this.logger.debug('Synthesizing audio...');

      // Step 3: Synthesize audio
      const synthesisUrl = `${host}/synthesis?speaker=${voiceConfig.speaker}`;

      const synthesisResponse = await axios.post(synthesisUrl, audioQuery, {
        timeout,
        headers: {
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      });

      if (synthesisResponse.status !== 200) {
        throw new Error(`VOICEVOX synthesis failed: ${synthesisResponse.statusText}`);
      }

      return Buffer.from(synthesisResponse.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to VOICEVOX at ${host}. Please ensure VOICEVOX is running.`);
        }
        if (error.code === 'ETIMEDOUT') {
          throw new Error('VOICEVOX request timed out. The script may be too long.');
        }
        throw new Error(`VOICEVOX API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Save audio buffer to file
   */
  private async saveAudioFile(audio: Buffer, filePath: string): Promise<void> {
    await fs.writeFile(filePath, audio);
    this.logger.debug(`Audio file saved: ${filePath} (${audio.length} bytes)`);
  }

  /**
   * Estimate audio duration based on script length and speed
   * Uses same calculation as subtitle generation (5.8 chars/sec base)
   */
  private estimateAudioDuration(script: string, speedScale: number): number {
    const baseCharsPerSecond = 5.8; // Base reading speed
    const adjustedCharsPerSecond = baseCharsPerSecond * speedScale;
    return Math.ceil(script.length / adjustedCharsPerSecond);
  }
}
