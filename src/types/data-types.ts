/**
 * Data structure type definitions
 * Based on: Kiro Specs Archive/auto-video-generation/design.md
 */

/**
 * Research topic data
 */
export interface ResearchTopic {
  title: string;
  summary: string;
  source?: string;
  date?: string;
  url?: string;
}

/**
 * Research data output
 */
export interface ResearchData {
  topics: ResearchTopic[];
  generatedAt: string;
  topicCount: number;
}

/**
 * Strategy data (for future use with Node 01)
 */
export interface StrategyData {
  themes: string[];
  keywords: string[];
  targetAudience: string;
  tone: string;
  contentGuidelines: string[];
  generatedAt: string;
}

/**
 * Prompt data (for future use with Node 02)
 */
export interface PromptData {
  researchPrompt: string;
  scriptPrompt: string;
  metadata: {
    optimizedAt: string;
    strategyBased: boolean;
  };
}

/**
 * Script data
 */
export interface ScriptData {
  script: string; // Main script text
  generatedAt: string;
  length: number;
  characterCount: number;
  estimatedDuration: number; // in seconds
}

/**
 * Subtitle segment
 */
export interface SubtitleSegment {
  index: number;
  startTime: string; // Format: HH:MM:SS,mmm
  endTime: string;   // Format: HH:MM:SS,mmm
  text: string;
}

/**
 * Subtitle data
 */
export interface SubtitleData {
  format: 'srt' | 'vtt' | 'ass';
  segments: SubtitleSegment[];
  totalDuration: number; // in seconds
  generatedAt: string;
}

/**
 * Audio data metadata
 */
export interface AudioData {
  filePath: string;
  duration: number; // in seconds
  format: string;
  speaker: number;
  generatedAt: string;
}

/**
 * Video data metadata
 */
export interface VideoData {
  filePath: string;
  resolution: string;
  duration: number; // in seconds
  fileSize: number; // in bytes
  codec: string;
  generatedAt: string;
}

/**
 * YouTube upload result
 */
export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  title: string;
  description: string;
  privacyStatus: string;
  uploadedAt: string;
}

/**
 * Analytics data (for future use with Node 09)
 */
export interface AnalyticsData {
  videoId: string;
  views: number;
  watchTime: number; // in seconds
  likes: number;
  comments: number;
  engagementRate: number;
  collectedAt: string;
}

/**
 * Topic history entry for duplicate detection
 */
export interface TopicHistoryEntry {
  title: string;
  date: string;
  videoId?: string;
}

/**
 * Topic history data
 */
export interface TopicHistory {
  entries: TopicHistoryEntry[];
  lastUpdated: string;
}

