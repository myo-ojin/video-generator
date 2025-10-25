# Prompt Refinement Node - 詳細設計

## 要件 (requirements.mdより)

このノードは以下の要件を満たす必要があります：

### 要件3

**ユーザーストーリー:** コンテンツクリエイターとして、プロンプト改修ノードが戦略に基づいてプロンプトを最適化することで、後続のノードが高品質な指示を受け取れるようにしたい。

#### 受入基準

1. プロンプト改修ノードは、戦略分析ノードから戦略データを受け取ること
2. プロンプト改修ノードは、リサーチノードと原稿生成ノード用の最適化されたプロンプトを生成すること
3. プロンプト改修ノードは、CLIツールで利用可能な構造化形式でプロンプトを出力すること
4. プロンプト改修ノードは、2分以内に実行を完了すること

### 関連要件

- 要件1.2: ノードが正常に完了したとき、システムは出力データをパイプライン内の次のノードに渡すこと
- 要件12.1: システムは、各ノード実行の開始時刻と完了時刻をログに記録すること

## 概要

プロンプト改修ノードは、戦略データを基に、リサーチノードと原稿生成ノード用の最適化されたプロンプトを生成します。

## 入力

- strategy.json

## 出力

- prompts.json

## インターフェース

```typescript
interface PromptRefinementNode extends Node {
  generateResearchPrompt(strategy: StrategyData): string;
  generateScriptPrompt(strategy: StrategyData): string;
}

interface PromptsData {
  researchPrompt: string;
  scriptPrompt: string;
  metadata: {
    strategy: StrategyData;
  };
}
```

## 実装詳細

### 1. Research Prompt Generation

```typescript
generateResearchPrompt(strategy: StrategyData): string {
  const keywords = strategy.keywords.join(', ');
  const avoidWords = strategy.userGuidelines.prohibitedWords.join(', ');
  
  return `
以下のテーマについて最新の情報をリサーチしてください：

テーマ: ${strategy.contentTheme}
キーワード: ${keywords}
ターゲット: ${strategy.targetAudience}

リサーチ要件：
- 最新のトレンドや動向
- 実用的な情報や事例
- 信頼できる情報源からのデータ
${avoidWords ? `- 以下の用語は避けてください: ${avoidWords}` : ''}

出力形式：
- 各情報源のタイトルと要約
- 重要なポイントのリスト
- 参考URL（可能な場合）
`.trim();
}
```

### 2. Script Prompt Generation

```typescript
generateScriptPrompt(strategy: StrategyData): string {
  const tone = this.getToneDescription(strategy.tone);
  const values = strategy.userGuidelines.values.join('、');
  const prohibitedWords = strategy.userGuidelines.prohibitedWords.join('、');
  const length = this.getLengthGuideline(strategy);
  
  return `
以下の条件で動画用の原稿を作成してください：

【基本情報】
タイトル: ${strategy.suggestedTitle}
テーマ: ${strategy.contentTheme}
ターゲット: ${strategy.targetAudience}

【トーンとスタイル】
${tone}

【価値観】
以下の価値観を反映してください: ${values}

【制約事項】
- 文字数: ${length.min}〜${length.max}文字
- 使用禁止ワード: ${prohibitedWords}
- 読み上げに適した自然な日本語で記述
- 専門用語は必要に応じて簡単に説明

【構成】
1. オープニング（興味を引く導入）
2. メインコンテンツ（リサーチ結果を基にした解説）
3. クロージング（まとめと行動喚起）

【リサーチデータ】
{{RESEARCH_DATA}}

上記を踏まえて、視聴者に価値を提供する原稿を作成してください。
`.trim();
}

private getToneDescription(tone: string): string {
  const descriptions = {
    'enthusiastic': '熱意を持って、エネルギッシュに。視聴者を鼓舞するような表現を使用。',
    'professional': '専門的で信頼性の高い表現。落ち着いた丁寧な言葉遣い。',
    'casual': 'フレンドリーで親しみやすい表現。会話調で自然な語り口。',
    'neutral': '中立的で客観的な表現。バランスの取れた語り口。'
  };
  
  return descriptions[tone] || descriptions['neutral'];
}

private getLengthGuideline(strategy: StrategyData): { min: number; max: number } {
  // Default from config, can be overridden
  return { min: 500, max: 3000 };
}
```

### 3. Execute Method

```typescript
async execute(input: NodeInput): Promise<NodeOutput> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting Prompt Refinement Node');
    
    // Load strategy data
    const strategyPath = input.previousOutput?.outputPath || 
                        path.join(input.workDir, 'strategy.json');
    const strategyContent = await fs.readFile(strategyPath, 'utf-8');
    const strategy: StrategyData = JSON.parse(strategyContent);
    
    // Generate prompts
    const researchPrompt = this.generateResearchPrompt(strategy);
    const scriptPrompt = this.generateScriptPrompt(strategy);
    
    const prompts: PromptsData = {
      researchPrompt,
      scriptPrompt,
      metadata: { strategy }
    };
    
    // Save output
    const outputPath = path.join(input.workDir, 'prompts.json');
    await fs.writeFile(outputPath, JSON.stringify(prompts, null, 2), 'utf-8');
    
    logger.info('Prompt Refinement Node completed successfully');
    
    return {
      success: true,
      data: prompts,
      outputPath,
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error(`Prompt Refinement Node failed: ${error.message}`);
    throw new PipelineError(
      ErrorType.VALIDATION_ERROR,
      'PromptRefinementNode',
      error.message,
      error
    );
  }
}
```

## プロンプトテンプレート設計

### トーン別表現ガイドライン

| トーン | 特徴 | 例 |
|--------|------|-----|
| enthusiastic | 熱意、エネルギッシュ | 「これは本当にすごいんです！」 |
| professional | 専門的、信頼性 | 「データに基づいて解説します」 |
| casual | フレンドリー、親しみ | 「簡単に説明しますね」 |
| neutral | 中立的、客観的 | 「以下の点について説明します」 |

## エラーハンドリング

- strategy.jsonが見つからない場合：エラーをスローしてパイプラインを停止
- 戦略データが不完全な場合：デフォルト値で補完し、警告をログに記録

## テスト観点

- 戦略データの正しい読み込み
- リサーチプロンプトへの戦略反映
- 原稿プロンプトへのトーン・価値観の反映
- 禁止ワードの正しい伝達
- プロンプト出力形式の妥当性
