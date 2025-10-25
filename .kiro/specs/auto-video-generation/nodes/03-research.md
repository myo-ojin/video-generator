# Research Node - 詳細設計

## 要件 (requirements.mdより)

このノードは以下の要件を満たす必要があります：

### 要件4

**ユーザーストーリー:** コンテンツクリエイターとして、リサーチノードがCodex CLIを使用して情報を収集することで、原稿が正確で関連性の高いデータに基づくようにしたい。

#### 受入基準

1. リサーチノードは、改修されたプロンプトを使用してCodex CLIコマンド `codex --search` を実行すること
2. リサーチノードは、Codex CLIからの出力をキャプチャして解析すること
3. リサーチノードは、リサーチ結果を原稿生成に適した形式に構造化すること
4. Codex CLIコマンドが失敗した場合、リサーチノードは指数バックオフで最大3回リトライすること
5. リサーチノードは、10分以内に実行を完了すること

### 関連要件

- 要件1.2: ノードが正常に完了したとき、システムは出力データをパイプライン内の次のノードに渡すこと
- 要件1.3: ノードが実行中に失敗した場合、システムはエラー詳細をログに記録し、パイプラインを停止すること
- 要件11.2: システムは、CLIコマンドパスの設定を許可すること
- 要件12.2: システムは、すべてのCLIコマンド呼び出しとその引数をログに記録すること

## 概要

リサーチノードは、Codex CLIを使用してプロンプトに基づいた情報収集を行い、構造化されたリサーチデータを生成します。

## 入力

- prompts.json

## 出力

- research.json

## インターフェース

```typescript
interface ResearchNode extends Node {
  executeCodexCLI(prompt: string): Promise<string>;
  parseCodexOutput(output: string): ResearchData;
  retryWithBackoff(fn: () => Promise<any>, maxRetries: number): Promise<any>;
}

interface ResearchData {
  query: string;
  results: Array<{
    title: string;
    content: string;
    source?: string;
  }>;
  summary: string;
}
```

## リサーチの実行モード

このノードは以下の2つのモードで動作します：

### モード1: プロンプト改修ノードからの入力（通常）
- prompts.jsonからresearchPromptを読み込み
- 最適化されたプロンプトでリサーチを実行

### モード2: デフォルトプロンプト（MVP/スタンドアロン）
- prompts.jsonが存在しない場合
- 設定ファイルまたはstrategy.jsonから基本情報を取得
- デフォルトのプロンプトテンプレートを使用

## 実装詳細

### 0. プロンプトの準備

```typescript
async prepareResearchPrompt(input: NodeInput): Promise<string> {
  const promptsPath = path.join(input.workDir, 'prompts.json');
  
  // Try to load from prompts.json (from Prompt Refinement Node)
  if (await this.fileExists(promptsPath)) {
    logger.info('Loading research prompt from prompts.json');
    const promptsContent = await fs.readFile(promptsPath, 'utf-8');
    const prompts = JSON.parse(promptsContent);
    return prompts.researchPrompt;
  }
  
  // Fallback: Generate default prompt
  logger.info('prompts.json not found, generating default research prompt');
  return await this.generateDefaultPrompt(input);
}

private async generateDefaultPrompt(input: NodeInput): Promise<string> {
  const config = this.getConfig();
  
  // Try to load strategy.json for context
  let theme = config.defaultTheme || 'technology trends';
  let keywords = config.defaultKeywords || ['tutorial', 'guide'];
  
  const strategyPath = path.join(input.workDir, 'strategy.json');
  if (await this.fileExists(strategyPath)) {
    const strategyContent = await fs.readFile(strategyPath, 'utf-8');
    const strategy = JSON.parse(strategyContent);
    theme = strategy.contentTheme || theme;
    keywords = strategy.keywords || keywords;
  }
  
  return this.buildDefaultPrompt(theme, keywords);
}

private buildDefaultPrompt(theme: string, keywords: string[]): string {
  const config = this.getConfig();
  const keywordStr = keywords.join(', ');
  
  // 固定部分（普遍）- システムが保証する基本構造
  const fixedPrefix = config.promptTemplate?.fixedPrefix || 
    '以下のテーマについて最新の情報をリサーチしてください：';
  
  const fixedSuffix = config.promptTemplate?.fixedSuffix || `
出力形式：
- 各情報源のタイトルと要約
- 重要なポイントのリスト
- 参考URL（可能な場合）`;
  
  // 可変部分（カスタマイズ可能）- ユーザーが変更できる
  const customRequirements = config.promptTemplate?.customRequirements || [
    '最新のトレンドや動向',
    '実用的な情報や事例',
    '信頼できる情報源からのデータ'
  ];
  
  const customInstructions = config.promptTemplate?.customInstructions || '';
  
  // トピック数の指定（デフォルト3、AIニュース向けは3-4を推奨）
  const topicCount = config.topicCount || 3;
  const topicInstruction = `\n【重要】\n${topicCount}つの異なるトピック/ニュースを収集してください。各トピックは独立した内容であること。`;
  
  // プロンプト組み立て
  return `
${fixedPrefix}

テーマ: ${theme}
キーワード: ${keywordStr}

リサーチ要件：
${customRequirements.map(req => `- ${req}`).join('\n')}
${topicInstruction}

${customInstructions ? `追加指示：\n${customInstructions}\n` : ''}
${fixedSuffix}
`.trim();
}

private async fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
```

### 1. Codex CLI Execution

```typescript
async executeCodexCLI(prompt: string): Promise<string> {
  const config = this.getConfig();
  const command = config.codexCommand || 'codex';
  const args = [...(config.codexArgs || ['--search']), prompt];
  
  logger.debug(`Executing Codex CLI: ${command} ${args.join(' ')}`);
  
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      timeout: config.timeout,
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
        reject(new Error(`Codex CLI failed with code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (error) => {
      reject(new Error(`Failed to execute Codex CLI: ${error.message}`));
    });
  });
}
```

### 2. Output Parsing

```typescript
parseCodexOutput(output: string): ResearchData {
  try {
    // Attempt to parse as JSON first
    const jsonData = JSON.parse(output);
    return this.normalizeResearchData(jsonData);
  } catch {
    // Fallback: parse as plain text
    return this.parseTextOutput(output);
  }
}

private normalizeResearchData(data: any): ResearchData {
  return {
    query: data.query || '',
    results: (data.results || []).map((r: any) => ({
      title: r.title || 'Untitled',
      content: r.content || r.summary || '',
      source: r.source || r.url
    })),
    summary: data.summary || this.generateSummary(data.results)
  };
}

private parseTextOutput(text: string): ResearchData {
  // Simple text parsing logic
  const lines = text.split('\n').filter(line => line.trim());
  const results = [];
  
  let currentResult = null;
  for (const line of lines) {
    if (line.startsWith('Title:') || line.startsWith('##')) {
      if (currentResult) results.push(currentResult);
      currentResult = {
        title: line.replace(/^(Title:|##)\s*/, '').trim(),
        content: '',
        source: undefined
      };
    } else if (currentResult && line.startsWith('Source:')) {
      currentResult.source = line.replace(/^Source:\s*/, '').trim();
    } else if (currentResult) {
      currentResult.content += line + '\n';
    }
  }
  
  if (currentResult) results.push(currentResult);
  
  return {
    query: 'Research query',
    results,
    summary: this.generateSummary(results)
  };
}

private generateSummary(results: any[]): string {
  if (!results || results.length === 0) {
    return 'No research results found.';
  }
  
  const titles = results.map(r => r.title).join(', ');
  return `Found ${results.length} research results: ${titles}`;
}
```

### 3. 重複チェック機能

```typescript
async loadPreviousTopics(config: any): Promise<string[]> {
  const historyPath = config.topicHistoryPath || './cache/topic-history.json';
  const daysToCheck = config.duplicateCheckDays || 7;
  
  try {
    if (!await this.fileExists(historyPath)) {
      return [];
    }
    
    const historyContent = await fs.readFile(historyPath, 'utf-8');
    const history = JSON.parse(historyContent);
    
    // Filter topics from the last N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToCheck);
    
    const recentTopics = history
      .filter((entry: any) => new Date(entry.date) >= cutoffDate)
      .flatMap((entry: any) => entry.topics);
    
    logger.info(`Loaded ${recentTopics.length} topics from the last ${daysToCheck} days`);
    return recentTopics;
  } catch (error) {
    logger.warn(`Failed to load topic history: ${error.message}`);
    return [];
  }
}

async saveTopicHistory(topics: string[], config: any): Promise<void> {
  const historyPath = config.topicHistoryPath || './cache/topic-history.json';
  const maxHistoryDays = config.maxHistoryDays || 30;
  
  try {
    // Ensure cache directory exists
    const cacheDir = path.dirname(historyPath);
    await fs.mkdir(cacheDir, { recursive: true });
    
    // Load existing history
    let history = [];
    if (await this.fileExists(historyPath)) {
      const historyContent = await fs.readFile(historyPath, 'utf-8');
      history = JSON.parse(historyContent);
    }
    
    // Add today's topics
    history.push({
      date: new Date().toISOString().split('T')[0],
      topics
    });
    
    // Remove old entries
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxHistoryDays);
    history = history.filter((entry: any) => new Date(entry.date) >= cutoffDate);
    
    // Save updated history
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
    logger.info(`Saved ${topics.length} topics to history`);
  } catch (error) {
    logger.error(`Failed to save topic history: ${error.message}`);
  }
}

private checkDuplicates(newTopics: string[], previousTopics: string[]): string[] {
  if (previousTopics.length === 0) {
    return newTopics;
  }
  
  const uniqueTopics = newTopics.filter(topic => {
    const topicLower = topic.toLowerCase();
    return !previousTopics.some(prev => {
      const prevLower = prev.toLowerCase();
      // Check for exact match or high similarity
      return prevLower === topicLower || this.calculateSimilarity(topicLower, prevLower) > 0.7;
    });
  });
  
  const duplicateCount = newTopics.length - uniqueTopics.length;
  if (duplicateCount > 0) {
    logger.info(`Filtered out ${duplicateCount} duplicate topics`);
  }
  
  return uniqueTopics;
}

private calculateSimilarity(str1: string, str2: string): number {
  // Simple word-based similarity
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}
```

### 4. Execute Method with Retry and Duplicate Check

```typescript
async execute(input: NodeInput): Promise<NodeOutput> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting Research Node');
    
    const config = this.getConfig();
    
    // Load previous topics for duplicate check
    const previousTopics = await this.loadPreviousTopics(config);
    
    // Add previous topics to prompt if duplicate check is enabled
    let researchPrompt = await this.prepareResearchPrompt(input);
    if (config.enableDuplicateCheck !== false && previousTopics.length > 0) {
      const excludeInstruction = `\n\n【除外すべきトピック】\n以下のトピックは過去${config.duplicateCheckDays || 7}日間で既に扱っているため、避けてください：\n${previousTopics.map(t => `- ${t}`).join('\n')}`;
      researchPrompt += excludeInstruction;
    }
    
    logger.debug(`Research prompt: ${researchPrompt.substring(0, 100)}...`);
    
    // Execute Codex CLI with retry
    const rawOutput = await this.retryWithBackoff(
      () => this.executeCodexCLI(researchPrompt),
      config.retryCount || 3,
      config.retryDelay || 5000
    );
    
    // Parse output
    const researchData = this.parseCodexOutput(rawOutput);
    
    // Validate results
    if (researchData.results.length === 0) {
      logger.warn('No research results found, using placeholder data');
      researchData.results = this.getPlaceholderResults();
    }
    
    // Extract topics and check for duplicates
    const newTopics = researchData.results.map(r => r.title);
    const uniqueTopics = this.checkDuplicates(newTopics, previousTopics);
    
    // Filter results to only include unique topics
    researchData.results = researchData.results.filter(r => uniqueTopics.includes(r.title));
    
    // If too many duplicates were filtered, log warning
    if (researchData.results.length < config.topicCount) {
      logger.warn(`Only ${researchData.results.length} unique topics found (expected ${config.topicCount})`);
    }
    
    // Save topic history
    await this.saveTopicHistory(uniqueTopics, config);
    
    // Save output
    const outputPath = path.join(input.workDir, 'research.json');
    await fs.writeFile(outputPath, JSON.stringify(researchData, null, 2), 'utf-8');
    
    logger.info(`Research Node completed: ${researchData.results.length} unique results found`);
    
    return {
      success: true,
      data: researchData,
      outputPath,
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        uniqueTopicCount: uniqueTopics.length,
        duplicatesFiltered: newTopics.length - uniqueTopics.length
      }
    };
  } catch (error) {
    logger.error(`Research Node failed: ${error.message}`);
    throw new PipelineError(
      ErrorType.CLI_EXECUTION_ERROR,
      'ResearchNode',
      error.message,
      error
    );
  }
}

private getPlaceholderResults(): Array<{ title: string; content: string; source?: string }> {
  return [
    {
      title: 'プレースホルダー情報1',
      content: 'リサーチ結果が取得できなかったため、プレースホルダーデータを使用しています。',
      source: undefined
    },
    {
      title: 'プレースホルダー情報2',
      content: '実際の運用では、Codex CLIから有効なデータが返されます。',
      source: undefined
    }
  ];
}
```

## Codex CLI仕様

### コマンド形式

```bash
codex --search "<prompt>"
```

### 期待される出力形式

**JSON形式（推奨）:**
```json
{
  "query": "検索クエリ",
  "results": [
    {
      "title": "結果のタイトル",
      "content": "結果の内容",
      "source": "https://example.com"
    }
  ],
  "summary": "検索結果のサマリー"
}
```

**テキスト形式（フォールバック）:**
```
Title: 結果1のタイトル
結果1の内容...
Source: https://example.com

Title: 結果2のタイトル
結果2の内容...
```

## エラーハンドリング

- Codex CLIが見つからない場合：エラーをスローしてパイプラインを停止
- CLI実行がタイムアウトした場合：リトライ（最大3回）
- 出力のパースに失敗した場合：テキスト形式でのパースを試行
- リトライ上限に達した場合：エラーをスローしてパイプラインを停止

## リトライロジック

- 初回失敗：5秒待機後リトライ
- 2回目失敗：10秒待機後リトライ
- 3回目失敗：20秒待機後リトライ
- Exponential backoff: delay = baseDelay * 2^attempt

## 設定例

### 通常モード（プロンプト改修ノードと連携）

```json
{
  "research": {
    "enabled": true,
    "timeout": 600000,
    "retryCount": 3,
    "retryDelay": 5000,
    "codexCommand": "codex",
    "codexArgs": ["--search"]
  }
}
```

### スタンドアロンモード（デフォルトプロンプト使用）

**基本設定:**
```json
{
  "research": {
    "enabled": true,
    "timeout": 600000,
    "retryCount": 3,
    "retryDelay": 5000,
    "codexCommand": "codex",
    "codexArgs": ["--search"],
    "defaultTheme": "最新のWeb開発技術",
    "defaultKeywords": ["TypeScript", "React", "Next.js"]
  }
}
```

**AIニュース向け設定（3〜4トピック収集 + 重複チェック）:**
```json
{
  "research": {
    "enabled": true,
    "timeout": 600000,
    "retryCount": 3,
    "retryDelay": 5000,
    "codexCommand": "codex",
    "codexArgs": ["--search"],
    "defaultTheme": "今日のAIニュース",
    "defaultKeywords": ["AI", "機械学習", "LLM", "OpenAI", "Google AI"],
    "topicCount": 3,
    "note": "topicCount can be set to 3-4 for AI news videos",
    "enableDuplicateCheck": true,
    "duplicateCheckDays": 7,
    "maxHistoryDays": 30,
    "topicHistoryPath": "./cache/topic-history.json",
    "promptTemplate": {
      "customRequirements": [
        "本日または直近24時間以内のニュース",
        "企業の発表や新製品リリース",
        "信頼できるニュースソースからの情報",
        "日本語または英語の情報"
      ],
      "customInstructions": "各ニュースは独立したトピックとして、企業名・製品名・主要な変更点を明確に記載してください。"
    }
  }
}
```

**カスタマイズ設定（長尺チュートリアル向け）:**
```json
{
  "research": {
    "enabled": true,
    "timeout": 600000,
    "retryCount": 3,
    "retryDelay": 5000,
    "codexCommand": "codex",
    "codexArgs": ["--search"],
    "defaultTheme": "最新のWeb開発技術",
    "defaultKeywords": ["TypeScript", "React", "Next.js"],
    "topicCount": 1,
    "promptTemplate": {
      "customRequirements": [
        "最新のトレンドや動向",
        "実用的な情報や事例",
        "信頼できる情報源からのデータ",
        "日本語の情報を優先"
      ],
      "customInstructions": "特に初心者向けの情報を重視してください。詳細な解説が可能な情報を収集してください。"
    }
  }
}
```

## 実行フロー図

```
開始
  ↓
prompts.json存在確認
  ├─ 存在する → researchPromptを読み込み
  └─ 存在しない → デフォルトプロンプト生成
      ├─ strategy.json確認
      │   ├─ 存在する → テーマとキーワードを取得
      │   └─ 存在しない → 設定のデフォルト値を使用
      └─ プロンプトテンプレートに適用
  ↓
Codex CLI実行（リトライあり）
  ↓
出力パース（JSON → フォールバック → デフォルト）
  ↓
結果検証（0件の場合はプレースホルダー）
  ↓
research.json保存
  ↓
完了
```

## プロンプトテンプレート構造

### 固定部分（普遍・変更不可）

システムが保証する基本構造。これらは変更できません：

**fixedPrefix（固定プレフィックス）:**
```
以下のテーマについて最新の情報をリサーチしてください：
```

**fixedSuffix（固定サフィックス）:**
```
出力形式：
- 各情報源のタイトルと要約
- 重要なポイントのリスト
- 参考URL（可能な場合）
```

### 可変部分（カスタマイズ可能）

ユーザーが自由に変更できる部分：

**customRequirements（カスタム要件）:**
```json
[
  "最新のトレンドや動向",
  "実用的な情報や事例",
  "信頼できる情報源からのデータ"
]
```

**customInstructions（追加指示）:**
```
特に初心者向けの情報を重視してください。
```

### 完成形のプロンプト例（AIニュース向け）

```
以下のテーマについて最新の情報をリサーチしてください：

テーマ: 今日のAIニュース
キーワード: AI, 機械学習, LLM, OpenAI, Google AI

リサーチ要件：
- 本日または直近24時間以内のニュース
- 企業の発表や新製品リリース
- 信頼できるニュースソースからの情報
- 日本語または英語の情報

【重要】
3つの異なるトピック/ニュースを収集してください。各トピックは独立した内容であること。

追加指示：
各ニュースは独立したトピックとして、企業名・製品名・主要な変更点を明確に記載してください。

出力形式：
- 各情報源のタイトルと要約
- 重要なポイントのリスト
- 参考URL（可能な場合）
```

### 期待される出力例（AIニュース）

```json
{
  "query": "今日のAIニュース",
  "results": [
    {
      "title": "OpenAI、GPT-4 Turboを発表",
      "content": "OpenAIは本日、GPT-4 Turboを発表しました。128Kトークンのコンテキストウィンドウを持ち、従来モデルより3倍高速で、価格は1/3に削減されています。",
      "source": "https://openai.com/blog/gpt-4-turbo"
    },
    {
      "title": "Google、Gemini Proを一般公開",
      "content": "Googleは新しいマルチモーダルAI「Gemini Pro」を一般公開しました。テキスト、画像、音声を統合的に処理でき、Google Bardに統合されています。",
      "source": "https://blog.google/technology/ai/gemini-pro-launch"
    },
    {
      "title": "Anthropic、Claude 2.1をリリース",
      "content": "Anthropicは200Kトークンのコンテキストウィンドウを持つClaude 2.1をリリースしました。幻覚の発生率が50%削減され、より正確な応答が可能になっています。",
      "source": "https://www.anthropic.com/news/claude-2-1"
    }
  ],
  "summary": "本日のAI業界では、OpenAI、Google、Anthropicの3社が相次いで新モデルを発表。コンテキストウィンドウの拡大と精度向上が共通のトレンド。"
}
```

### プロンプトテンプレートのバリデーション

```typescript
private validatePromptTemplate(template: any): boolean {
  // 固定部分は変更を許可しない（デフォルト値を使用）
  if (template.fixedPrefix && template.fixedPrefix !== this.getDefaultFixedPrefix()) {
    logger.warn('fixedPrefix cannot be customized, using default');
    template.fixedPrefix = this.getDefaultFixedPrefix();
  }
  
  if (template.fixedSuffix && template.fixedSuffix !== this.getDefaultFixedSuffix()) {
    logger.warn('fixedSuffix cannot be customized, using default');
    template.fixedSuffix = this.getDefaultFixedSuffix();
  }
  
  // 可変部分は検証のみ
  if (template.customRequirements && !Array.isArray(template.customRequirements)) {
    logger.error('customRequirements must be an array');
    return false;
  }
  
  if (template.customInstructions && typeof template.customInstructions !== 'string') {
    logger.error('customInstructions must be a string');
    return false;
  }
  
  return true;
}

private getDefaultFixedPrefix(): string {
  return '以下のテーマについて最新の情報をリサーチしてください：';
}

private getDefaultFixedSuffix(): string {
  return `出力形式：
- 各情報源のタイトルと要約
- 重要なポイントのリスト
- 参考URL（可能な場合）`;
}
```

## エラーハンドリング

- Codex CLIが見つからない場合：エラーをスローしてパイプラインを停止
- CLI実行がタイムアウトした場合：リトライ（最大3回）
- 出力のパースに失敗した場合：テキスト形式でのパースを試行
- リトライ上限に達した場合：エラーをスローしてパイプラインを停止
- prompts.jsonが見つからない場合：デフォルトプロンプトを生成（警告をログに記録）
- リサーチ結果が0件の場合：プレースホルダーデータを使用（警告をログに記録）

## テスト観点

### 基本機能
- Codex CLI実行の成功
- JSON出力の正しいパース
- テキスト出力のフォールバックパース
- リトライロジックの動作確認
- タイムアウト処理の確認
- エラーハンドリングの妥当性

### プロンプト準備
- prompts.jsonからの正常読み込み
- prompts.json不在時のデフォルトプロンプト生成
- strategy.jsonからのテーマ・キーワード取得
- 設定のデフォルト値の使用
- デフォルトプロンプトテンプレートの正確性

### フォールバック処理
- リサーチ結果0件時のプレースホルダー使用
- Codex CLI失敗時のリトライ
- パース失敗時のフォールバック

### 重複チェック機能
- 過去トピックの正常読み込み
- トピック履歴ファイルの保存
- 重複トピックのフィルタリング
- 類似度計算の正確性
- プロンプトへの除外指示の追加
- 履歴ファイルの自動クリーンアップ（古いエントリの削除）
