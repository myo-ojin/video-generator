/**
 * Configuration type definitions
 * Based on: Kiro Specs Archive/auto-video-generation/design.md
 */

import { NodeConfig } from './node-types.js';

/**
 * Log level type
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Pipeline configuration interface
 */
export interface PipelineConfig {
  outputDir: string;
  logLevel: LogLevel;
  userProfilePath: string;
  credentialsPath: string;
  nodes: {
    strategyAnalysis?: NodeConfig;
    promptRefinement?: NodeConfig;
    research?: ResearchNodeConfig;
    scriptGeneration?: ScriptGenerationNodeConfig;
    subtitleGeneration?: SubtitleGenerationNodeConfig;
    voiceSynthesis?: VoiceSynthesisNodeConfig;
    videoComposition?: VideoCompositionNodeConfig;
    youtubeUpload?: YouTubeUploadNodeConfig;
    analyticsCollection?: NodeConfig;
  };
}

/**
 * Research node specific configuration
 */
export interface ResearchNodeConfig extends NodeConfig {
  codexCommand: string;
  codexArgs: string[];
  defaultTheme?: string;
  defaultKeywords?: string[];
  topicCount: number;
  enableDuplicateCheck: boolean;
  duplicateCheckDays?: number;
  maxHistoryDays?: number;
  topicHistoryPath?: string;
  promptTemplate?: {
    fixedPrefix?: string;
    fixedSuffix?: string;
    customRequirements?: string[];
    customInstructions?: string;
  };
}

/**
 * Script generation node specific configuration
 */
export interface ScriptGenerationNodeConfig extends NodeConfig {
  claudeCommand: string;
  claudeArgs?: string[];
  defaultContentType?: string;
  defaultTheme?: string;
  lengthRange?: {
    min: number;
    max: number;
  };
  charsPerSecond?: number;
  autoAdjustLength?: boolean;
  tone?: string;
  structure?: {
    opening: {
      duration: number;
      content: string;
    };
    topics: {
      duration: number;
      content: string;
    };
    closing: {
      duration: number;
      content: string;
    };
  };
  customInstructions?: string;
  promptTemplate?: {
    fixedPrefix?: string;
    fixedSuffix?: string;
    customRequirements?: string[];
    customInstructions?: string;
  };
}

/**
 * Subtitle generation node specific configuration
 */
export interface SubtitleGenerationNodeConfig extends NodeConfig {
  format: 'srt' | 'vtt' | 'ass';
  maxCharsPerLine: number;
  maxLines: number;
  readingSpeed: number; // chars per second
  minDuration?: number; // seconds
  maxDuration?: number; // seconds
  highlight?: {
    enabled?: boolean;
    color?: string;
    pattern?: string;
  };
  style?: {
    fontName?: string;
    fontSize?: number;
    primaryColor?: string;
    outlineColor?: string;
    outline?: number;
    shadow?: number;
    backColor?: string;
    bold?: number;
    alignment?: number;
    marginV?: number;
    marginL?: number;
    marginR?: number;
    fadeIn?: number;
    fadeOut?: number;
  };
}

/**
 * Voice synthesis node specific configuration
 */
export interface VoiceSynthesisNodeConfig extends NodeConfig {
  voicevoxHost: string;
  speaker: number;
  speed: number;
  pitch: number;
  intonation: number;
}

/**
 * Video composition node specific configuration
 */
export interface VideoCompositionNodeConfig extends NodeConfig {
  ffmpegCommand?: string;
  resolution?: string;
  fps?: number;
  codec?: string;
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
}

/**
 * YouTube upload node specific configuration
 */
export interface YouTubeUploadNodeConfig extends NodeConfig {
  credentialsPath?: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
  category: string;
  titleTemplate?: string;
  descriptionTemplate?: string;
  tags?: string[];
}

/**
 * Pipeline result interface
 */
export interface PipelineResult {
  success: boolean;
  completedNodes: string[];
  failedNode?: string;
  error?: Error;
  outputs: Record<string, string>; // node name -> output file path
}

/**
 * User profile interface (for future use with Node 01)
 */
export interface UserProfile {
  tone: string;
  values: string[];
  prohibitedWords: string[];
  targetAudience: string;
  contentPreferences: {
    topics: string[];
    avoidTopics: string[];
    preferredLength: string;
  };
}

// ============================================================
// Future Extension Interfaces (for Node 01, 02, 09)
// ============================================================

/**
 * Strategy Analysis Node Configuration (Node 01)
 * 
 * Uncomment and use when implementing Node 01
 */
/*
export interface StrategyAnalysisNodeConfig extends NodeConfig {
  userProfilePath: string;
  analyticsHistoryDays: number;
  trendAnalysisEnabled: boolean;
  cacheStrategy: boolean;
}
*/

/**
 * Prompt Refinement Node Configuration (Node 02)
 * 
 * Uncomment and use when implementing Node 02
 */
/*
export interface PromptRefinementNodeConfig extends NodeConfig {
  basePromptsPath: string;
  optimizationLevel: 'low' | 'medium' | 'high';
  useStrategyData: boolean;
  customRules?: string[];
}
*/

/**
 * Analytics Collection Node Configuration (Node 09)
 * 
 * Uncomment and use when implementing Node 09
 */
/*
export interface AnalyticsCollectionNodeConfig extends NodeConfig {
  metricsToCollect: string[];
  collectionDelay: number; // milliseconds
  cacheEnabled: boolean;
  reportFormat: 'json' | 'csv';
}
*/

