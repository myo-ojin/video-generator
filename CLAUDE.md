# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an automated AI news video generation pipeline system that transforms topics into published YouTube videos. The system consists of 9 sequential nodes, though the MVP implementation focuses on nodes 3-8 (core video generation).

**Current Status**: Pre-implementation phase - only specification documents exist in `.kiro/specs/`

**Language**: TypeScript/Node.js (v18+) with Japanese text processing

**Pipeline Flow**:
```
Research → Script Generation → Subtitle Generation → Voice Synthesis → Video Composition → YouTube Upload
```

## System Architecture

### Node Pipeline (MVP: Nodes 3-8)

1. **Strategy Analysis Node** (Node 01) - *Future Enhancement*
2. **Prompt Refinement Node** (Node 02) - *Future Enhancement*
3. **Research Node** (Node 03) - Gather AI news topics using Codex CLI
4. **Script Generation Node** (Node 04) - Generate video scripts using Claude CLI
5. **Subtitle Generation Node** (Node 05) - Convert script to SRT format
6. **Voice Synthesis Node** (Node 06) - Generate audio using VOICEVOX
7. **Video Composition Node** (Node 07) - Combine audio, subtitles, and visuals using FFmpeg
8. **YouTube Upload Node** (Node 08) - Upload video to YouTube
9. **Analytics Collection Node** (Node 09) - *Future Enhancement*

### Key Design Principles

- **Single Responsibility**: Each node has one clear purpose
- **Fail-Fast**: Pipeline stops immediately on error with detailed logging
- **Configuration-Driven**: All behavior controlled via JSON config files
- **Idempotency**: Same input produces same output (where possible)
- **Independent Execution**: Each node can run standalone for testing

### Directory Structure

```
project-root/
├── src/
│   ├── nodes/              # Node implementations
│   │   ├── base/
│   │   │   ├── base-node.ts
│   │   │   └── node-interfaces.ts
│   │   ├── research-node.ts
│   │   ├── script-generation-node.ts
│   │   ├── subtitle-generation-node.ts
│   │   ├── voice-synthesis-node.ts
│   │   ├── video-composition-node.ts
│   │   └── youtube-upload-node.ts
│   ├── orchestrator/       # Pipeline control (future)
│   │   ├── pipeline.ts
│   │   └── pipeline-config.ts
│   ├── utils/              # Shared utilities
│   │   ├── logger.ts       # Winston logger
│   │   ├── cli-executor.ts # CLI command wrapper
│   │   ├── validator.ts    # Config validation
│   │   ├── retry.ts        # Retry with exponential backoff
│   │   └── file-utils.ts   # File I/O helpers
│   ├── types/              # Type definitions
│   │   ├── node-types.ts
│   │   ├── config-types.ts
│   │   ├── data-types.ts
│   │   └── error-types.ts
│   ├── scripts/            # Standalone execution scripts
│   │   ├── run-pipeline.ts
│   │   ├── run-research.ts
│   │   └── run-script-generation.ts
│   └── index.ts
├── config/
│   ├── pipeline-config.json
│   ├── user-profile.json
│   └── credentials.json    # .gitignore this!
├── output/
│   └── [YYYY-MM-DD]/       # Date-based output directories
│       ├── research.json
│       ├── script.txt
│       ├── subtitles.srt
│       ├── audio.wav
│       ├── video.mp4
│       └── upload-result.json
├── cache/
│   ├── topic-history.json  # Duplicate detection
│   └── strategy.json
└── logs/
    └── pipeline-[YYYY-MM-DD].log
```

## Development Commands

### Setup
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode during development
npm run dev
```

### Running Individual Nodes
```bash
# Run research node standalone
ts-node src/scripts/run-research.ts --config config/research-config.json

# Run script generation node
ts-node src/scripts/run-script-generation.ts

# Run subtitle generation node
ts-node src/scripts/run-subtitle-generation.ts

# Run voice synthesis node
ts-node src/scripts/run-voice-synthesis.ts

# Run video composition node
ts-node src/scripts/run-video-composition.ts

# Run YouTube upload node
ts-node src/scripts/run-youtube-upload.ts
```

### Running Full Pipeline
```bash
# Execute all nodes sequentially
ts-node src/scripts/run-pipeline.ts
```

### Testing
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Core Interfaces

### Base Node Interface
All nodes implement this standardized interface:

```typescript
interface Node {
  name: string;
  execute(input: NodeInput): Promise<NodeOutput>;
  validate(input: NodeInput): ValidationResult;
  getConfig(): NodeConfig;
}

interface NodeInput {
  previousOutput?: any;
  config: NodeConfig;
  workDir: string;
}

interface NodeOutput {
  success: boolean;
  data: any;
  outputPath: string;
  metadata: {
    executionTime: number;
    timestamp: string;
  };
}
```

### Error Types
Defined in `src/types/error-types.ts`:

```typescript
enum ErrorType {
  CONFIG_ERROR,
  CLI_EXECUTION_ERROR,
  FILE_NOT_FOUND,
  TIMEOUT_ERROR,
  VALIDATION_ERROR,
  API_ERROR,
  NETWORK_ERROR
}
```

## Configuration Management

### Configuration Files Location
All config files stored in `config/` directory:

- **pipeline-config.json**: Main pipeline configuration
- **user-profile.json**: User tone, values, prohibited words (future use)
- **credentials.json**: API keys and OAuth tokens (**DO NOT COMMIT**)
- **research-config.json**: Research node settings
- **script-generation-config.json**: Script generation settings
- **voice-synthesis-config.json**: VOICEVOX parameters
- **video-composition-config.json**: FFmpeg settings
- **youtube-upload-config.json**: YouTube metadata

### Environment Variables
Config files support environment variable substitution for sensitive data.

## Node-Specific Implementation Details

### Research Node (Node 03)
- **CLI Tool**: Codex CLI (`codex --search`)
- **Output**: `research.json` with 3-4 unique topics
- **Features**:
  - Default prompt generation when `prompts.json` absent
  - Duplicate detection via `cache/topic-history.json`
  - Topic count configurable (default: 3)
  - Retry logic: 3 attempts with exponential backoff
- **Timeout**: 10 minutes
- **Details**: See `.kiro/specs/auto-video-generation/nodes/03-research.md`

### Script Generation Node (Node 04)
- **CLI Tool**: Claude CLI (`claude`)
- **Output**: `script.txt` (400-600 chars for AI news, 1500-2500 for tutorials)
- **Structure**: Opening → Topic 1 → Topic 2 → Topic 3 → Closing
- **Features**:
  - Default prompt generation when `prompts.json` absent
  - Dynamic composition based on research data
  - Length validation and auto-adjustment
- **Timeout**: 5 minutes
- **Details**: See `.kiro/specs/auto-video-generation/nodes/04-script-generation.md`

### Subtitle Generation Node (Node 05)
- **Input**: `script.txt` (UTF-8 encoded)
- **Output**: `subtitles.srt` (SRT format, UTF-8 encoded)
- **Constraints**: Max 2 lines, 42 chars/line
- **Timing**: Based on reading speed (5.8 chars/sec, ~350 chars/min)
- **Encoding**: UTF-8 (CRITICAL for Japanese text)
- **Details**: See `.kiro/specs/auto-video-generation/nodes/05-subtitle-generation.md`

### Voice Synthesis Node (Node 06)
- **Engine**: VOICEVOX HTTP API (http://localhost:50021)
- **Output**: `audio.wav`
- **Default Voice**: Speaker 1 (四国めたん)
- **Parameters**: speed (1.0), pitch (0.0), intonation (1.0)
- **Pre-check**: VOICEVOX availability check before execution
- **API Flow**: POST /audio_query → POST /synthesis
- **Timeout**: 5 minutes
- **Details**: See `.kiro/specs/auto-video-generation/nodes/06-voice-synthesis.md`

### Video Composition Node (Node 07)
- **Tool**: FFmpeg
- **Output**: `video.mp4` (H.264, 1280x720, 30fps)
- **Inputs**: audio.wav + subtitles.srt + background image/video
- **Subtitle Style**: White text, black outline, bottom center
- **Command Example**:
  ```bash
  ffmpeg -loop 1 -i background.jpg -i audio.wav -vf subtitles=subtitles.srt \
    -c:v libx264 -c:a aac -shortest output.mp4
  ```
- **Timeout**: 10 minutes
- **Details**: See `.kiro/specs/auto-video-generation/nodes/07-video-composition.md`

### YouTube Upload Node (Node 08)
- **Library**: googleapis npm package
- **Auth**: OAuth 2.0 (stored in `config/credentials.json`)
- **Output**: `upload-result.json` (video ID, URL)
- **Metadata**: Title, description, tags, privacy status
- **Default Privacy**: "private" (for testing)
- **Timeout**: 10 minutes
- **Note**: YouTube API has daily quota limits
- **Details**: See `.kiro/specs/auto-video-generation/nodes/08-youtube-upload.md`

## External Dependencies

### Required CLI Tools
1. **Codex CLI**: Research tool (`codex --search` command)
2. **Claude CLI**: Script generation tool
3. **VOICEVOX**: Japanese TTS engine (must be running on localhost:50021)
4. **FFmpeg**: Video composition tool

### Node.js Packages
- **googleapis**: YouTube API integration
- **axios**: HTTP requests (VOICEVOX API)
- **winston** or **pino**: Logging
- **@types/node**: TypeScript definitions

## Naming Conventions

### Files
- TypeScript files: `kebab-case` (e.g., `research-node.ts`)
- Class files: PascalCase classes (e.g., `ResearchNode`)
- Interface files: `kebab-case` + `-interfaces` (e.g., `node-interfaces.ts`)
- Type definition files: `kebab-case` + `-types` (e.g., `config-types.ts`)
- Test files: `<filename>.test.ts`

### Code
- Classes: PascalCase (e.g., `StrategyAnalysisNode`)
- Interfaces: PascalCase (e.g., `NodeInput`, `PipelineConfig`)
- Methods: camelCase (e.g., `executeNode()`, `loadUserProfile()`)
- Variables: camelCase (e.g., `researchData`, `outputPath`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT`)
- Private methods: camelCase + private keyword
- Async methods: async + camelCase

### Configuration Keys
- Node settings: camelCase (e.g., `strategyAnalysis`, `scriptGeneration`)
- Parameters: camelCase (e.g., `timeout`, `retryCount`, `topicCount`)
- Paths: camelCase + Path (e.g., `userProfilePath`, `outputDir`)
- Flags: enable/disable prefix (e.g., `enableDuplicateCheck`)

### Output Files
- research.json
- script.txt
- subtitles.srt
- audio.wav
- video.mp4
- upload-result.json

## Error Handling

### Retry Logic
- **Retryable Errors**: Network errors, timeouts, temporary CLI failures
- **Non-Retryable Errors**: Config errors, file not found, validation failures
- **Retry Strategy**: Exponential backoff (1s, 2s, 4s)
- **Max Retries**: 3 attempts (configurable per node)

### Error Flow
1. Node catches error
2. Determine if retryable
3. If retryable and under retry limit → retry with backoff
4. If non-retryable or retry limit reached → log detailed error
5. Pipeline stops immediately
6. Error notification (future: email/Slack/Discord)

### Logging Format
```
[Level] [NodeName] Message
```

Examples:
```
[INFO] Starting Research Node
[DEBUG] Research prompt: ...
[WARN] Script too short: 450 characters (min: 500)
[ERROR] Research Node failed: Codex CLI timeout
```

## Performance Considerations

### Timeout Budget (Total: ~51 minutes)
- Research: 10 min
- Script Generation: 5 min
- Subtitle Generation: 1 min
- Voice Synthesis: 5 min
- Video Composition: 10 min
- YouTube Upload: 10 min

### Memory Estimates
- Small video (60-90s): <500MB
- Medium video (3-5min): <1GB
- Large video (10min+): <2GB

## Security Notes

- **Never commit** `config/credentials.json`
- Store API keys in environment variables when possible
- Validate and sanitize all CLI command inputs to prevent injection attacks
- Mask sensitive data in logs
- Use OAuth 2.0 token refresh for YouTube API

## Testing Strategy

### Unit Tests
- Test each node's execute method (success and failure cases)
- Test validation logic
- Test CLI executor wrapper
- Mock external dependencies (CLI tools, filesystem, APIs)

### Integration Tests
- Test data flow between two nodes
- Test error propagation and pipeline halt
- Test retry logic

### E2E Tests
- Test full pipeline execution with mock data
- Verify output files are generated correctly
- Test YouTube upload in dry-run mode (no actual upload)

## Common Development Tasks

### Adding a New Node
1. Create class extending `BaseNode` in `src/nodes/`
2. Implement `execute()` method
3. Define input/output types in `src/types/`
4. Create config file in `config/`
5. Add standalone execution script in `src/scripts/`
6. Update pipeline orchestrator to include new node
7. Add tests in `tests/`

### Debugging a Node
1. Check logs in `logs/pipeline-[date].log`
2. Run node standalone with `ts-node src/scripts/run-<node>.ts`
3. Verify input files exist in `output/` or `cache/`
4. Check config file for correct paths and parameters
5. Test external tool (Codex CLI, Claude CLI, VOICEVOX, FFmpeg) manually

### Modifying Configuration
1. Edit relevant config file in `config/`
2. Validate JSON format
3. No code changes needed - configuration is hot-reloaded
4. For user profile changes: edit `config/user-profile.json`

## Platform Considerations

This system runs on **Windows** (current environment):
- Use proper path handling (backslashes vs forward slashes)
- Test CLI execution with Windows command syntax
- Use `setup.bat` instead of `setup.sh` for Windows setup
- Consider Task Scheduler for scheduled execution (instead of cron)

## Future Enhancements

### Not in MVP (Nodes 1, 2, 9)
- **Node 01 (Strategy Analysis)**: User profile integration, trend analysis
- **Node 02 (Prompt Refinement)**: Advanced prompt optimization
- **Node 09 (Analytics Collection)**: YouTube Analytics API integration

### Potential Improvements
- Parallel node execution (Subtitle + Voice Synthesis can run concurrently)
- Research result caching
- Advanced duplicate detection using semantic similarity
- Webhook notifications on completion/failure
- Web dashboard for monitoring

## Specification Documents

**IMPORTANT**: Always review specifications in `.kiro/specs/auto-video-generation/` before implementing any feature.

Detailed design documents available:
- `requirements.md` - Complete requirements with acceptance criteria (READ THIS FIRST)
- `architecture.md` - System architecture and naming conventions
- `design.md` - Detailed design and interfaces
- `workflow.md` - Workflow diagrams and data flow
- `tasks-mvp.md` - MVP implementation task breakdown
- `nodes/01-strategy-analysis.md` through `09-analytics-collection.md` - Node-specific designs (READ BEFORE IMPLEMENTING EACH NODE)

### Specification Review Workflow

Before implementing any node or feature:
1. Read `requirements.md` to understand the business requirements
2. Review `architecture.md` for naming conventions and structure
3. Check `design.md` for interfaces and data models
4. Read the specific node design document in `nodes/[XX-node-name].md`
5. Verify your implementation plan against these specifications
6. Only then proceed with coding

This ensures all implementations conform to the documented specifications and prevents misalignment between code and requirements.

## Important Notes for Implementation

1. **Always check specifications before implementation** - Review the relevant documents in `.kiro/specs/auto-video-generation/` before writing any code. Each node has detailed specifications in `nodes/[node-name].md` that must be followed.
2. **Always use UTF-8 encoding for Japanese text** - All files containing Japanese text (scripts, subtitles, logs, configs) MUST be saved with UTF-8 encoding. This is critical for proper text processing throughout the pipeline.
3. **Always use type definitions from `src/types/`** - centralized type management
4. **All config files go in `config/`** - use workspace-relative paths
5. **Output organized by date** - `output/[YYYY-MM-DD]/`
6. **Each node must be independently testable** - don't create tight coupling
7. **Log everything** - debugging is critical for CLI-based pipeline
8. **Validate inputs early** - fail fast with clear error messages
9. **VOICEVOX timing alignment** - subtitle timestamps must match voice speed setting
10. **Windows environment** - test all file paths and CLI commands on Windows
11. **YouTube API quotas** - be mindful of daily limits during testing
