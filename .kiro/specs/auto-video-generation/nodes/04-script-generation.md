# Script Generation Node - 詳細設計

## 要件 (requirements.mdより)

このノードは以下の要件を満たす必要があります：

### 要件5

**ユーザーストーリー:** コンテンツクリエイターとして、原稿生成ノードがClaude CLIを使用して動画原稿を作成することで、動画用の良質なコンテンツを得られるようにしたい。

#### 受入基準

1. 原稿生成ノードは、改修されたプロンプトとリサーチデータを使用してClaude CLIを実行すること
2. 原稿生成ノードは、日本語で完全な動画原稿を生成すること
3. 原稿生成ノードは、プレーンテキスト形式で原稿を出力すること
4. 原稿生成ノードは、原稿の長さが500文字から3000文字の間であることを保証すること
5. Claude CLIコマンドが失敗した場合、原稿生成ノードは最大3回リトライすること

### 関連要件

- 要件1.2: ノードが正常に完了したとき、システムは出力データをパイプライン内の次のノードに渡すこと
- 要件1.3: ノードが実行中に失敗した場合、システムはエラー詳細をログに記録し、パイプラインを停止すること
- 要件11.2: システムは、CLIコマンドパスと処理パラメータの設定を許可すること
- 要件12.2: システムは、すべてのCLIコマンド呼び出しとその引数をログに記録すること

## 概要

原稿生成ノードは、Claude CLIを使用してプロンプトとリサーチデータから動画用の原稿を生成します。

## 入力

- prompts.json
- research.json

## 出力

- script.txt

## インターフェース

```typescript
interface ScriptGenerationNode extends Node {
  executeClaudeCLI(prompt: string, context: string): Promise<string>;
  validateScriptLength(script: string): boolean;
  formatScript(script: string): string;
}
```

## 原稿生成の実行モード

このノードは以下の2つのモードで動作します：

### モード1: プロンプト改修ノードからの入力（通常）
- prompts.jsonからscriptPromptを読み込み
- 最適化されたプロンプトで原稿を生成

### モード2: デフォルトプロンプト（MVP/スタンドアロン）
- prompts.jsonが存在しない場合
- research.jsonとstrategy.jsonから基本情報を取得
- デフォルトのプロンプトテンプレートを使用

## 実装詳細

### 0. プロンプトの準備

```typescript
async prepareScriptPrompt(input: NodeInput): Promise<string> {
  const promptsPath = path.join(input.workDir, 'prompts.json');
  
  // Try to load from prompts.json (from Prompt Refinement Node)
  if (await this.fileExists(promptsPath)) {
    logger.info('Loading script prompt from prompts.json');
    const promptsContent = await fs.readFile(promptsPath, 'utf-8');
    const prompts = JSON.parse(promptsContent);
    
    // Replace research data placeholder
    const researchContext = await this.loadResearchContext(input.workDir);
    return prompts.scriptPrompt.replace('{{RESEARCH_DATA}}', researchContext);
  }
  
  // Fallback: Generate default prompt
  logger.info('prompts.json not found, generating default script prompt');
  return await this.generateDefaultPrompt(input);
}

private async generateDefaultPrompt(input: NodeInput): Promise<string> {
  const config = this.getConfig();
  
  // Load research data
  const researchContext = await this.loadResearchContext(input.workDir);
  
  // Try to load strategy.json for context
  let theme = config.defaultTheme || 'technology tutorial';
  let tone = config.defaultTone || 'professional';
  let targetAudience = config.defaultAudience || 'general audience';
  
  const strategyPath = path.join(input.workDir, 'strategy.json');
  if (await this.fileExists(strategyPath)) {
    const strategyContent = await fs.readFile(strategyPath, 'utf-8');
    const strategy = JSON.parse(strategyContent);
    theme = strategy.contentTheme || theme;
    tone = strategy.tone || tone;
    targetAudience = strategy.targetAudience || targetAudience;
  }
  
  return this.buildDefaultPrompt(theme, tone, targetAudience, researchContext);
}

private async loadResearchContext(workDir: string): Promise<string> {
  const researchPath = path.join(workDir, 'research.json');
  
  if (await this.fileExists(researchPath)) {
    const researchContent = await fs.readFile(researchPath, 'utf-8');
    const research = JSON.parse(researchContent);
    return this.formatResearchContext(research);
  }
  
  return 'リサーチデータが利用できません。一般的な知識に基づいて原稿を作成してください。';
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

### 1. Claude CLI Execution

```typescript
async executeClaudeCLI(prompt: string, context: string): Promise<string> {
  const config = this.getConfig();
  const command = config.claudeCommand || 'claude';
  
  // Combine prompt with research context
  const fullPrompt = prompt.replace('{{RESEARCH_DATA}}', context);
  
  // Write prompt to temp file (Claude CLI may accept file input)
  const tempFile = path.join(os.tmpdir(), `prompt-${Date.now()}.txt`);
  await fs.writeFile(tempFile, fullPrompt, 'utf-8');
  
  logger.debug(`Executing Claude CLI: ${command}`);
  
  try {
    return new Promise((resolve, reject) => {
      const process = spawn(command, ['-f', tempFile], {
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
        // Clean up temp file
        fs.unlink(tempFile).catch(() => {});
        
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude CLI failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        fs.unlink(tempFile).catch(() => {});
        reject(new Error(`Failed to execute Claude CLI: ${error.message}`));
      });
    });
  } catch (error) {
    // Ensure temp file cleanup
    await fs.unlink(tempFile).catch(() => {});
    throw error;
  }
}
```

### 2. Script Validation

```typescript
validateScriptLength(script: string): boolean {
  const config = this.getConfig();
  const minLength = config.minLength || 500;
  const maxLength = config.maxLength || 3000;
  
  const length = script.length;
  
  if (length < minLength) {
    logger.warn(`Script too short: ${length} characters (min: ${minLength})`);
    return false;
  }
  
  if (length > maxLength) {
    logger.warn(`Script too long: ${length} characters (max: ${maxLength})`);
    return false;
  }
  
  return true;
}
```

### 3. Script Formatting

```typescript
formatScript(script: string): string {
  // Remove markdown formatting if present
  let formatted = script
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1'); // Remove code blocks
  
  // Normalize line breaks
  formatted = formatted
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive line breaks
    .trim();
  
  // Ensure proper spacing for readability
  formatted = formatted
    .split('\n\n')
    .map(para => para.replace(/\s+/g, ' ').trim())
    .join('\n\n');
  
  return formatted;
}
```

### 4. デフォルトプロンプトの構築

```typescript
private buildDefaultPrompt(
  theme: string,
  tone: string,
  targetAudience: string,
  researchContext: string
): string {
  const config = this.getConfig();
  
  // 固定部分（普遍）- システムが保証する基本構造
  const fixedPrefix = config.promptTemplate?.fixedPrefix || 
    '以下の条件で動画用の原稿を作成してください：';
  
  const fixedSuffix = config.promptTemplate?.fixedSuffix || 
    this.buildDefaultStructureInstructions(config);
  
  // 可変部分（カスタマイズ可能）
  const toneDescription = config.promptTemplate?.toneDescriptions?.[tone] || 
    this.getDefaultToneDescription(tone);
  
  const customConstraints = config.promptTemplate?.customConstraints || [
    '読み上げに適した自然な日本語で記述',
    '専門用語は必要に応じて簡単に説明'
  ];
  
  const customInstructions = config.promptTemplate?.customInstructions || '';
  
  const minLength = config.minLength || 500;
  const maxLength = config.maxLength || 3000;
  
  // プロンプト組み立て
  return `
${fixedPrefix}

【基本情報】
テーマ: ${theme}
ターゲット: ${targetAudience}

【トーンとスタイル】
${toneDescription}

【制約事項】
- 文字数: ${minLength}〜${maxLength}文字
${customConstraints.map(c => `- ${c}`).join('\n')}

${customInstructions ? `【追加指示】\n${customInstructions}\n` : ''}
【リサーチデータ】
${researchContext}

${fixedSuffix}
`.trim();
}

private getDefaultToneDescription(tone: string): string {
  const descriptions = {
    'enthusiastic': '熱意を持って、エネルギッシュに。視聴者を鼓舞するような表現を使用。',
    'professional': '専門的で信頼性の高い表現。落ち着いた丁寧な言葉遣い。',
    'casual': 'フレンドリーで親しみやすい表現。会話調で自然な語り口。',
    'neutral': '中立的で客観的な表現。バランスの取れた語り口。'
  };
  
  return descriptions[tone] || descriptions['neutral'];
}

private buildDefaultStructureInstructions(config: any): string {
  const structure = config.structure || this.getDefaultStructure();
  const targetDuration = structure.targetDuration || 75;
  
  // Calculate durations
  const openingDuration = Math.round(targetDuration * structure.opening.ratio);
  const topicsDuration = Math.round(targetDuration * structure.topics.ratio);
  const topicCount = structure.topics.count || 3;
  const perTopicDuration = Math.round(topicsDuration / topicCount);
  const closingDuration = Math.round(targetDuration * structure.closing.ratio);
  
  let instructions = `【構成】（目標: ${targetDuration}秒）\n`;
  instructions += `1. オープニング（約${openingDuration}秒）\n`;
  instructions += `   - ${structure.opening.description || '挨拶と今日のテーマ紹介'}\n\n`;
  
  for (let i = 1; i <= topicCount; i++) {
    instructions += `${i + 1}. トピック${i}（約${perTopicDuration}秒）\n`;
    instructions += `   - ${structure.topics.description || 'ニュースの紹介と要点'}\n\n`;
  }
  
  instructions += `${topicCount + 2}. クロージング（約${closingDuration}秒）\n`;
  instructions += `   - ${structure.closing.description || 'まとめと締めの挨拶'}\n\n`;
  instructions += `上記を踏まえて、視聴者に価値を提供する原稿を作成してください。`;
  
  return instructions;
}

private getDefaultStructure(): any {
  return {
    targetDuration: 75,  // 75秒（1分15秒）
    opening: {
      ratio: 0.07,      // 5秒
      description: '挨拶と今日のテーマ紹介'
    },
    topics: {
      count: 3,         // 3トピック
      maxCount: 4,
      ratio: 0.80,      // 60秒
      description: '各AIニュースの紹介と要点'
    },
    closing: {
      ratio: 0.13,      // 10秒
      description: 'まとめと締めの挨拶'
    }
  };
}
```

### 5. Execute Method

```typescript
async execute(input: NodeInput): Promise<NodeOutput> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting Script Generation Node');
    
    // Prepare script prompt (with fallback to default)
    const scriptPrompt = await this.prepareScriptPrompt(input);
    logger.debug(`Script prompt: ${scriptPrompt.substring(0, 100)}...`);
    
    // Execute Claude CLI with retry
    const config = this.getConfig();
    const rawScript = await this.retryWithBackoff(
      () => this.executeClaudeCLI(scriptPrompt, ''),
      config.retryCount || 3,
      config.retryDelay || 5000
    );
    
    // Format script
    const script = this.formatScript(rawScript);
    
    // Validate length
    if (!this.validateScriptLength(script)) {
      logger.warn(`Script length validation failed: ${script.length} characters`);
      // Try to adjust if possible
      const adjustedScript = this.adjustScriptLength(script, config.minLength, config.maxLength);
      if (!this.validateScriptLength(adjustedScript)) {
        throw new Error(`Script length validation failed after adjustment: ${adjustedScript.length} characters`);
      }
      logger.info('Script length adjusted successfully');
      return this.createOutput(adjustedScript, input.workDir, startTime);
    }
    
    return this.createOutput(script, input.workDir, startTime);
    
  } catch (error) {
    logger.error(`Script Generation Node failed: ${error.message}`);
    throw new PipelineError(
      ErrorType.CLI_EXECUTION_ERROR,
      'ScriptGenerationNode',
      error.message,
      error
    );
  }
}

private async createOutput(script: string, workDir: string, startTime: number): Promise<NodeOutput> {
  // Save output
  const outputPath = path.join(workDir, 'script.txt');
  await fs.writeFile(outputPath, script, 'utf-8');
  
  logger.info(`Script Generation Node completed: ${script.length} characters`);
  
  return {
    success: true,
    data: { script, length: script.length },
    outputPath,
    metadata: {
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }
  };
}

private adjustScriptLength(script: string, minLength: number, maxLength: number): string {
  if (script.length < minLength) {
    logger.warn('Script too short, cannot auto-adjust');
    return script;
  }
  
  if (script.length > maxLength) {
    logger.info(`Truncating script from ${script.length} to ${maxLength} characters`);
    // Try to cut at sentence boundary
    const truncated = script.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('。');
    if (lastPeriod > minLength) {
      return truncated.substring(0, lastPeriod + 1);
    }
    return truncated;
  }
  
  return script;
}

private formatResearchContext(research: ResearchData): string {
  return research.results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
    .join('\n\n');
}
```

## Claude CLI仕様

### コマンド形式

```bash
claude -f <prompt_file>
```

または

```bash
echo "<prompt>" | claude
```

### 期待される出力

プレーンテキスト形式の原稿（マークダウン形式も許容）

## 原稿品質基準

### 構成

1. **オープニング（10-15%）**
   - 視聴者の興味を引く導入
   - 動画の目的を明確に提示

2. **メインコンテンツ（70-80%）**
   - リサーチデータに基づいた解説
   - 論理的な流れ
   - 具体例や事例の提示

3. **クロージング（10-15%）**
   - 要点のまとめ
   - 行動喚起（CTA）

### 文体

- 読み上げに適した自然な日本語
- 一文は短く（30-50文字程度）
- 専門用語は必要に応じて説明
- ユーザー指定のトーンを反映

## エラーハンドリング

- Claude CLIが見つからない場合：エラーをスローしてパイプラインを停止
- CLI実行がタイムアウトした場合：リトライ（最大3回）
- 原稿の長さが基準外の場合：エラーをスローしてパイプラインを停止
- 一時ファイルの削除に失敗した場合：警告をログに記録（処理は継続）

## 設定例

### 通常モード（プロンプト改修ノードと連携）

```json
{
  "scriptGeneration": {
    "enabled": true,
    "timeout": 300000,
    "retryCount": 3,
    "retryDelay": 5000,
    "claudeCommand": "claude",
    "minLength": 500,
    "maxLength": 3000
  }
}
```

### スタンドアロンモード（デフォルトプロンプト使用）

**基本設定:**
```json
{
  "scriptGeneration": {
    "enabled": true,
    "timeout": 300000,
    "retryCount": 3,
    "retryDelay": 5000,
    "claudeCommand": "claude",
    "minLength": 500,
    "maxLength": 3000,
    "defaultTheme": "TypeScriptの最新機能",
    "defaultTone": "professional",
    "defaultAudience": "中級エンジニア"
  }
}
```

**AIニュース向け設定（60〜90秒の短尺動画）:**
```json
{
  "scriptGeneration": {
    "enabled": true,
    "timeout": 300000,
    "retryCount": 3,
    "retryDelay": 5000,
    "claudeCommand": "claude",
    "minLength": 400,
    "maxLength": 600,
    "defaultTheme": "今日のAIニュース",
    "defaultTone": "professional",
    "defaultAudience": "AIに興味がある一般視聴者",
    "structure": {
      "targetDuration": 75,
      "opening": {
        "ratio": 0.07,
        "description": "挨拶と今日のAIニューストピック紹介"
      },
      "topics": {
        "count": 3,
        "maxCount": 4,
        "ratio": 0.80,
        "description": "各AIニュースの紹介（企業名、技術名、影響を簡潔に）"
      },
      "closing": {
        "ratio": 0.13,
        "description": "今日のまとめと明日への期待"
      }
    },
    "promptTemplate": {
      "customConstraints": [
        "読み上げに適した自然な日本語で記述",
        "企業名や技術名は正確に",
        "各ニュースは15〜20秒で完結",
        "テンポよく、簡潔に"
      ],
      "customInstructions": "ニュース番組のような簡潔で分かりやすい表現を心がけてください。"
    }
  }
}
```

**カスタマイズ設定（長尺チュートリアル向け）:**
```json
{
  "scriptGeneration": {
    "enabled": true,
    "timeout": 300000,
    "retryCount": 3,
    "retryDelay": 5000,
    "claudeCommand": "claude",
    "minLength": 1500,
    "maxLength": 2500,
    "defaultTheme": "TypeScriptの最新機能",
    "defaultTone": "casual",
    "defaultAudience": "初心者エンジニア",
    "structure": {
      "targetDuration": 300,
      "opening": {
        "ratio": 0.10,
        "description": "挨拶とテーマ紹介"
      },
      "topics": {
        "count": 1,
        "maxCount": 1,
        "ratio": 0.75,
        "description": "詳細な解説とデモ"
      },
      "closing": {
        "ratio": 0.15,
        "description": "まとめと次回予告"
      }
    },
    "promptTemplate": {
      "toneDescriptions": {
        "casual": "フレンドリーで親しみやすい表現。初心者にも分かりやすく、会話調で。"
      },
      "customConstraints": [
        "読み上げに適した自然な日本語で記述",
        "専門用語は必ず簡単に説明",
        "具体例を多く含める"
      ],
      "customInstructions": "初心者が躓きやすいポイントを重点的に解説してください。"
    }
  }
}
```

## プロンプトテンプレート構造

### 固定部分（普遍・変更不可）

システムが保証する基本構造。これらは変更できません：

**fixedPrefix（固定プレフィックス）:**
```
以下の条件で動画用の原稿を作成してください：
```

**fixedSuffix（固定サフィックス）:**
```
【構成】
1. オープニング（興味を引く導入）
2. メインコンテンツ（リサーチ結果を基にした解説）
3. クロージング（まとめと行動喚起）

上記を踏まえて、視聴者に価値を提供する原稿を作成してください。
```

### 可変部分（カスタマイズ可能）

ユーザーが自由に変更できる部分：

**toneDescriptions（トーン別の説明）:**
```json
{
  "enthusiastic": "熱意を持って、エネルギッシュに。視聴者を鼓舞するような表現を使用。",
  "professional": "専門的で信頼性の高い表現。落ち着いた丁寧な言葉遣い。",
  "casual": "フレンドリーで親しみやすい表現。会話調で自然な語り口。"
}
```

**customConstraints（カスタム制約）:**
```json
[
  "読み上げに適した自然な日本語で記述",
  "専門用語は必要に応じて簡単に説明"
]
```

**customInstructions（追加指示）:**
```
初心者が躓きやすいポイントを重点的に解説してください。
```

### 完成形のプロンプト例（AIニュース向け）

```
以下の条件で動画用の原稿を作成してください：

【基本情報】
テーマ: 今日のAIニュース
ターゲット: AIに興味がある一般視聴者

【トーンとスタイル】
専門的で信頼性の高い表現。落ち着いた丁寧な言葉遣い。

【制約事項】
- 文字数: 400〜600文字
- 読み上げに適した自然な日本語で記述
- 企業名や技術名は正確に
- 各ニュースは15〜20秒で完結
- テンポよく、簡潔に

【追加指示】
ニュース番組のような簡潔で分かりやすい表現を心がけてください。

【リサーチデータ】
[1] OpenAI、GPT-4 Turboを発表
OpenAIは本日、GPT-4 Turboを発表しました。128Kトークンのコンテキストウィンドウを持ち...

[2] Google、Gemini Proを一般公開
Googleは新しいマルチモーダルAI「Gemini Pro」を一般公開しました...

[3] Anthropic、Claude 2.1をリリース
Anthropicは200Kトークンのコンテキストウィンドウを持つClaude 2.1を...

【構成】（目標: 75秒）
1. オープニング（約5秒）
   - 挨拶と今日のAIニューストピック紹介

2. トピック1（約20秒）
   - 各AIニュースの紹介（企業名、技術名、影響を簡潔に）

3. トピック2（約20秒）
   - 各AIニュースの紹介（企業名、技術名、影響を簡潔に）

4. トピック3（約20秒）
   - 各AIニュースの紹介（企業名、技術名、影響を簡潔に）

5. クロージング（約10秒）
   - 今日のまとめと明日への期待

上記を踏まえて、視聴者に価値を提供する原稿を作成してください。
```

## 実行フロー図

```
開始
  ↓
prompts.json存在確認
  ├─ 存在する → scriptPromptを読み込み → リサーチデータ置換
  └─ 存在しない → デフォルトプロンプト生成
      ├─ research.json読み込み
      ├─ strategy.json確認
      │   ├─ 存在する → テーマ、トーン、ターゲットを取得
      │   └─ 存在しない → 設定のデフォルト値を使用
      └─ プロンプトテンプレートに適用
  ↓
Claude CLI実行（リトライあり）
  ↓
原稿フォーマット（マークダウン除去等）
  ↓
長さ検証
  ├─ OK → 保存
  └─ NG → 長さ調整 → 再検証
      ├─ OK → 保存
      └─ NG → エラー
  ↓
script.txt保存
  ↓
完了
```

## エラーハンドリング

- Claude CLIが見つからない場合：エラーをスローしてパイプラインを停止
- CLI実行がタイムアウトした場合：リトライ（最大3回）
- 原稿の長さが基準外の場合：自動調整を試行、失敗時はエラー
- 一時ファイルの削除に失敗した場合：警告をログに記録（処理は継続）
- prompts.jsonが見つからない場合：デフォルトプロンプトを生成（警告をログに記録）
- research.jsonが見つからない場合：プレースホルダーメッセージを使用

## テスト観点

### 基本機能
- Claude CLI実行の成功
- プロンプトとリサーチデータの正しい結合
- 原稿長さ検証の動作確認
- マークダウン除去の正確性
- フォーマット処理の妥当性
- リトライロジックの動作確認
- 一時ファイルのクリーンアップ確認

### プロンプト準備
- prompts.jsonからの正常読み込み
- prompts.json不在時のデフォルトプロンプト生成
- strategy.jsonからのテーマ・トーン・ターゲット取得
- research.jsonからのコンテキスト読み込み
- 設定のデフォルト値の使用
- デフォルトプロンプトテンプレートの正確性

### 長さ調整
- 長すぎる原稿の自動トリミング
- 文の途中で切らない処理
- 短すぎる原稿の検出

### プロンプトテンプレート
- 固定部分の保護
- 可変部分のカスタマイズ
- トーン別説明の適用
- カスタム制約の反映
