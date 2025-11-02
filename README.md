# AI News Video Generator

自動動画生成パイプラインシステム - AIニュースを自動的にリサーチ、原稿作成、音声合成、動画生成、YouTube投稿まで行います。

## 概要

このシステムは、以下の6つのノードで構成されるパイプラインです：

1. **リサーチノード** - Codex CLIを使用してAIニュースを収集
2. **原稿生成ノード** - Claude CLIを使用して動画原稿を作成
3. **字幕生成ノード** - 原稿からSRT字幕を生成
4. **音声合成ノード** - VOICEVOXで音声を生成
5. **動画合成ノード** - FFmpegで動画を合成
6. **YouTube投稿ノード** - YouTubeに自動投稿

## 必要な環境

### システム要件

- **Node.js**: v18.0.0以上
- **TypeScript**: v5.3.0以上
- **OS**: Windows, macOS, Linux

### 外部ツール

以下のツールが必要です：

1. **Codex CLI** - リサーチ用
   ```bash
   # インストール方法はCodexのドキュメントを参照
   ```

2. **Claude CLI** - 原稿生成用
   ```bash
   # インストール方法はClaudeのドキュメントを参照
   ```

3. **VOICEVOX** - 音声合成用
   - [VOICEVOX公式サイト](https://voicevox.hiroshiba.jp/)からダウンロード
   - デフォルトポート: `http://localhost:50021`

4. **FFmpeg** - 動画合成用
   ```bash
   # Windows (Chocolatey)
   choco install ffmpeg
   
   # macOS (Homebrew)
   brew install ffmpeg
   
   # Linux (apt)
   sudo apt install ffmpeg
   ```

## インストール

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd ai-news-video-generator
```

### 2. セットアップスクリプトの実行

**Linux/macOS**:
```bash
chmod +x setup.sh
./setup.sh
```

**Windows**:
```cmd
setup.bat
```

セットアップスクリプトは以下を自動的に実行します：
- 依存パッケージのインストール
- 必要なディレクトリの作成
- 設定ファイルのコピー
- TypeScriptのビルド
- 外部ツールの確認

### 3. 認証情報の設定

YouTube APIの認証情報を設定します：

```bash
# credentials.jsonを作成（.gitignoreに含まれています）
# Google Cloud Consoleから取得したOAuth 2.0認証情報を配置
```

`config/credentials.json`:
```json
{
  "youtube": {
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["http://localhost:3000/oauth2callback"]
  }
}
```

### 4. 外部ツールのインストール

セットアップスクリプトで確認された外部ツールをインストールしてください：

- **Codex CLI**: リサーチノード用
- **Claude CLI**: 原稿生成ノード用
- **VOICEVOX**: 音声合成ノード用（起動しておく）
- **FFmpeg**: 動画合成ノード用

## 使い方

### 個別ノードの実行

各ノードを個別に実行できます：

```bash
# リサーチノード
npm run run:research

# 原稿生成ノード
npm run run:script-gen

# 字幕生成ノード
npm run run:subtitle

# 音声合成ノード（VOICEVOXを起動しておく）
npm run run:voice

# 動画合成ノード
npm run run:video

# YouTube投稿ノード
npm run run:upload
```

### パイプライン全体の実行

全ノードを順次実行：

```bash
# 全ノード実行（YouTube投稿含む）
npm run run:pipeline

# YouTube投稿をスキップ
npm run run:pipeline -- --skip-upload

# カスタム設定ファイルを使用
npm run run:pipeline -- --config config/my-pipeline-config.json

# カスタム出力ディレクトリを指定
npm run run:pipeline -- --output-dir output/test
```

**Updated pipeline order (2025-11-02)**:
1. Research Node – topic gathering
2. Script Generation Node – script creation
3. Voice Synthesis Node – audio synthesis (generates `audio.wav`)
4. Subtitle Generation Node – audio-synchronised subtitles (SRT/ASS)
5. Video Composition Node – combine assets with FFmpeg
6. YouTube Upload Node – publish to YouTube (optional)

Subtitles now default to `useAudioDuration: true`, so timings match the generated narration automatically.

**パイプライン実行の流れ**:
1. リサーチノード → AIニュースを収集
2. 原稿生成ノード → 動画原稿を作成
3. 字幕生成ノード → SRT字幕を生成
4. 音声合成ノード → 音声ファイルを生成
5. 動画合成ノード → 動画を合成
6. YouTube投稿ノード → YouTubeに投稿

各ノードが失敗した場合、パイプラインは停止します。

### 開発モード

TypeScriptのウォッチモード：

```bash
npm run dev
```

## 設定

### パイプライン設定 (`config/pipeline-config.json`)

```json
{
  "outputDir": "output",
  "logLevel": "INFO",
  "nodes": {
    "research": { ... },
    "scriptGeneration": { ... },
    "subtitleGeneration": { ... },
    "voiceSynthesis": { ... },
    "videoComposition": { ... },
    "youtubeUpload": { ... }
  }
}
```

### 各ノードの設定

#### リサーチノード (`config/research-config.json`)
```json
{
  "enabled": true,
  "timeout": 600000,
  "retryCount": 3,
  "topicCount": 3,
  "enableDuplicateCheck": true,
  "duplicateCheckDays": 7
}
```

#### 原稿生成ノード (`config/script-generation-config.json`)
```json
{
  "enabled": true,
  "timeout": 300000,
  "minLength": 400,
  "maxLength": 600,
  "defaultTone": "professional"
}
```

#### 字幕生成ノード (`config/subtitle-generation-config.json`)
```json
{
  "enabled": true,
  "format": "srt",
  "maxCharsPerLine": 42,
  "maxLines": 2,
  "readingSpeed": 5.8
}
```

#### 音声合成ノード (`config/voice-synthesis-config.json`)
```json
{
  "enabled": true,
  "voicevoxHost": "http://localhost:50021",
  "speaker": 1,
  "speed": 1.0
}
```

#### 動画合成ノード (`config/video-composition-config.json`)
```json
{
  "enabled": true,
  "resolution": "1280x720",
  "fps": 30,
  "codec": "libx264"
}
```

#### YouTube投稿ノード (`config/youtube-upload-config.json`)
```json
{
  "enabled": true,
  "privacyStatus": "private",
  "category": "28",
  "titleTemplate": "AIニュース - {{date}}"
}
```

詳細は各設定ファイルのテンプレート（`*.example.json`）を参照してください。

## ディレクトリ構造

```
.
├── src/
│   ├── nodes/          # ノード実装
│   ├── types/          # 型定義
│   ├── utils/          # ユーティリティ
│   ├── orchestrator/   # パイプライン制御
│   └── scripts/        # 実行スクリプト
├── config/             # 設定ファイル
├── output/             # 出力ファイル（日付別）
├── cache/              # キャッシュ（トピック履歴等）
├── logs/               # ログファイル
└── tests/              # テスト
```

## 出力ファイル

パイプライン実行後、`output/YYYY-MM-DD/`に以下のファイルが生成されます：

- `research.json` - リサーチ結果
- `script.txt` - 動画原稿
- `subtitles.srt` - 字幕ファイル
- `audio.wav` - 音声ファイル
- `video.mp4` - 最終動画
- `upload-result.json` - YouTube投稿結果

## トラブルシューティング

### VOICEVOX接続エラー

```
Error: VOICEVOX is not available
```

**解決方法**:
1. VOICEVOXが起動しているか確認
2. `http://localhost:50021`にアクセスできるか確認
3. ファイアウォール設定を確認

### Codex CLI / Claude CLI エラー

```
Error: Command not found: codex
```

**解決方法**:
1. CLIツールが正しくインストールされているか確認
2. PATHが通っているか確認
3. `codex --version` / `claude --version` で動作確認

### YouTube API クォータエラー

```
Error: Quota exceeded
```

**解決方法**:
- YouTube APIには1日あたりのクォータ制限があります
- Google Cloud Consoleでクォータ使用状況を確認
- 翌日まで待つか、クォータ増加をリクエスト

### FFmpeg エラー

```
Error: FFmpeg command failed
```

**解決方法**:
1. FFmpegがインストールされているか確認: `ffmpeg -version`
2. PATHが通っているか確認
3. 背景画像ファイルが存在するか確認
4. 音声ファイル・字幕ファイルが正しく生成されているか確認

### 設定ファイルが見つからない

```
Error: Configuration file not found
```

**解決方法**:
1. `config/*.example.json`から設定ファイルをコピー
2. セットアップスクリプトを実行: `npm run setup` (Windows: `setup.bat`)
3. 必要な設定ファイルが`config/`ディレクトリに存在するか確認

### パイプライン途中で停止する

**解決方法**:
1. ログファイル（`logs/`）を確認
2. 各ノードを個別に実行してエラー箇所を特定
3. 前のノードの出力ファイルが正しく生成されているか確認

## テスト

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# 統合テスト
npm run test:integration

# E2Eテスト
npm run test:e2e
```

## 開発

### 新しいノードの追加

1. `src/nodes/`に新しいノードクラスを作成
2. `BaseNode`を継承
3. `execute()`メソッドを実装
4. 設定ファイルに追加
5. 実行スクリプトを作成

詳細は`.kiro/specs/auto-video-generation/`のドキュメントを参照してください。

## ライセンス

MIT

## 参考資料

- [要件定義](.kiro/specs/auto-video-generation/requirements.md)
- [設計ドキュメント](.kiro/specs/auto-video-generation/design.md)
- [アーキテクチャ](.kiro/specs/auto-video-generation/architecture.md)
- [ワークフロー](.kiro/specs/auto-video-generation/workflow.md)
- [実装タスク](.kiro/specs/auto-video-generation/tasks-mvp.md)
