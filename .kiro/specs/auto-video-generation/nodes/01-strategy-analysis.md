# Strategy Analysis Node - 詳細設計

## 要件 (requirements.mdより)

このノードは以下の要件を満たす必要があります：

### 要件2

**ユーザーストーリー:** コンテンツクリエイターとして、戦略分析ノードが私の個人的な価値観とトーンを組み込みながら動画トピックとトレンドを分析することで、私独自の視点を反映したコンテンツを生成できるようにしたい。

#### 受入基準

1. 戦略分析ノードは、実行開始時に設定ファイルからユーザープロファイルを読み込むこと
2. 戦略分析ノードは、入力パラメータに基づいて現在のトレンドとトピックを分析すること
3. 戦略分析ノードは、ユーザープロファイルデータ（トーン、価値観、禁止ワード、ターゲットオーディエンスの好み）を戦略出力に統合すること
4. 戦略分析ノードは、ターゲットキーワード、コンテンツテーマ、オーディエンスインサイト、ユーザー固有のガイドラインを含む構造化された戦略データを出力すること
5. 戦略分析ノードは、5分以内に実行を完了すること
6. 戦略分析ノードが完了したとき、システムは戦略データをファイルに保存すること
7. ユーザープロファイルファイルが見つからないか無効な場合、戦略分析ノードはデフォルトの中立設定を使用し、警告をログに記録すること

### 関連要件

- 要件1.2: ノードが正常に完了したとき、システムは出力データをパイプライン内の次のノードに渡すこと
- 要件11.3: システムは、トーン、価値観、禁止ワード、コンテンツ設定を含む独立したユーザープロファイル設定ファイルをサポートすること
- 要件12.1: システムは、各ノード実行の開始時刻と完了時刻をログに記録すること

## 概要

戦略分析ノードは、ユーザープロファイルを読み込み、トレンド分析を行い、両者を統合して動画制作の戦略データを生成します。

## 入力

- User Profile (config/user-profile.json)
- Pipeline trigger parameters (optional)

## 出力

- strategy.json

## インターフェース

```typescript
interface StrategyAnalysisNode extends Node {
  loadUserProfile(path: string): Promise<UserProfile>;
  analyzeTrends(params: any): Promise<TrendData>;
  integrateUserPerspective(trends: TrendData, profile: UserProfile): StrategyData;
}

interface UserProfile {
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

interface StrategyData {
  keywords: string[];
  contentTheme: string;
  targetAudience: string;
  tone: string;
  userGuidelines: {
    values: string[];
    prohibitedWords: string[];
  };
  suggestedTitle: string;
  suggestedTags: string[];
}
```

## 戦略分析の実行モード

このノードは以下の3つのモードで動作します：

### モード1: 新規戦略生成（デフォルト）
- Codex CLIを使用してトレンド分析を実行
- ユーザープロファイルと統合して新しい戦略を生成

### モード2: 既存戦略の再利用
- 前回生成したstrategy.jsonを読み込み
- ユーザープロファイルの変更のみを反映
- トリガー条件：`--reuse-strategy` フラグまたは設定

### モード3: 手動指定
- 設定ファイルで明示的にテーマを指定
- トリガー条件：`manualTheme` パラメータが存在

## 実装詳細

### 0. 実行モードの判定

```typescript
determineExecutionMode(input: NodeInput): ExecutionMode {
  const config = this.getConfig();
  
  // モード3: 手動指定
  if (config.manualTheme) {
    return ExecutionMode.MANUAL;
  }
  
  // モード2: 既存戦略の再利用
  if (config.reuseStrategy) {
    const previousStrategyPath = path.join(config.strategyCache || './cache', 'strategy.json');
    if (fs.existsSync(previousStrategyPath)) {
      return ExecutionMode.REUSE;
    }
  }
  
  // モード1: 新規戦略生成（デフォルト）
  return ExecutionMode.NEW;
}

enum ExecutionMode {
  NEW = 'new',
  REUSE = 'reuse',
  MANUAL = 'manual'
}
```

### 1. User Profile Loading

```typescript
async loadUserProfile(path: string): Promise<UserProfile> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    const profile = JSON.parse(content);
    
    // Validate required fields
    if (!profile.tone || !profile.targetAudience) {
      throw new Error('Invalid user profile: missing required fields');
    }
    
    return profile;
  } catch (error) {
    logger.warn(`Failed to load user profile: ${error.message}`);
    // Return default profile
    return {
      tone: 'neutral',
      values: [],
      prohibitedWords: [],
      targetAudience: 'general audience',
      contentPreferences: {
        topics: [],
        avoidTopics: [],
        preferredLength: 'medium'
      }
    };
  }
}
```

### 2. Trend Analysis using Codex CLI

```typescript
async analyzeTrends(profile: UserProfile, params: any): Promise<TrendData> {
  const config = this.getConfig();
  const codexCommand = config.codexCommand || 'codex';
  
  // Build analysis prompt
  const prompt = this.buildAnalysisPrompt(profile, params);
  
  // Execute Codex CLI
  logger.info('Executing Codex CLI for trend analysis');
  const rawOutput = await this.executeCodexCLI(codexCommand, prompt);
  
  // Parse output
  const trendData = this.parseCodexOutput(rawOutput);
  
  return trendData;
}

private buildAnalysisPrompt(profile: UserProfile, params: any): string {
  const topics = profile.contentPreferences.topics.join(', ');
  const avoidTopics = profile.contentPreferences.avoidTopics.join(', ');
  const season = this.getCurrentSeason();
  
  return `
あなたは動画コンテンツ戦略の専門家です。以下の情報を基に、次の動画のテーマと戦略を分析してください。

【ユーザー情報】
- 興味のあるトピック: ${topics || '指定なし'}
- 避けるトピック: ${avoidTopics || 'なし'}
- ターゲットオーディエンス: ${profile.targetAudience}
- 希望するトーン: ${profile.tone}

【コンテキスト】
- 現在の季節: ${season}
- 追加パラメータ: ${JSON.stringify(params || {})}

【タスク】
1. 上記のトピックに関連する最新のトレンドを分析
2. ターゲットオーディエンスに響くテーマを提案
3. 季節性を考慮したコンテンツアイデアを提供

以下のJSON形式で出力してください：
{
  "trendingTopics": ["トピック1", "トピック2", "トピック3"],
  "seasonalThemes": ["季節テーマ1", "季節テーマ2"],
  "suggestedKeywords": ["キーワード1", "キーワード2", "キーワード3"],
  "contentIdeas": ["アイデア1", "アイデア2"],
  "rationale": "この戦略を選んだ理由"
}
`.trim();
}

private async executeCodexCLI(command: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, ['--search', prompt], {
      timeout: this.getConfig().timeout || 300000,
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Codex CLI failed: ${stderr}`));
      }
    });
    
    process.on('error', (error) => {
      reject(error);
    });
  });
}

private parseCodexOutput(output: string): TrendData {
  try {
    // Try to parse as JSON
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        trendingTopics: data.trendingTopics || [],
        seasonalThemes: data.seasonalThemes || [],
        suggestedKeywords: data.suggestedKeywords || [],
        contentIdeas: data.contentIdeas || [],
        rationale: data.rationale || '',
        analyzedAt: new Date().toISOString()
      };
    }
  } catch (error) {
    logger.warn(`Failed to parse Codex output as JSON: ${error.message}`);
  }
  
  // Fallback: use default values
  return this.getDefaultTrendData();
}

private getDefaultTrendData(): TrendData {
  return {
    trendingTopics: ['technology', 'productivity', 'tutorial'],
    seasonalThemes: this.getSeasonalThemes(),
    suggestedKeywords: ['guide', 'tips', 'how-to'],
    contentIdeas: ['基本的なチュートリアル', '実践的なヒント集'],
    rationale: 'デフォルトの汎用的なテーマを使用',
    analyzedAt: new Date().toISOString()
  };
}

private getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return '春';
  if (month >= 6 && month <= 8) return '夏';
  if (month >= 9 && month <= 11) return '秋';
  return '冬';
}

private getSeasonalThemes(): string[] {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return ['新生活', '新しい始まり'];
  if (month >= 6 && month <= 8) return ['夏休み', 'バケーション'];
  if (month >= 9 && month <= 11) return ['秋', '学び直し'];
  return ['年末', '振り返り'];
}
```

### 3. User Perspective Integration

```typescript
integrateUserPerspective(trends: TrendData, profile: UserProfile): StrategyData {
  // Filter trending topics based on user preferences
  const relevantTopics = trends.trendingTopics.filter(topic => {
    const isPreferred = profile.contentPreferences.topics.length === 0 ||
                       profile.contentPreferences.topics.some(pref => 
                         topic.toLowerCase().includes(pref.toLowerCase())
                       );
    const isAvoided = profile.contentPreferences.avoidTopics.some(avoid =>
                       topic.toLowerCase().includes(avoid.toLowerCase())
                     );
    return isPreferred && !isAvoided;
  });

  // Generate content theme
  const contentTheme = this.generateContentTheme(relevantTopics, profile);
  
  // Generate title and tags
  const suggestedTitle = this.generateTitle(contentTheme, profile.tone);
  const suggestedTags = this.generateTags(relevantTopics, trends.suggestedKeywords);

  return {
    keywords: [...relevantTopics, ...trends.suggestedKeywords],
    contentTheme,
    targetAudience: profile.targetAudience,
    tone: profile.tone,
    userGuidelines: {
      values: profile.values,
      prohibitedWords: profile.prohibitedWords
    },
    suggestedTitle,
    suggestedTags
  };
}

private generateContentTheme(topics: string[], profile: UserProfile): string {
  const mainTopic = topics[0] || 'technology';
  const values = profile.values.join(', ');
  return `${mainTopic}に関する${values}を重視したコンテンツ`;
}

private generateTitle(theme: string, tone: string): string {
  const tonePrefix = {
    'enthusiastic': '【必見】',
    'professional': '【解説】',
    'casual': '【簡単】'
  };
  
  return `${tonePrefix[tone] || ''}${theme}`;
}

private generateTags(topics: string[], keywords: string[]): string[] {
  return [...topics, ...keywords].slice(0, 10);
}
```

### 4. 既存戦略の再利用

```typescript
async reuseExistingStrategy(profile: UserProfile): Promise<StrategyData> {
  const config = this.getConfig();
  const cachePath = path.join(config.strategyCache || './cache', 'strategy.json');
  
  logger.info(`Reusing existing strategy from: ${cachePath}`);
  
  const content = await fs.readFile(cachePath, 'utf-8');
  const existingStrategy = JSON.parse(content);
  
  // Update only user-specific fields
  existingStrategy.tone = profile.tone;
  existingStrategy.targetAudience = profile.targetAudience;
  existingStrategy.userGuidelines = {
    values: profile.values,
    prohibitedWords: profile.prohibitedWords
  };
  
  logger.info('Updated existing strategy with current user profile');
  return existingStrategy;
}
```

### 5. 手動指定モード

```typescript
async createManualStrategy(profile: UserProfile, manualTheme: string): Promise<StrategyData> {
  logger.info(`Creating strategy with manual theme: ${manualTheme}`);
  
  return {
    keywords: [manualTheme],
    contentTheme: manualTheme,
    targetAudience: profile.targetAudience,
    tone: profile.tone,
    userGuidelines: {
      values: profile.values,
      prohibitedWords: profile.prohibitedWords
    },
    suggestedTitle: `【${profile.tone === 'enthusiastic' ? '必見' : '解説'}】${manualTheme}`,
    suggestedTags: [manualTheme, ...profile.contentPreferences.topics].slice(0, 10)
  };
}
```

### 6. Execute Method

```typescript
async execute(input: NodeInput): Promise<NodeOutput> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting Strategy Analysis Node');
    
    // Load user profile
    const profilePath = input.config.userProfilePath || './config/user-profile.json';
    const profile = await this.loadUserProfile(profilePath);
    
    // Determine execution mode
    const mode = this.determineExecutionMode(input);
    logger.info(`Execution mode: ${mode}`);
    
    let strategy: StrategyData;
    
    switch (mode) {
      case ExecutionMode.MANUAL:
        // Manual theme specified
        strategy = await this.createManualStrategy(profile, input.config.manualTheme);
        break;
        
      case ExecutionMode.REUSE:
        // Reuse existing strategy
        strategy = await this.reuseExistingStrategy(profile);
        break;
        
      case ExecutionMode.NEW:
      default:
        // Generate new strategy using Codex CLI
        const trends = await this.analyzeTrends(profile, input.config.params);
        strategy = this.integrateUserPerspective(trends, profile);
        
        // Cache the strategy for future reuse
        await this.cacheStrategy(strategy);
        break;
    }
    
    // Save output
    const outputPath = path.join(input.workDir, 'strategy.json');
    await fs.writeFile(outputPath, JSON.stringify(strategy, null, 2), 'utf-8');
    
    logger.info('Strategy Analysis Node completed successfully');
    
    return {
      success: true,
      data: strategy,
      outputPath,
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        mode
      }
    };
  } catch (error) {
    logger.error(`Strategy Analysis Node failed: ${error.message}`);
    throw new PipelineError(
      ErrorType.VALIDATION_ERROR,
      'StrategyAnalysisNode',
      error.message,
      error
    );
  }
}

private async cacheStrategy(strategy: StrategyData): Promise<void> {
  const config = this.getConfig();
  const cacheDir = config.strategyCache || './cache';
  
  // Ensure cache directory exists
  await fs.mkdir(cacheDir, { recursive: true });
  
  const cachePath = path.join(cacheDir, 'strategy.json');
  await fs.writeFile(cachePath, JSON.stringify(strategy, null, 2), 'utf-8');
  
  logger.info(`Strategy cached to: ${cachePath}`);
}
```

## エラーハンドリング

- ユーザープロファイルが見つからない場合：デフォルト設定を使用し、警告をログに記録
- 必須フィールドが欠落している場合：エラーをスローしてパイプラインを停止
- トレンド分析が失敗した場合：デフォルトのトレンドデータを使用

## 設定例

### 新規戦略生成（デフォルト）

```json
{
  "strategyAnalysis": {
    "enabled": true,
    "timeout": 300000,
    "codexCommand": "codex",
    "userProfilePath": "./config/user-profile.json"
  }
}
```

### 既存戦略の再利用

```json
{
  "strategyAnalysis": {
    "enabled": true,
    "reuseStrategy": true,
    "strategyCache": "./cache",
    "userProfilePath": "./config/user-profile.json"
  }
}
```

### 手動テーマ指定

```json
{
  "strategyAnalysis": {
    "enabled": true,
    "manualTheme": "TypeScriptの最新機能解説",
    "userProfilePath": "./config/user-profile.json"
  }
}
```

## 実行フロー図

```
開始
  ↓
実行モード判定
  ├─ 手動指定？ → 手動戦略生成 → 出力
  ├─ 再利用？ → 既存戦略読み込み → ユーザープロファイル統合 → 出力
  └─ 新規生成 → Codex CLI実行 → トレンド分析 → ユーザープロファイル統合 → キャッシュ → 出力
```

## エラーハンドリング

- ユーザープロファイルが見つからない場合：デフォルト設定を使用し、警告をログに記録
- Codex CLIが失敗した場合：デフォルトのトレンドデータを使用
- Codex出力のパースに失敗した場合：デフォルトのトレンドデータを使用
- 既存戦略ファイルが見つからない場合（再利用モード）：新規生成モードにフォールバック
- 必須フィールドが欠落している場合：エラーをスローしてパイプラインを停止

## テスト観点

### 基本機能
- ユーザープロファイルの正常読み込み
- ファイル不在時のデフォルト設定使用
- トーン、価値観、禁止ワードの正しい統合
- トピックフィルタリングの動作確認
- タイトル・タグ生成の妥当性

### 実行モード
- 新規戦略生成モードの動作確認
- 既存戦略再利用モードの動作確認
- 手動テーマ指定モードの動作確認
- モード判定ロジックの正確性

### Codex CLI統合
- Codex CLIの正常実行
- プロンプト生成の妥当性
- 出力のJSON解析
- タイムアウト処理
- エラー時のフォールバック

### キャッシュ機能
- 戦略データの正しいキャッシュ
- キャッシュディレクトリの自動作成
- 既存キャッシュの読み込み
