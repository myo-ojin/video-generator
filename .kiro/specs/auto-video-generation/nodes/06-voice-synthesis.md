# Voice Synthesis Node - 詳細設計

## 要件 (requirements.mdより)

このノードは以下の要件を満たす必要があります：

### 要件7

**ユーザーストーリー:** コンテンツクリエイターとして、音声合成ノードがVOICEVOXを使用して音声を生成することで、動画に自然な音声ナレーションを付けられるようにしたい。

#### 受入基準

1. 音声合成ノードは、原稿テキストを入力としてVOICEVOXを実行すること
2. 音声合成ノードは、WAVまたはMP3形式で音声出力を生成すること
3. 音声合成ノードは、音声キャラクターと音声パラメータの設定を許可すること
4. 音声合成ノードは、5分以内に音声生成を完了すること
5. VOICEVOXが利用できない場合、音声合成ノードはエラーを報告し、パイプラインを停止すること

### 関連要件

- 要件1.2: ノードが正常に完了したとき、システムは出力データをパイプライン内の次のノードに渡すこと
- 要件1.3: ノードが実行中に失敗した場合、システムはエラー詳細をログに記録し、パイプラインを停止すること
- 要件11.2: システムは、各ノードの処理パラメータの設定を許可すること
- 要件12.1: システムは、各ノード実行の開始時刻と完了時刻をログに記録すること

## 概要

音声合成ノードは、VOICEVOXを使用して原稿を音声ファイルに変換します。

## 入力

- script.txt

## 出力

- audio.wav

## インターフェース

```typescript
interface VoiceSynthesisNode extends Node {
  executeVOICEVOX(script: string, voiceConfig: VoiceConfig): Promise<Buffer>;
  saveAudioFile(audio: Buffer, path: string): Promise<void>;
  checkVOICEVOXAvailability(): Promise<boolean>;
}

interface VoiceConfig {
  speaker: number; // VOICEVOX speaker ID
  speed: number; // 0.5 - 2.0
  pitch: number; // -0.15 - 0.15
  intonation: number; // 0.0 - 2.0
}
```

## 実装詳細

### 1. VOICEVOX API Integration

```typescript
async executeVOICEVOX(script: string, voiceConfig: VoiceConfig): Promise<Buffer> {
  const config = this.getConfig();
  const host = config.voicevoxHost || 'http://localhost:50021';
  
  // Step 1: Create audio query
  const queryResponse = await fetch(
    `${host}/audio_query?text=${encodeURIComponent(script)}&speaker=${voiceConfig.speaker}`,
    { method: 'POST' }
  );
  
  if (!queryResponse.ok) {
    throw new Error(`VOICEVOX audio_query failed: ${queryResponse.statusText}`);
  }
  
  const audioQuery = await queryResponse.json();
  
  // Step 2: Apply voice parameters
  audioQuery.speedScale = voiceConfig.speed;
  audioQuery.pitchScale = voiceConfig.pitch;
  audioQuery.intonationScale = voiceConfig.intonation;
  
  // Step 3: Synthesize audio
  const synthesisResponse = await fetch(
    `${host}/synthesis?speaker=${voiceConfig.speaker}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(audioQuery)
    }
  );
  
  if (!synthesisResponse.ok) {
    throw new Error(`VOICEVOX synthesis failed: ${synthesisResponse.statusText}`);
  }
  
  const arrayBuffer = await synthesisResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
```

### 2. VOICEVOX Availability Check

```typescript
async checkVOICEVOXAvailability(): Promise<boolean> {
  const config = this.getConfig();
  const host = config.voicevoxHost || 'http://localhost:50021';
  
  try {
    const response = await fetch(`${host}/version`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch (error) {
    logger.error(`VOICEVOX is not available at ${host}: ${error.message}`);
    return false;
  }
}
```

### 3. Audio File Saving

```typescript
async saveAudioFile(audio: Buffer, filePath: string): Promise<void> {
  await fs.writeFile(filePath, audio);
  logger.debug(`Audio file saved: ${filePath} (${audio.length} bytes)`);
}
```

### 4. Execute Method

```typescript
async execute(input: NodeInput): Promise<NodeOutput> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting Voice Synthesis Node');
    
    // Check VOICEVOX availability
    const isAvailable = await this.checkVOICEVOXAvailability();
    if (!isAvailable) {
      throw new Error('VOICEVOX is not available. Please ensure VOICEVOX is running.');
    }
    
    // Load script
    const scriptPath = input.previousOutput?.outputPath || 
                      path.join(input.workDir, 'script.txt');
    const script = await fs.readFile(scriptPath, 'utf-8');
    
    // Prepare voice config
    const config = this.getConfig();
    const voiceConfig: VoiceConfig = {
      speaker: config.speaker || 1,
      speed: config.speed || 1.0,
      pitch: config.pitch || 0.0,
      intonation: config.intonation || 1.0
    };
    
    logger.info(`Voice config: speaker=${voiceConfig.speaker}, speed=${voiceConfig.speed}`);
    
    // Synthesize audio
    const audioBuffer = await this.executeVOICEVOX(script, voiceConfig);
    
    // Save audio file
    const outputPath = path.join(input.workDir, 'audio.wav');
    await this.saveAudioFile(audioBuffer, outputPath);
    
    logger.info(`Voice Synthesis Node completed: ${audioBuffer.length} bytes`);
    
    return {
      success: true,
      data: { audioSize: audioBuffer.length, voiceConfig },
      outputPath,
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error(`Voice Synthesis Node failed: ${error.message}`);
    throw new PipelineError(
      ErrorType.API_ERROR,
      'VoiceSynthesisNode',
      error.message,
      error
    );
  }
}
```

## VOICEVOX API仕様

### エンドポイント

**1. バージョン確認**
```
GET http://localhost:50021/version
```

**2. 音声クエリ作成**
```
POST http://localhost:50021/audio_query?text={text}&speaker={speaker_id}
```

**3. 音声合成**
```
POST http://localhost:50021/synthesis?speaker={speaker_id}
Content-Type: application/json

{
  "speedScale": 1.0,
  "pitchScale": 0.0,
  "intonationScale": 1.0,
  ...
}
```

### Speaker ID一覧（例）

| ID | キャラクター | 特徴 |
|----|------------|------|
| 0 | 四国めたん（ノーマル） | 標準的な女性声 |
| 1 | ずんだもん（ノーマル） | 可愛らしい声 |
| 2 | 春日部つむぎ（ノーマル） | 落ち着いた女性声 |
| 3 | 雨晴はう（ノーマル） | 明るい女性声 |

### パラメータ範囲

- **speed**: 0.5〜2.0（1.0が標準）
- **pitch**: -0.15〜0.15（0.0が標準）
- **intonation**: 0.0〜2.0（1.0が標準）

## エラーハンドリング

- VOICEVOXが起動していない場合：エラーをスローしてパイプラインを停止
- audio_queryが失敗した場合：エラーをスローしてパイプラインを停止
- synthesisが失敗した場合：エラーをスローしてパイプラインを停止
- 原稿ファイルが見つからない場合：エラーをスローしてパイプラインを停止

## VOICEVOX起動確認

パイプライン実行前に以下を確認：

```bash
# VOICEVOXが起動しているか確認
curl http://localhost:50021/version
```

## テスト観点

- VOICEVOX可用性チェックの動作確認
- audio_query APIの正しい呼び出し
- synthesis APIの正しい呼び出し
- 音声パラメータの正しい適用
- WAVファイルの正しい保存
- エラーハンドリングの妥当性
- タイムアウト処理の確認
