# アーキテクチャ設計

## システムアーキテクチャ

### レイヤー構造

```
┌─────────────────────────────────────────┐
│         CLI / Scheduler Layer           │  ← 実行トリガー
├─────────────────────────────────────────┤
│      Pipeline Orchestrator Layer        │  ← パイプライン制御
├─────────────────────────────────────────┤
│           Node Layer                    │  ← 各ノードの実装
│  ┌──────────┬──────────┬──────────┐    │
│  │ Strategy │ Research │  Script  │    │
│  │ Analysis │   Node   │   Gen    │    │
│  └──────────┴──────────┴──────────┘    │
│  ┌──────────┬──────────┬──────────┐    │
│  │ Subtitle │  Voice   │  Video   │    │
│  │   Gen    │ Synthesis│   Comp   │    │
│  └──────────┴──────────┴──────────┘    │
│  ┌──────────┬──────────┐              │
│  │ YouTube  │Analytics │              │
│  │  Upload  │Collection│              │
│  └──────────┴──────────┘              │
├─────────────────────────────────────────┤
│         Utility Layer                   │  ← 共通機能
│  ┌──────────┬──────────┬──────────┐    │
│  │  Logger  │   CLI    │Validator │    │
│  │          │ Executor │          │    │
│  └──────────┴──────────┴──────────┘    │
├─────────────────────────────────────────┤
│      External Services Layer            │  ← 外部サービス
│  ┌──────────┬──────────┬──────────┐    │
│  │ Codex CLI│Claude CLI│ VOICEVOX │    │
│  └──────────┴──────────┴──────────┘    │
│  ┌──────────┬──────────┐              │
│  │  FFmpeg  │YouTube API│              │
│  └──────────┴──────────┘              │
└─────────────────────────────────────────┘
```

### データフロー

```
[Config Files] ──┐
                 ↓
[User Profile] → [Pipeline Orchestrator]
                 ↓
         ┌───────┴───────┐
         ↓               ↓
    [Node 1]        [Cache/History]
         ↓               ↑
    [Node 2] ←──────────┘
         ↓
    [Node N]
         ↓
    [Output Files]
         ↓
    [YouTube / Analytics]
```

## ディレクトリ構造

```
project-root/
├── src/
│   ├── orchestrator/
│   │   ├── pipeline.ts              # パイプライン制御
│   │   └── pipeline-config.ts       # 設定管理
│   ├── nodes/
│   │   ├── base/
│   │   │   ├── base-node.ts         # ベースノードクラス
│   │   │   └── node-interfaces.ts   # 共通インターフェース
│   │   ├── strategy-analysis-node.ts
│   │   ├── prompt-refinement-node.ts
│   │   ├── research-node.ts
│   │   ├── script-generation-node.ts
│   │   ├── subtitle-generation-node.ts
│   │   ├── voice-synthesis-node.ts
│   │   ├── video-composition-node.ts
│   │   ├── youtube-upload-node.ts
│   │   └── analytics-collection-node.ts
│   ├── utils/
│   │   ├── logger.ts                # ログ管理
│   │   ├── cli-executor.ts          # CLI実行ユーティリティ
│   │   ├── validator.ts             # バリデーション
│   │   ├── retry.ts                 # リトライロジック
│   │   └── file-utils.ts            # ファイル操作
│   ├── types/
│   │   ├── node-types.ts            # ノード関連の型定義
│   │   ├── config-types.ts          # 設定関連の型定義
│   │   ├── data-types.ts            # データ構造の型定義
│   │   └── error-types.ts           # エラー型定義（ErrorType, PipelineError）
│   └── index.ts                     # エントリーポイント
├── config/
│   ├── pipeline-config.json         # パイプライン設定
│   ├── user-profile.json            # ユーザープロファイル
│   └── credentials.json             # 認証情報（.gitignore）
├── cache/
│   ├── strategy.json                # 戦略キャッシュ
│   └── topic-history.json           # トピック履歴
├── output/
│   └── [YYYY-MM-DD]/                # 日付ごとの出力
│       ├── strategy.json
│       ├── prompts.json
│       ├── research.json
│       ├── script.txt
│       ├── subtitles.srt
│       ├── audio.wav
│       ├── video.mp4
│       ├── upload-result.json
│       └── analytics.json
├── logs/
│   └── pipeline-[YYYY-MM-DD].log    # 日付ごとのログ
├── tests/
│   ├── unit/                        # ユニットテスト
│   ├── integration/                 # 統合テスト
│   └── e2e/                         # E2Eテスト
├── package.json
├── tsconfig.json
└── README.md
```

## 命名規則

### ファイル命名規則

| 種類 | 規則 | 例 |
|------|------|-----|
| TypeScriptファイル | kebab-case | `strategy-analysis-node.ts` |
| クラスファイル | PascalCase + Node/Service/Util | `StrategyAnalysisNode` |
| インターフェースファイル | kebab-case + interfaces | `node-interfaces.ts` |
| 型定義ファイル | kebab-case + types | `config-types.ts` |
| テストファイル | 対象ファイル名 + .test | `research-node.test.ts` |
| 設定ファイル | kebab-case + .json | `pipeline-config.json` |
| 出力ファイル | kebab-case + 拡張子 | `research.json`, `script.txt` |

### コード命名規則

| 種類 | 規則 | 例 |
|------|------|-----|
| クラス名 | PascalCase | `StrategyAnalysisNode` |
| インターフェース名 | PascalCase | `NodeInput`, `PipelineConfig` |
| 型エイリアス | PascalCase | `ExecutionMode`, `ErrorType` |
| メソッド名 | camelCase | `executeNode()`, `loadUserProfile()` |
| 変数名 | camelCase | `researchData`, `outputPath` |
| 定数名 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |
| プライベートメソッド | camelCase + private | `private buildPrompt()` |
| 非同期メソッド | async + camelCase | `async execute()` |

### 設定キー命名規則

| 種類 | 規則 | 例 |
|------|------|-----|
| ノード設定 | camelCase | `strategyAnalysis`, `scriptGeneration` |
| パラメータ | camelCase | `timeout`, `retryCount`, `topicCount` |
| パス設定 | camelCase + Path | `userProfilePath`, `outputDir` |
| フラグ | enable/disable + 機能名 | `enableDuplicateCheck` |
| カウント | 名詞 + Count | `topicCount`, `retryCount` |
| 期間 | 名詞 + Days/Hours | `duplicateCheckDays`, `maxHistoryDays` |

### 出力ファイル命名規則

| ノード | 出力ファイル名 | 形式 |
|--------|---------------|------|
| Strategy Analysis | `strategy.json` | JSON |
| Prompt Refinement | `prompts.json` | JSON |
| Research | `research.json` | JSON |
| Script Generation | `script.txt` | Plain Text |
| Subtitle Generation | `subtitles.srt` | SRT |
| Voice Synthesis | `audio.wav` | WAV |
| Video Composition | `video.mp4` | MP4 |
| YouTube Upload | `upload-result.json` | JSON |
| Analytics Collection | `analytics.json` | JSON |

### ログメッセージ命名規則

```typescript
// パターン: [Level] [NodeName] Message
logger.info('Starting Strategy Analysis Node');
logger.debug('Research prompt: ...');
logger.warn('Script too short: 450 characters (min: 500)');
logger.error('Research Node failed: Codex CLI timeout');
```

## モジュール依存関係

```
index.ts
  └── PipelineOrchestrator
      ├── Logger (utils)
      ├── Validator (utils)
      └── Nodes
          ├── BaseNode
          │   ├── Logger (utils)
          │   ├── CLIExecutor (utils)
          │   └── Retry (utils)
          ├── StrategyAnalysisNode extends BaseNode
          ├── ResearchNode extends BaseNode
          ├── ScriptGenerationNode extends BaseNode
          └── ... (other nodes)
```

## エラーハンドリング階層

エラー型定義は `src/types/error-types.ts` に配置：

```
PipelineError (基底クラス)
  ├── ConfigError          # 設定エラー
  ├── ValidationError      # バリデーションエラー
  ├── CLIExecutionError    # CLI実行エラー
  ├── TimeoutError         # タイムアウトエラー
  ├── FileNotFoundError    # ファイル不在エラー
  ├── APIError             # API呼び出しエラー
  └── NetworkError         # ネットワークエラー
```

## 設定管理階層

```
pipeline-config.json (メイン設定)
  ├── Global Settings
  │   ├── outputDir
  │   ├── logLevel
  │   └── userProfilePath
  └── Node Configurations
      ├── strategyAnalysis
      │   ├── enabled
      │   ├── timeout
      │   └── ... (node-specific)
      ├── research
      └── ... (other nodes)

user-profile.json (ユーザー設定)
  ├── tone
  ├── values
  ├── prohibitedWords
  └── contentPreferences

credentials.json (認証情報)
  ├── youtube
  │   ├── client_id
  │   ├── client_secret
  │   └── refresh_token
  └── ... (other services)
```

## パフォーマンス考慮事項

### タイムアウト設定

| ノード | デフォルトタイムアウト | 推奨範囲 |
|--------|---------------------|---------|
| Strategy Analysis | 5分 | 3-10分 |
| Prompt Refinement | 2分 | 1-5分 |
| Research | 10分 | 5-15分 |
| Script Generation | 5分 | 3-10分 |
| Subtitle Generation | 1分 | 30秒-3分 |
| Voice Synthesis | 5分 | 3-10分 |
| Video Composition | 10分 | 5-20分 |
| YouTube Upload | 10分 | 5-30分 |
| Analytics Collection | 3分 | 1-5分 |

### メモリ使用量目安

- 小規模動画（60-90秒）: 500MB以下
- 中規模動画（3-5分）: 1GB以下
- 大規模動画（10分以上）: 2GB以下

## セキュリティ考慮事項

### 機密情報の管理

1. **credentials.json**
   - .gitignoreに追加必須
   - 環境変数での上書き対応
   - 暗号化推奨

2. **API キー**
   - 環境変数での管理
   - ローテーション対応

3. **ログ出力**
   - 機密情報のマスキング
   - 個人情報の除外

### ファイルアクセス制限

- 設定ファイル: 読み取り専用
- 出力ディレクトリ: 書き込み専用
- キャッシュディレクトリ: 読み書き可能
