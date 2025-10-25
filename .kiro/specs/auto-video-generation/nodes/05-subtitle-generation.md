# Subtitle Generation Node - 詳細設計

## 要件 (requirements.mdより)

このノードは以下の要件を満たす必要があります：

### 要件6

**ユーザーストーリー:** コンテンツクリエイターとして、字幕生成ノードが原稿を字幕形式に変換することで、動画に適切なキャプションを付けられるようにしたい。

#### 受入基準

1. 字幕生成ノードは、原稿生成ノードから原稿を受け取ること
2. 字幕生成ノードは、原稿をSRTまたはVTT字幕形式に変換すること
3. 字幕生成ノードは、各字幕セグメントに適切なタイムスタンプを割り当てること
4. 字幕生成ノードは、字幕セグメントが2行または1行あたり42文字を超えないことを保証すること
5. 字幕生成ノードは、UTF-8エンコーディングで字幕ファイルを出力すること

### 関連要件

- 要件1.2: ノードが正常に完了したとき、システムは出力データをパイプライン内の次のノードに渡すこと
- 要件11.2: システムは、各ノードの処理パラメータの設定を許可すること
- 要件12.1: システムは、各ノード実行の開始時刻と完了時刻をログに記録すること

## 概要

字幕生成ノードは、原稿をSRT形式の字幕ファイルに変換します。適切なセグメント分割とタイムスタンプの割り当てを行います。

## 入力

- script.txt

## 出力

- subtitles.srt

## インターフェース

```typescript
interface SubtitleGenerationNode extends Node {
  splitIntoSegments(script: string): SubtitleSegment[];
  assignTimestamps(segments: SubtitleSegment[]): SubtitleSegment[];
  generateSRT(segments: SubtitleSegment[]): string;
}

interface SubtitleSegment {
  index: number;
  startTime: string; // "00:00:01,000"
  endTime: string;
  text: string;
}
```

## 実装詳細

### 1. Script Segmentation

```typescript
splitIntoSegments(script: string): SubtitleSegment[] {
  const config = this.getConfig();
  const maxCharsPerLine = config.maxCharsPerLine || 42;
  const maxLines = config.maxLines || 2;
  const maxCharsPerSegment = maxCharsPerLine * maxLines;
  
  // Split by sentences first
  const sentences = script
    .split(/([。！？\n])/g)
    .reduce((acc, part, i, arr) => {
      if (i % 2 === 0 && part.trim()) {
        const sentence = part + (arr[i + 1] || '');
        acc.push(sentence.trim());
      }
      return acc;
    }, [] as string[]);
  
  const segments: SubtitleSegment[] = [];
  let currentSegment = '';
  let index = 1;
  
  for (const sentence of sentences) {
    // If adding this sentence exceeds limit, save current segment
    if (currentSegment && (currentSegment + sentence).length > maxCharsPerSegment) {
      segments.push({
        index: index++,
        startTime: '',
        endTime: '',
        text: this.formatSegmentText(currentSegment, maxCharsPerLine)
      });
      currentSegment = sentence;
    } else {
      currentSegment += (currentSegment ? '' : '') + sentence;
    }
  }
  
  // Add remaining segment
  if (currentSegment) {
    segments.push({
      index: index++,
      startTime: '',
      endTime: '',
      text: this.formatSegmentText(currentSegment, maxCharsPerLine)
    });
  }
  
  return segments;
}

private formatSegmentText(text: string, maxCharsPerLine: number): string {
  // Split into lines if needed
  if (text.length <= maxCharsPerLine) {
    return text;
  }
  
  // Try to split at natural break points
  const words = text.split('');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const char of words) {
    if (currentLine.length >= maxCharsPerLine && this.isBreakPoint(char)) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine += char;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  
  return lines.slice(0, 2).join('\n'); // Max 2 lines
}

private isBreakPoint(char: string): boolean {
  return /[、。，,\s]/.test(char);
}
```

### 2. Timestamp Assignment

```typescript
assignTimestamps(segments: SubtitleSegment[]): SubtitleSegment[] {
  // Estimate reading speed: ~350 characters per minute for Japanese (adjusted for VOICEVOX)
  // This should match the actual voice synthesis speed setting
  const config = this.getConfig();
  const charsPerSecond = config.charsPerSecond || 5.8; // ~350 chars/min
  const minDuration = 2; // seconds
  const maxDuration = 7; // seconds
  
  let currentTime = 0;
  
  return segments.map(segment => {
    const charCount = segment.text.replace(/\n/g, '').length;
    let duration = Math.max(minDuration, charCount / charsPerSecond);
    duration = Math.min(maxDuration, duration);
    
    const startTime = this.formatTimestamp(currentTime);
    currentTime += duration;
    const endTime = this.formatTimestamp(currentTime);
    
    return {
      ...segment,
      startTime,
      endTime
    };
  });
}

private formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}
```

### 3. SRT Generation

```typescript
generateSRT(segments: SubtitleSegment[]): string {
  return segments
    .map(segment => {
      return `${segment.index}\n${segment.startTime} --> ${segment.endTime}\n${segment.text}\n`;
    })
    .join('\n');
}
```

### 4. Execute Method

```typescript
async execute(input: NodeInput): Promise<NodeOutput> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting Subtitle Generation Node');
    
    // Load script
    const scriptPath = input.previousOutput?.outputPath || 
                      path.join(input.workDir, 'script.txt');
    const script = await fs.readFile(scriptPath, 'utf-8');
    
    // Split into segments
    let segments = this.splitIntoSegments(script);
    
    // Assign timestamps
    segments = this.assignTimestamps(segments);
    
    // Generate SRT
    const srt = this.generateSRT(segments);
    
    // Save output
    const outputPath = path.join(input.workDir, 'subtitles.srt');
    await fs.writeFile(outputPath, srt, 'utf-8');
    
    logger.info(`Subtitle Generation Node completed: ${segments.length} segments`);
    
    return {
      success: true,
      data: { segments, count: segments.length },
      outputPath,
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error(`Subtitle Generation Node failed: ${error.message}`);
    throw new PipelineError(
      ErrorType.VALIDATION_ERROR,
      'SubtitleGenerationNode',
      error.message,
      error
    );
  }
}
```

## SRT形式仕様

```
1
00:00:01,000 --> 00:00:04,500
最初の字幕テキスト

2
00:00:04,500 --> 00:00:08,000
2番目の字幕テキスト
2行目も可能

3
00:00:08,000 --> 00:00:12,000
3番目の字幕テキスト
```

## 字幕セグメント分割ルール

### 基本ルール

- 1セグメント最大2行
- 1行最大42文字
- 文の途中で分割しない（可能な限り）
- 句読点で自然に分割

### 分割優先順位

1. 句点（。）
2. 感嘆符・疑問符（！？）
3. 読点（、）
4. スペース

### タイムスタンプ計算

- 読み上げ速度：約350文字/分（5.8文字/秒）※VOICEVOX速度設定に合わせて調整可能
- 最小表示時間：2秒
- 最大表示時間：7秒
- 文字数に応じて動的に調整

## エラーハンドリング

- 原稿ファイルが見つからない場合：エラーをスローしてパイプラインを停止
- 原稿が空の場合：エラーをスローしてパイプラインを停止
- セグメント分割に失敗した場合：エラーをスローしてパイプラインを停止

## テスト観点

- 文章の正しいセグメント分割
- 文字数制限の遵守（42文字/行、2行/セグメント）
- タイムスタンプの正確な計算
- SRT形式の正しい生成
- UTF-8エンコーディングの確認
- 句読点での自然な分割
