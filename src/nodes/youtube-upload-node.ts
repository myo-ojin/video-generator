/**
 * YouTube Upload Node
 *
 * Uploads video files to YouTube using Google APIs.
 */

import { BaseNode } from './base/base-node.js';
import { NodeInput, NodeOutput } from '../types/node-types.js';
import { YouTubeUploadNodeConfig } from '../types/config-types.js';
import { PipelineError, ErrorType } from '../types/error-types.js';
import { logger } from '../utils/logger.js';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';

/**
 * Video metadata interface
 */
export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  privacyStatus: 'public' | 'unlisted' | 'private';
  category: string;
}

/**
 * Upload result interface
 */
export interface UploadResult {
  videoId: string;
  url: string;
  uploadTime: string;
  title: string;
  privacyStatus: string;
}

/**
 * YouTube credentials interface
 */
export interface YouTubeCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  refresh_token?: string;
}

/**
 * YouTube Upload Node
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
export class YouTubeUploadNode extends BaseNode {
  protected declare config: YouTubeUploadNodeConfig;

  constructor(config: YouTubeUploadNodeConfig) {
    super('YouTubeUploadNode', config);
  }

  /**
   * Authenticate with YouTube using OAuth 2.0
   */
  private async authenticate(credentials: YouTubeCredentials): Promise<OAuth2Client> {
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri
    );

    // Check if we have a saved refresh token
    if (credentials.refresh_token) {
      oauth2Client.setCredentials({
        refresh_token: credentials.refresh_token,
      });

      // Refresh access token if needed
      try {
        await oauth2Client.getAccessToken();
        logger.info('YouTube authentication successful (using refresh token)');
        return oauth2Client;
      } catch (error) {
        logger.error(`Failed to refresh token: ${(error as Error).message}`);
        throw new PipelineError(
          ErrorType.API_ERROR,
          this.name,
          'YouTube authentication failed. Please re-authenticate and update refresh_token.',
          error as Error
        );
      }
    }

    throw new PipelineError(
      ErrorType.CONFIG_ERROR,
      this.name,
      'No refresh token found. Please complete OAuth flow first.',
      new Error('Missing refresh_token in credentials')
    );
  }

  /**
   * Upload video to YouTube
   */
  private async uploadVideo(
    videoPath: string,
    metadata: VideoMetadata,
    auth: OAuth2Client
  ): Promise<UploadResult> {
    const youtube = google.youtube({ version: 'v3', auth });

    logger.info(`Uploading video: ${metadata.title}`);
    logger.info(`Privacy status: ${metadata.privacyStatus}`);

    // Get file size for logging
    const stats = await fs.stat(videoPath);
    const fileSize = stats.size;
    logger.info(`Video file size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    try {
      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: metadata.category,
          },
          status: {
            privacyStatus: metadata.privacyStatus,
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: createReadStream(videoPath),
        },
      });

      const videoId = response.data.id!;
      const url = `https://www.youtube.com/watch?v=${videoId}`;

      logger.info(`Video uploaded successfully: ${url}`);
      logger.info(`Video ID: ${videoId}`);

      return {
        videoId,
        url,
        uploadTime: new Date().toISOString(),
        title: metadata.title,
        privacyStatus: metadata.privacyStatus,
      };
    } catch (error: any) {
      logger.error(`YouTube upload failed: ${error.message}`);

      // Check for quota exceeded error
      if (error.code === 403 && error.message.includes('quota')) {
        throw new PipelineError(
          ErrorType.API_ERROR,
          this.name,
          'YouTube API quota exceeded. Please try again later.',
          error
        );
      }

      throw new PipelineError(
        ErrorType.API_ERROR,
        this.name,
        `YouTube upload failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Prepare video metadata from config
   */
  private prepareMetadata(config: YouTubeUploadNodeConfig, workDir: string): VideoMetadata {
    // Generate title from template or use default
    const title = config.titleTemplate
      ? this.replacePlaceholders(config.titleTemplate, workDir)
      : `AIニュース - ${new Date().toLocaleDateString('ja-JP')}`;

    // Generate description from template or use default
    const description = config.descriptionTemplate
      ? this.replacePlaceholders(config.descriptionTemplate, workDir)
      : 'AIに関する最新ニュースをお届けします。';

    return {
      title,
      description,
      tags: config.tags || ['AI', 'テクノロジー', 'ニュース'],
      privacyStatus: config.privacyStatus || 'private',
      category: config.category || '28', // Science & Technology
    };
  }

  /**
   * Replace placeholders in template strings
   */
  private replacePlaceholders(template: string, workDir: string): string {
    const now = new Date();

    return template
      .replace('{date}', now.toLocaleDateString('ja-JP'))
      .replace('{year}', String(now.getFullYear()))
      .replace('{month}', String(now.getMonth() + 1).padStart(2, '0'))
      .replace('{day}', String(now.getDate()).padStart(2, '0'))
      .replace('{workDir}', path.basename(workDir));
  }

  /**
   * Execute YouTube upload node
   */
  protected async executeInternal(input: NodeInput): Promise<NodeOutput> {
    const startTime = Date.now();

    try {
      logger.info('Starting YouTube Upload Node');
      logger.info(`Work directory: ${input.workDir}`);

      // Check if video file exists
      const videoPath = path.join(input.workDir, 'video.mp4');
      try {
        await fs.access(videoPath);
      } catch {
        throw new PipelineError(
          ErrorType.FILE_NOT_FOUND,
          this.name,
          `Video file not found: ${videoPath}`,
          new Error('Video file does not exist')
        );
      }

      // Load credentials
      const credentialsPath =
        this.config.credentialsPath || path.resolve('config/credentials.json');
      logger.info(`Loading credentials from: ${credentialsPath}`);

      let credentials: YouTubeCredentials;
      try {
        const credentialsContent = await fs.readFile(credentialsPath, 'utf-8');
        const credentialsData = JSON.parse(credentialsContent);
        credentials = credentialsData.youtube || credentialsData;
      } catch (error) {
        throw new PipelineError(
          ErrorType.CONFIG_ERROR,
          this.name,
          `Failed to load credentials: ${(error as Error).message}`,
          error as Error
        );
      }

      // Authenticate
      logger.info('Authenticating with YouTube...');
      const auth = await this.authenticate(credentials);

      // Prepare metadata
      const metadata = this.prepareMetadata(this.config, input.workDir);
      logger.info(`Video title: ${metadata.title}`);
      logger.info(`Video tags: ${metadata.tags.join(', ')}`);
      logger.info(`Category ID: ${metadata.category}`);

      // Upload video
      logger.info('Starting video upload...');
      const result = await this.uploadVideo(videoPath, metadata, auth);

      // Save result to file
      const outputPath = path.join(input.workDir, 'upload-result.json');
      await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
      logger.info(`Upload result saved to: ${outputPath}`);

      const duration = Date.now() - startTime;
      logger.info(`YouTube Upload Node completed in ${(duration / 1000).toFixed(1)}s`);

      return {
        success: true,
        data: result,
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
          : `YouTube upload failed: ${(error as Error).message}`;

      logger.error(errorMessage);

      throw error instanceof PipelineError
        ? error
        : new PipelineError(
            ErrorType.API_ERROR,
            this.name,
            errorMessage,
            error as Error
          );
    }
  }
}
