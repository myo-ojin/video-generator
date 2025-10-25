# Video Composition Node - 詳細設計

## 要件 (requirements.mdより)

このノードは以下の要件を満たす必要があります：

### 要件8

**ユーザーストーリー:** コンテンツクリエイターとして、動画合成ノードがFFmpegを使用して音声と字幕を結合することで、アップロード準備が整った完全な動画ファイルを得られるようにしたい。

#### 受入基準

1. 動画合成ノードは、FFmpegを実行して音声、字幕、オプションの背景動画または画像を結合すること
2. 動画合成ノードは、H.264コーデックを使用したMP4形式で動画を出力すること
3. 動画合成ノードは、出力動画の解像度が最低1280x720ピクセルであることを保証すること
4. 動画合成ノードは、字幕を動画に埋め込むか、別トラックとして含めること
5. 動画合成ノードは、10分以内に動画合成を完了すること

### 関連要件

- 要件1.2: ノードが正常に完了したとき、システムは出力データをパイプライン内の次のノードに渡すこと
- 要件1.3: ノードが実行中に失敗した場合、システムはエラー詳細をログに記録し、パイプラインを停止すること
- 要件11.2: システムは、CLIコマンドパスと処理パラメータの設定を許可すること
- 要件12.2: システムは、すべてのCLIコマンド呼び出しとその引数をログに記録すること

## 概要

動画合成ノードは、FFmpegを使用して音声、字幕、背景を合成し、最終的な動画ファイルを生成します。

## 入力

- audio.wav
- subtitles.srt
- Optional: background images/video

## 出力

- video.mp4

## インターフェース

```typescript
interface VideoCompositionNode extends Node {
  buildFFmpegCommand(audioPath: string, subtitlePath: string, outputPath: string, config: VideoConfig): string[];
  executeFFmpeg(audioPath: string, subtitlePath: string, config: VideoConfig): Promise<string>;
  validateVideoOutput(videoPath: string): Promise<boolean>;
}

interface VideoConfig {
  resolution: string; // "1280x720", "1920x1080"
  fps: number;
  codec: string; // "libx264"
  backgroundImage?: string;
  backgroundVideo?: string;
}
```

## 実装詳細

### 1. FFmpeg Command Construction

```typescript
buildFFmpegCommand(
  audioPath: string,
  subtitlePath: string,
  outputPath: string,
  config: VideoConfig
): string[] {
  const args: string[] = [];
  
  // Input: background (image or video)
  if (config.backgroundVideo) {
    args.push('-i', config.backgroundVideo);
  } else if (config.backgroundImage) {
    // Create video from static image
    args.push('-loop', '1', '-i', config.backgroundImage);
  } else {
    // Create solid color background
    args.push(
      '-f', 'lavfi',
      '-i', `color=c=black:s=${config.resolution}:r=${config.fps}`
    );
  }
  
  // Input: audio
  args.push('-i', audioPath);
  
  // Get audio duration for video length
  args.push('-shortest');
  
  // Video codec and settings
  args.push(
    '-c:v', config.codec || 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p'
  );
  
  // Audio codec
  args.push('-c:a', 'aac', '-b:a', '192k');
  
  // Subtitle filter
  const subtitleFilter = `subtitles=${subtitlePath.replace(/\\/g, '/')}:force_style='FontSize=24,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Outline=2'`;
  args.push('-vf', subtitleFilter);
  
  // Resolution and framerate
  args.push('-s', config.resolution, '-r', String(config.fps));
  
  // Output
  args.push('-y', outputPath); // -y to overwrite
  
  return args;
}
```

### 2. FFmpeg Execution

```typescript
async executeFFmpeg(
  audioPath: string,
  subtitlePath: string,
  config: VideoConfig
): Promise<string> {
  const outputPath = path.join(path.dirname(audioPath), 'video.mp4');
  const command = config.ffmpegCommand || 'ffmpeg';
  const args = this.buildFFmpegCommand(audioPath, subtitlePath, outputPath, config);
  
  logger.debug(`Executing FFmpeg: ${command} ${args.join(' ')}`);
  
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      timeout: config.timeout,
      shell: true
    });
    
    let stderr = '';
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
      // FFmpeg outputs progress to stderr
      logger.debug(`FFmpeg: ${data.toString().trim()}`);
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (error) => {
      reject(new Error(`Failed to execute FFmpeg: ${error.message}`));
    });
  });
}
```

### 3. Video Validation

```typescript
async validateVideoOutput(videoPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(videoPath);
    
    if (stats.size === 0) {
      logger.error('Video file is empty');
      return false;
    }
    
    if (stats.size < 1024) {
      logger.warn('Video file is suspiciously small');
      return false;
    }
    
    logger.info(`Video file validated: ${stats.size} bytes`);
    return true;
  } catch (error) {
    logger.error(`Video validation failed: ${error.message}`);
    return false;
  }
}
```

### 4. Execute Method

```typescript
async execute(input: NodeInput): Promise<NodeOutput> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting Video Composition Node');
    
    // Get input paths
    const audioPath = path.join(input.workDir, 'audio.wav');
    const subtitlePath = path.join(input.workDir, 'subtitles.srt');
    
    // Prepare video config
    const config = this.getConfig();
    const videoConfig: VideoConfig = {
      resolution: config.resolution || '1280x720',
      fps: config.fps || 30,
      codec: config.codec || 'libx264',
      backgroundImage: config.backgroundImage,
      backgroundVideo: config.backgroundVideo
    };
    
    // Execute FFmpeg
    const outputPath = await this.executeFFmpeg(audioPath, subtitlePath, videoConfig);
    
    // Validate output
    const isValid = await this.validateVideoOutput(outputPath);
    if (!isValid) {
      throw new Error('Video output validation failed');
    }
    
    logger.info(`Video Composition Node completed: ${outputPath}`);
    
    return {
      success: true,
      data: { videoPath: outputPath, config: videoConfig },
      outputPath,
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error(`Video Composition Node failed: ${error.message}`);
    throw new PipelineError(
      ErrorType.CLI_EXECUTION_ERROR,
      'VideoCompositionNode',
      error.message,
      error
    );
  }
}
```

## FFmpegコマンド例

### 静止画背景 + 音声 + 字幕

```bash
ffmpeg -loop 1 -i background.jpg -i audio.wav \
  -shortest \
  -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -vf "subtitles=subtitles.srt:force_style='FontSize=24,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Outline=2'" \
  -s 1280x720 -r 30 \
  -y output.mp4
```

### 黒背景 + 音声 + 字幕

```bash
ffmpeg -f lavfi -i color=c=black:s=1280x720:r=30 -i audio.wav \
  -shortest \
  -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -vf "subtitles=subtitles.srt" \
  -y output.mp4
```

### 動画背景 + 音声 + 字幕

```bash
ffmpeg -i background.mp4 -i audio.wav \
  -shortest \
  -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -vf "subtitles=subtitles.srt" \
  -s 1280x720 -r 30 \
  -y output.mp4
```

## FFmpegパラメータ説明

### ビデオコーデック設定

- **-c:v libx264**: H.264コーデックを使用
- **-preset medium**: エンコード速度と品質のバランス（ultrafast, fast, medium, slow, veryslow）
- **-crf 23**: 品質設定（0-51、低いほど高品質、18-28が推奨）
- **-pix_fmt yuv420p**: ピクセルフォーマット（互換性のため）

### オーディオコーデック設定

- **-c:a aac**: AACコーデックを使用
- **-b:a 192k**: ビットレート192kbps

### 字幕設定

- **subtitles=**: 字幕ファイルのパス
- **force_style**: 字幕スタイルの強制適用
  - **FontSize**: フォントサイズ
  - **PrimaryColour**: 文字色（&HFFFFFF& = 白）
  - **OutlineColour**: 縁取り色（&H000000& = 黒）
  - **Outline**: 縁取りの太さ

## エラーハンドリング

- FFmpegが見つからない場合：エラーをスローしてパイプラインを停止
- 音声ファイルが見つからない場合：エラーをスローしてパイプラインを停止
- 字幕ファイルが見つからない場合：エラーをスローしてパイプラインを停止
- FFmpeg実行がタイムアウトした場合：エラーをスローしてパイプラインを停止
- 動画ファイルの検証に失敗した場合：エラーをスローしてパイプラインを停止

## テスト観点

- FFmpegコマンドの正しい構築
- 静止画背景での動画生成
- 黒背景での動画生成
- 動画背景での動画生成
- 字幕の正しい埋め込み
- 音声の正しい合成
- 解像度設定の反映
- 動画ファイルの検証
- エラーハンドリングの妥当性
