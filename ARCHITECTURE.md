# AI News Video Generator - Architecture Documentation

## 概要

このドキュメントは、AI News Video Generatorの現在の実装アーキテクチャと、将来の拡張ポイントについて説明します。

## 現在の実装（MVP版）

### システム構成

MVP版では、動画生成のコア機能（Node 03-08）を実装しています：

```
┌─────────────────────────────────────────┐
│         CLI Execution Layer             │
│  ┌──────────────────────────────────┐   │
│  │  Individual Node Scripts         │   │
│  │  - run-research.ts               │   │
│  │  - run-script-generation.ts      │   │
│  │  - run-subtitle-generation.ts    │   │
│  │  - run-voice-synthesis.ts        │   │
│  │  - run-video-composition.ts      │   │
│  │  - run-youtube-upload.ts         │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Pipeline Script                 │   │
│  │  - run-pipeline.ts               │   │
│  └──────────────────────────────────┘   │
├─────────────────────────────────────────┤
│           Node Layer (MVP)              │
│  ┌──────────┬──────────┬──────────┐    │
│  │ Research │  Script  │ Subtitle │    │
│  │   Node   │   Gen    │   Gen    │    │
│  │ (Node 03)│(Node 04) │(Node 05) │    │
│  └──────────┴──────────┴──────────┘    │
│  ┌──────────┬──────────┬──────────┐    │
│  │  Voice   │  Video   │ YouTube  │    │
│  │ Synthesis│   Comp   │  Upload  │    │
│  │(Node 06) │(Node 07) │(Node 08) │    │
│  └──────────┴──────────┴──────────┘    │
├─────────────────────────────────────────┤
│      Base Node & Utilities              │
│  ┌──────────┬──────────┬──────────┐    │
│  │BaseNode  │  Logger  │   CLI    │    │
│  │          │          │ Executor │    │
│  └──────────┴──────────┴──────────┘    │
│  ┌──────────┬──────────┬──────────┐    │
│  │  File    │  Retry   │Validator │    │
│  │  Utils   │          │          │    │
│  └──────────┴──────────┴──────────┘    │
├─────────────────────────────────────────┤
│      External Services                  │
│  ┌──────────┬──────────┬──────────┐    │
│  │ Codex CLI│Claude CLI│ VOICEVOX │    │
│  └──────────┴──────────┴──────────┘    │
│  ┌──────────┬──────────┐              │
│  │  FFmpeg  │YouTube API│              │
│  └──────────┴──────────┘              │
└─────────────────────────────────────────┘
```

### データフロー（MVP版）

```
[Config Files]
     ↓
[run-pipeline.ts] ──→ [Node 03: Research]
     ↓                      ↓
     │                 research.json
     ↓                      ↓
     └──────→ [Node 04: Script Generation]
                            ↓
                       script.txt
                            ↓
              [Node 05: Subtitle Generation]
                            ↓
                      subtitles.srt
                            ↓
              [Node 06: Voice Synthesis]
                            ↓
                        audio.wav
                            ↓
              [Node 07: Video Composition]
                            ↓
                        video.mp4
                            ↓
              [Node 08: YouTube Upload]
                            ↓
                   upload-result.json
```

### ディレクトリ構造（実装済み）

```
project-root/
├── src/
│   ├── nodes/
│   │   ├── base/
│   │   │   └── base-node.ts         ✅ 実装済み
│   │   ├── research-node.ts         ✅ 実装済み
│   │   ├── script-generation-node.ts ✅ 実装済み
│   │   ├── subtitle-generation-node.ts ✅ 実装済み
│   │   ├── voice-synthesis-node.ts  ✅ 実装済み
│   │   ├── video-composition-node.ts ✅ 実装済み
│   │   └── youtube-upload-node.ts   ✅ 実装済み
│   ├── scripts/
│   │   ├── run-research.ts          ✅ 実装済み
│   │   ├── run-script-generation.ts ✅ 実装済み
│   │   ├── run-subtitle-generation.ts ✅ 実装済み
│   │   ├── run-voice-synthesis.ts   ✅ 実装済み
│   │   ├── run-video-composition.ts ✅ 実装済み
│   │   ├── run-youtube-upload.ts    ✅ 実装済み
│   │   └── run-pipeline.ts          ✅ 実装済み
│   ├── utils/
│   │   ├── logger.ts                ✅ 実装済み
│   │   ├── cli-executor.ts          ✅ 実装済み
│   │   ├── file-utils.ts            ✅ 実装済み
│   │   ├── retry.ts                 ✅ 実装済み
│   │   └── validator.ts             ✅ 実装済み
│   ├── types/
│   │   ├── node-types.ts            ✅ 実装済み
│   │   ├── config-types.ts          ✅ 実装済み
│   │   ├── data-types.ts            ✅ 実装済み
│   │   ├── error-types.ts           ✅ 実装済み
│   │   └── index.ts                 ✅ 実装済み
│   └── orchestrator/                🔲 将来実装
├── config/
│   ├── pipeline-config.json         ✅ 実装済み
│   ├── research-config.json         ✅ 実装済み
│   ├── script-generation-config.json ✅ 実装済み
│   ├── subtitle-generation-config.json ✅ 実装済み
│   ├── voice-synthesis-config.json  ✅ 実装済み
│   ├── video-composition-config.json ✅ 実装済み
│   ├── youtube-upload-config.json   ✅ 実装済み
│   └── credentials.json             ✅ テンプレート済み
├── cache/                           ✅ ディレクトリ作成済み
├── output/                          ✅ ディレクトリ作成済み
├── logs/                            ✅ ディレクトリ作成済み
├── setup.sh                         ✅ 実装済み
├── setup.bat                        ✅ 実装済み
└── README.md                        ✅ 実装済み
```

---

## 将来の拡張ポイント

### 1. Node 01: 戦略分析ノード（Strategy Analysis Node）

**目的**: ユーザープロファイルを読み込み、コンテンツ戦略を分析

**統合方法**:

```typescript
// src/nodes/strategy-analysis-node.ts
export class StrategyAnalysisNode extends BaseNode {
  protected async executeInternal(input: NodeInput): Promise<Omit<NodeOutput, 'metadata'>> {
    // 1. user-profile.jsonを読み込み
    const userProfile = await this.loadUserProfile(config.userProfilePath);
    
    // 2. 過去のアナリティクスデータを分析
    const analytics = await this.loadAnalytics();
    
    // 3. コンテンツ戦略を生成
    const strategy = await this.generateStrategy(userProfile, analytics);
    
    // 4. strategy.jsonに出力
    await this.saveStrategy(strategy);
    
    return this.createSuccessOutput(strategy, 'strategy.json');
  }
}
```

**設定ファイル**: `config/strategy-analysis-config.json`
```json
{
  "enabled": true,
  "timeout": 300000,
  "userProfilePath": "config/user-profile.json",
  "analyticsHistoryDays": 30,
  "trendAnalysisEnabled": true
}
```

**データ構造**: `src/types/data-types.ts`に追加
```typescript
export interface StrategyData {
  themes: string[];
  keywords: string[];
  targetAudience: string;
  contentStyle: string;
  generatedAt: string;
}
```

**パイプライン統合**:
- Node 01 → Node 03（戦略データをリサーチプロンプトに反映）
- strategy.jsonをresearch-nodeが読み込み、プロンプト生成に使用

---

### 2. Node 02: プロンプト改修ノード（Prompt Refinement Node）

**目的**: 戦略データを元にプロンプトを最適化

**統合方法**:

```typescript
// src/nodes/prompt-refinement-node.ts
export class PromptRefinementNode extends BaseNode {
  protected async executeInternal(input: NodeInput): Promise<Omit<NodeOutput, 'metadata'>> {
    // 1. strategy.jsonを読み込み
    const strategy = await this.loadStrategy(input.workDir);
    
    // 2. ベースプロンプトを読み込み
    const basePrompts = await this.loadBasePrompts();
    
    // 3. 戦略に基づいてプロンプトを最適化
    const refinedPrompts = await this.refinePrompts(strategy, basePrompts);
    
    // 4. prompts.jsonに出力
    await this.savePrompts(refinedPrompts);
    
    return this.createSuccessOutput(refinedPrompts, 'prompts.json');
  }
}
```

**設定ファイル**: `config/prompt-refinement-config.json`
```json
{
  "enabled": true,
  "timeout": 120000,
  "basePromptsPath": "config/base-prompts.json",
  "optimizationLevel": "high"
}
```

**データ構造**: `src/types/data-types.ts`に追加
```typescript
export interface PromptData {
  researchPrompt: string;
  scriptPrompt: string;
  styleGuidelines: string[];
  prohibitedTerms: string[];
  generatedAt: string;
}
```

**パイプライン統合**:
- Node 01 → Node 02 → Node 03, 04
- prompts.jsonをresearch-node、script-generation-nodeが使用

---

### 3. Node 09: アナリティクス収集ノード（Analytics Collection Node）

**目的**: YouTube Analytics APIでメトリクスを取得

**統合方法**:

```typescript
// src/nodes/analytics-collection-node.ts
export class AnalyticsCollectionNode extends BaseNode {
  protected async executeInternal(input: NodeInput): Promise<Omit<NodeOutput, 'metadata'>> {
    // 1. upload-result.jsonから動画IDを取得
    const uploadResult = await this.loadUploadResult(input.workDir);
    
    // 2. YouTube Analytics APIを呼び出し
    const analytics = await this.fetchAnalytics(uploadResult.videoId);
    
    // 3. analytics.jsonに出力
    await this.saveAnalytics(analytics);
    
    // 4. キャッシュに保存（戦略分析用）
    await this.cacheAnalytics(analytics);
    
    return this.createSuccessOutput(analytics, 'analytics.json');
  }
}
```

**設定ファイル**: `config/analytics-collection-config.json`
```json
{
  "enabled": true,
  "timeout": 180000,
  "metricsToCollect": ["views", "likes", "comments", "watchTime"],
  "collectionDelay": 86400000,
  "cacheEnabled": true
}
```

**データ構造**: `src/types/data-types.ts`に追加
```typescript
export interface AnalyticsData {
  videoId: string;
  views: number;
  likes: number;
  comments: number;
  watchTime: number;
  averageViewDuration: number;
  collectedAt: string;
}
```

**パイプライン統合**:
- Node 08 → Node 09（動画投稿後、一定時間後に実行）
- analytics.jsonをNode 01が読み込み、戦略分析に使用

---

### 4. オーケストレーター統合

**目的**: より高度なパイプライン制御

**実装方法**:

```typescript
// src/orchestrator/pipeline.ts
export class PipelineOrchestrator {
  private nodes: Map<string, BaseNode>;
  private config: PipelineConfig;
  
  constructor(config: PipelineConfig) {
    this.config = config;
    this.nodes = new Map();
    this.initializeNodes();
  }
  
  private initializeNodes(): void {
    // 全ノードを初期化
    if (this.config.nodes.strategyAnalysis?.enabled) {
      this.nodes.set('strategy', new StrategyAnalysisNode(this.config.nodes.strategyAnalysis));
    }
    // ... 他のノード
  }
  
  async execute(): Promise<PipelineResult> {
    const results: NodeExecutionResult[] = [];
    let previousOutput: NodeOutput | undefined;
    
    // ノードを順次実行
    for (const [name, node] of this.nodes) {
      const input: NodeInput = {
        config: node.getConfig(),
        workDir: this.config.outputDir,
        previousOutput
      };
      
      const result = await this.executeNode(node, name, input);
      results.push(result);
      
      if (!result.success) {
        return this.createFailureResult(results);
      }
      
      previousOutput = result.output;
    }
    
    return this.createSuccessResult(results);
  }
  
  private async executeNode(
    node: BaseNode,
    name: string,
    input: NodeInput
  ): Promise<NodeExecutionResult> {
    // エラーハンドリング、ログ記録、リトライロジック
    // ...
  }
}
```

**使用方法**:
```typescript
// src/index.ts
import { PipelineOrchestrator } from './orchestrator/pipeline.js';
import { readJson } from './utils/file-utils.js';

async function main() {
  const config = await readJson<PipelineConfig>('config/pipeline-config.json');
  const orchestrator = new PipelineOrchestrator(config);
  
  const result = await orchestrator.execute();
  
  if (result.success) {
    console.log('Pipeline completed successfully');
  } else {
    console.error('Pipeline failed');
  }
}

main();
```

---

## 新しいノードの追加方法

### ステップ1: ノードクラスの作成

```typescript
// src/nodes/my-new-node.ts
import { BaseNode } from './base/base-node.js';
import { NodeInput, NodeOutput, MyNewNodeConfig } from '../types/index.js';

export class MyNewNode extends BaseNode {
  constructor(config: MyNewNodeConfig) {
    super('MyNewNode', config);
  }
  
  protected async executeInternal(input: NodeInput): Promise<Omit<NodeOutput, 'metadata'>> {
    try {
      // 1. 入力データの読み込み
      const inputData = await this.loadInputData(input.workDir);
      
      // 2. 処理の実行
      const result = await this.process(inputData);
      
      // 3. 出力データの保存
      const outputPath = await this.saveOutput(result, input.workDir);
      
      return this.createSuccessOutput(result, outputPath);
    } catch (error) {
      return this.createFailureOutput(error as Error);
    }
  }
  
  private async process(data: any): Promise<any> {
    // ノード固有の処理
  }
}
```

### ステップ2: 型定義の追加

```typescript
// src/types/config-types.ts
export interface MyNewNodeConfig extends NodeConfig {
  // ノード固有の設定
  myParameter: string;
  myTimeout: number;
}

// src/types/data-types.ts
export interface MyNewData {
  // ノード固有のデータ構造
  field1: string;
  field2: number;
  generatedAt: string;
}
```

### ステップ3: 設定ファイルの作成

```json
// config/my-new-node-config.json
{
  "enabled": true,
  "timeout": 300000,
  "retryCount": 3,
  "retryDelay": 5000,
  "myParameter": "value",
  "myTimeout": 60000
}
```

### ステップ4: 実行スクリプトの作成

```typescript
// src/scripts/run-my-new-node.ts
#!/usr/bin/env node
import { MyNewNode } from '../nodes/my-new-node.js';
import { MyNewNodeConfig, NodeInput } from '../types/index.js';
import { readJson, createDateOutputDir } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';

async function main() {
  const config = await readJson<MyNewNodeConfig>('config/my-new-node-config.json');
  const node = new MyNewNode(config);
  
  const workDir = await createDateOutputDir('output');
  const input: NodeInput = {
    config,
    workDir,
    previousOutput: undefined
  };
  
  const result = await node.execute(input);
  
  if (result.success) {
    logger.info('Node completed successfully');
  } else {
    logger.error('Node failed');
    process.exit(1);
  }
}

main();
```

### ステップ5: パイプラインへの統合

```typescript
// src/scripts/run-pipeline.ts に追加
import { MyNewNode } from '../nodes/my-new-node.js';

// ...

if (config.nodes?.myNewNode && config.nodes.myNewNode.enabled !== false) {
  const myNode = new MyNewNode(config.nodes.myNewNode as MyNewNodeConfig);
  const input: NodeInput = {
    config: config.nodes.myNewNode,
    workDir,
    previousOutput
  };
  
  const result = await executeNode(myNode, 'My New Node', input);
  results.push(result);
  
  if (!result.success) {
    logger.error('Pipeline halted due to My New Node failure');
    process.exit(1);
  }
  
  previousOutput = result.output;
}
```

---

## ベストプラクティス

### 1. エラーハンドリング

```typescript
// 常にtry-catchを使用
try {
  const result = await someOperation();
  return this.createSuccessOutput(result, outputPath);
} catch (error) {
  this.logger.error('Operation failed', error as Error);
  return this.createFailureOutput(error as Error);
}
```

### 2. ログ記録

```typescript
// 適切なログレベルを使用
this.logger.debug('Detailed debug information');
this.logger.info('Important information');
this.logger.warn('Warning message');
this.logger.error('Error message', error);
```

### 3. 設定の検証

```typescript
// 設定値を検証
if (!config.requiredParameter) {
  throw new ConfigError(this.name, 'requiredParameter is missing');
}
```

### 4. リトライロジック

```typescript
// リトライが必要な処理
import { retry } from '../utils/retry.js';

const result = await retry(
  () => this.callExternalAPI(),
  {
    maxRetries: 3,
    delay: 5000,
    retryCondition: (error) => error.code === 'ETIMEDOUT'
  }
);
```

### 5. 型安全性

```typescript
// 常に型を明示
const config: MyNodeConfig = this.getConfig() as MyNodeConfig;
const data: MyData = await readJson<MyData>(dataPath);
```

---

## パフォーマンス最適化

### 1. 並列処理

```typescript
// 独立した処理は並列実行
const [data1, data2, data3] = await Promise.all([
  this.fetchData1(),
  this.fetchData2(),
  this.fetchData3()
]);
```

### 2. キャッシング

```typescript
// 頻繁にアクセスするデータはキャッシュ
private cache: Map<string, any> = new Map();

async getData(key: string): Promise<any> {
  if (this.cache.has(key)) {
    return this.cache.get(key);
  }
  
  const data = await this.fetchData(key);
  this.cache.set(key, data);
  return data;
}
```

### 3. ストリーミング処理

```typescript
// 大きなファイルはストリーミング処理
import { createReadStream, createWriteStream } from 'fs';

const readStream = createReadStream(inputPath);
const writeStream = createWriteStream(outputPath);

readStream.pipe(transformStream).pipe(writeStream);
```

---

## テスト戦略

### 1. ユニットテスト

```typescript
// tests/unit/my-node.test.ts
import { MyNewNode } from '../../src/nodes/my-new-node';

describe('MyNewNode', () => {
  it('should process data correctly', async () => {
    const config = { /* test config */ };
    const node = new MyNewNode(config);
    
    const input = { /* test input */ };
    const result = await node.execute(input);
    
    expect(result.success).toBe(true);
  });
});
```

### 2. 統合テスト

```typescript
// tests/integration/pipeline.test.ts
describe('Pipeline Integration', () => {
  it('should execute all nodes successfully', async () => {
    // パイプライン全体のテスト
  });
});
```

### 3. E2Eテスト

```typescript
// tests/e2e/full-pipeline.test.ts
describe('Full Pipeline E2E', () => {
  it('should generate and upload video', async () => {
    // 実際の外部サービスを使用したテスト
  });
});
```

---

## まとめ

このアーキテクチャドキュメントは、現在のMVP実装と将来の拡張方法を示しています。

**現在実装済み**:
- ✅ Node 03-08（コア動画生成機能）
- ✅ BaseNodeクラス
- ✅ ユーティリティ（Logger, CLI Executor, File Utils, Retry, Validator）
- ✅ 型定義システム
- ✅ 設定管理システム
- ✅ パイプライン実行スクリプト

**将来の拡張**:
- 🔲 Node 01（戦略分析）
- 🔲 Node 02（プロンプト改修）
- 🔲 Node 09（アナリティクス収集）
- 🔲 オーケストレーター統合

新しいノードの追加は、このドキュメントの「新しいノードの追加方法」セクションに従って実装してください。
