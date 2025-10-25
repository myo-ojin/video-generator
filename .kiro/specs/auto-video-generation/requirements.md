# Requirements Document

## Introduction

本システムは、戦略分析からYouTube投稿・アナリティクス収集までを自動化する動画生成パイプラインです。9つのノードで構成され、各ノードが特定の処理を担当し、順次実行されることで完全な動画制作ワークフローを実現します。

## Glossary

- **System**: 動画自動生成システム全体
- **Node**: パイプライン内の個別処理単位（戦略分析、プロンプト改修、リサーチ、原稿作成、字幕化、音声化、動画合成、YouTube投稿、アナリティクス収集）
- **Pipeline**: 9つのNodeを順次実行する処理フロー
- **Codex CLI**: リサーチ用のコマンドラインツール（`codex --search`コマンドを提供）
- **Claude CLI**: 原稿生成用のコマンドラインツール
- **VOICEVOX**: 日本語テキスト読み上げエンジン
- **FFmpeg**: 動画合成用のマルチメディア処理ツール
- **Strategy Analysis Node**: 動画戦略を分析し、ユーザープロファイルを統合するノード
- **User Profile**: ユーザーの思想、価値観、トーン、禁止ワードなどを定義した設定ファイル
- **Prompt Refinement Node**: プロンプトを改修するノード
- **Research Node**: Codex CLIを使用してリサーチを実行するノード
- **Script Generation Node**: Claude CLIを使用して原稿を生成するノード
- **Subtitle Generation Node**: 原稿を字幕形式に変換するノード
- **Voice Synthesis Node**: VOICEVOXで原稿を音声化するノード
- **Video Composition Node**: FFmpegで動画を合成するノード
- **YouTube Upload Node**: YouTubeに動画を投稿するノード
- **Analytics Collection Node**: YouTubeアナリティクスを収集するノード

## Requirements

### Requirement 1

**User Story:** As a content creator, I want the system to automatically execute all 9 nodes in sequence, so that I can generate and publish videos without manual intervention.

#### Acceptance Criteria

1. THE System SHALL execute the 9 Nodes in the following order: Strategy Analysis Node, Prompt Refinement Node, Research Node, Script Generation Node, Subtitle Generation Node, Voice Synthesis Node, Video Composition Node, YouTube Upload Node, Analytics Collection Node
2. WHEN a Node completes successfully, THE System SHALL pass the output data to the next Node in the Pipeline
3. IF a Node fails during execution, THEN THE System SHALL log the error details and halt the Pipeline
4. THE System SHALL store intermediate outputs from each Node for debugging and review purposes
5. WHEN the Pipeline completes all 9 Nodes, THE System SHALL notify the user of successful completion

### Requirement 2

**User Story:** As a content creator, I want the strategy analysis node to analyze video topics and trends while incorporating my personal values and tone, so that the system can generate content that reflects my unique perspective.

#### Acceptance Criteria

1. THE Strategy Analysis Node SHALL load the User Profile from a configuration file at the start of execution
2. THE Strategy Analysis Node SHALL analyze current trends and topics based on input parameters
3. THE Strategy Analysis Node SHALL integrate User Profile data (tone, values, prohibited words, target audience preferences) into the strategy output
4. THE Strategy Analysis Node SHALL output structured strategy data including target keywords, content themes, audience insights, and user-specific guidelines
5. THE Strategy Analysis Node SHALL complete execution within 5 minutes
6. WHEN the Strategy Analysis Node completes, THE System SHALL save the strategy data to a file
7. IF the User Profile file is missing or invalid, THEN THE Strategy Analysis Node SHALL use default neutral settings and log a warning

### Requirement 3

**User Story:** As a content creator, I want the prompt refinement node to optimize prompts based on strategy, so that subsequent nodes receive high-quality instructions.

#### Acceptance Criteria

1. THE Prompt Refinement Node SHALL receive strategy data from the Strategy Analysis Node
2. THE Prompt Refinement Node SHALL generate optimized prompts for the Research Node and Script Generation Node
3. THE Prompt Refinement Node SHALL output prompts in a structured format that can be consumed by CLI tools
4. THE Prompt Refinement Node SHALL complete execution within 2 minutes

### Requirement 4

**User Story:** As a content creator, I want the research node to gather information using Codex CLI, so that the script is based on accurate and relevant data.

#### Acceptance Criteria

1. THE Research Node SHALL execute the Codex CLI command `codex --search` with the refined prompt
2. THE Research Node SHALL capture and parse the output from the Codex CLI
3. THE Research Node SHALL structure the research results into a format suitable for script generation
4. IF the Codex CLI command fails, THEN THE Research Node SHALL retry up to 3 times with exponential backoff
5. THE Research Node SHALL complete execution within 10 minutes

### Requirement 5

**User Story:** As a content creator, I want the script generation node to create video scripts using Claude CLI, so that I have well-written content for my videos.

#### Acceptance Criteria

1. THE Script Generation Node SHALL execute the Claude CLI with the refined prompt and research data
2. THE Script Generation Node SHALL generate a complete video script in Japanese
3. THE Script Generation Node SHALL output the script in plain text format
4. THE Script Generation Node SHALL ensure the script length is between 400 and 3000 characters (configurable based on video type: 400-600 for short-form news, 1500-2500 for tutorials)
5. IF the Claude CLI command fails, THEN THE Script Generation Node SHALL retry up to 3 times

### Requirement 6

**User Story:** As a content creator, I want the subtitle generation node to convert the script into subtitle format, so that my videos have proper captions.

#### Acceptance Criteria

1. THE Subtitle Generation Node SHALL receive the script from the Script Generation Node
2. THE Subtitle Generation Node SHALL convert the script into SRT or VTT subtitle format
3. THE Subtitle Generation Node SHALL assign appropriate timestamps to each subtitle segment
4. THE Subtitle Generation Node SHALL ensure subtitle segments do not exceed 2 lines or 42 characters per line
5. THE Subtitle Generation Node SHALL output the subtitle file in UTF-8 encoding

### Requirement 7

**User Story:** As a content creator, I want the voice synthesis node to generate audio using VOICEVOX, so that my videos have natural-sounding narration.

#### Acceptance Criteria

1. THE Voice Synthesis Node SHALL execute VOICEVOX with the script text as input
2. THE Voice Synthesis Node SHALL generate audio output in WAV or MP3 format
3. THE Voice Synthesis Node SHALL allow configuration of voice character and speech parameters
4. THE Voice Synthesis Node SHALL complete audio generation within 5 minutes
5. IF VOICEVOX is not available, THEN THE Voice Synthesis Node SHALL report an error and halt the Pipeline

### Requirement 8

**User Story:** As a content creator, I want the video composition node to combine audio and subtitles using FFmpeg, so that I have a complete video file ready for upload.

#### Acceptance Criteria

1. THE Video Composition Node SHALL execute FFmpeg to combine audio, subtitles, and optional background video or images
2. THE Video Composition Node SHALL output video in MP4 format with H.264 codec
3. THE Video Composition Node SHALL ensure the output video resolution is at least 1280x720 pixels
4. THE Video Composition Node SHALL embed subtitles into the video or include them as a separate track
5. THE Video Composition Node SHALL complete video composition within 10 minutes

### Requirement 9

**User Story:** As a content creator, I want the YouTube upload node to automatically publish videos, so that I don't have to manually upload each video.

#### Acceptance Criteria

1. THE YouTube Upload Node SHALL authenticate with YouTube API using OAuth 2.0 credentials
2. THE YouTube Upload Node SHALL upload the composed video file to the specified YouTube channel
3. THE YouTube Upload Node SHALL set video metadata including title, description, and tags based on strategy data
4. THE YouTube Upload Node SHALL set the video privacy status as specified in configuration (public, unlisted, or private)
5. WHEN the upload completes, THE YouTube Upload Node SHALL return the video ID

### Requirement 10

**User Story:** As a content creator, I want the analytics collection node to gather video performance data, so that I can track the success of my content.

#### Acceptance Criteria

1. THE Analytics Collection Node SHALL authenticate with YouTube Analytics API
2. THE Analytics Collection Node SHALL retrieve metrics including views, watch time, likes, comments, and engagement rate
3. THE Analytics Collection Node SHALL store analytics data in a structured format (JSON or CSV)
4. THE Analytics Collection Node SHALL support querying analytics for specific date ranges
5. THE Analytics Collection Node SHALL complete data collection within 3 minutes

### Requirement 11

**User Story:** As a system administrator, I want to configure each node's parameters and my user profile, so that I can customize the pipeline behavior for different use cases.

#### Acceptance Criteria

1. THE System SHALL load configuration from a JSON or YAML file at startup
2. THE System SHALL allow configuration of CLI command paths, API credentials, and processing parameters for each Node
3. THE System SHALL support a separate User Profile configuration file containing tone, values, prohibited words, and content preferences
4. THE System SHALL validate configuration values before starting the Pipeline
5. IF configuration is invalid or missing, THEN THE System SHALL report specific errors and refuse to start
6. THE System SHALL support environment variable substitution in configuration values
7. WHEN the User Profile file is updated, THE System SHALL apply changes in the next Pipeline execution without requiring code changes

### Requirement 12

**User Story:** As a developer, I want comprehensive logging throughout the pipeline, so that I can debug issues and monitor system performance.

#### Acceptance Criteria

1. THE System SHALL log the start and completion time of each Node execution
2. THE System SHALL log all CLI command invocations with their arguments
3. THE System SHALL log error messages with stack traces when failures occur
4. THE System SHALL support configurable log levels (DEBUG, INFO, WARN, ERROR)
5. THE System SHALL write logs to both console output and a log file
