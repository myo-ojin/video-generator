# 設定ファイル

このディレクトリには、パイプラインの動作を制御する設定ファイルを配置します。

## セットアップ

### 1. テンプレートファイルのコピー

```bash
# パイプライン全体の設定
cp pipeline-config.example.json pipeline-config.json

# リサーチノードの設定
cp research-config.example.json research-config.json

# 原稿生成ノードの設定
cp script-generation-config.example.json script-generation-config.json

# 動画合成ノードの設定
cp video-composition-config.example.json video-composition-config.json

# YouTube投稿ノードの設定
cp youtube-upload-config.example.json youtube-upload-config.json

# YouTube認証情報
cp credentials.example.json credentials.json
```

### 2. 認証情報の設定

`credentials.json`にYouTube APIの認証情報を設定します：

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. YouTube Data API v3を有効化
4. OAuth 2.0クライアントIDを作成
5. クライアントIDとシークレットを`credentials.json`に記載

## 設定ファイル一覧

### pipeline-config.json

パイプライン全体の設定ファイル。全ノードの設定を含みます。

**主要な設定項目:**
- `outputDir`: 出力ディレクトリ（デフォルト: "output"）
- `logLevel`: ログレベル（DEBUG, INFO, WARN, ERROR）
- `nodes`: 各ノードの設定

### research-config.json

リサーチノード専用の設定ファイル。スタンドアロン実行時に使用。

**主要な設定項目:**
- `topicCount`: 収集するトピック数（デフォルト: 3）
- `enableDuplicateCheck`: 重複チェックの有効化
- `duplicateCheckDays`: 重複チェックの対象日数
- `defaultTheme`: デフォルトのテーマ
- `defaultKeywords`: デフォルトのキーワード

### script-generation-config.json

原稿生成ノード専用の設定ファイル。スタンドアロン実行時に使用。

**主要な設定項目:**
- `defaultContentType`: コンテンツタイプ（"ai-news" または "tutorial"）
- `lengthRange`: 原稿の文字数範囲（`min`, `max`）
  - AIニュース: 400-600文字
  - チュートリアル: 1500-2500文字
- `charsPerSecond`: 読み上げ速度（デフォルト: 6文字/秒）
- `autoAdjustLength`: 自動長さ調整の有効化（デフォルト: true）
- `tone`: トーン設定（"professional", "casual", "enthusiastic", "neutral"）
- `structure`: 動画の構成設定
  - `opening`: オープニング設定（時間、内容）
  - `topics`: メインコンテンツ設定（時間、内容）
  - `closing`: クロージング設定（時間、内容）
- `customInstructions`: カスタム指示（プロンプトに追加される）

**バリエーション:**
- `script-generation-config.json`: AIニュース用（400-600文字、professional）
- `script-generation-config.tutorial.json`: チュートリアル用（1500-2500文字、casual）

### voice-synthesis-config.json

音声合成ノード専用の設定ファイル。スタンドアロン実行時に使用。

**主要な設定項目:**
- `voicevoxHost`: VOICEVOXのAPIホスト（デフォルト: "http://localhost:50021"）
- `speaker`: VOICEVOXのスピーカーID（デフォルト: 1）
  - 1: ずんだもん（ノーマル）
  - 0: 四国めたん（ノーマル）
  - 2: 春日部つむぎ（ノーマル）
  - 3: 雨晴はう（ノーマル）
- `speed`: 読み上げ速度（0.5〜2.0、デフォルト: 1.0）
- `pitch`: ピッチ調整（-0.15〜0.15、デフォルト: 0.0）
- `intonation`: イントネーション（0.0〜2.0、デフォルト: 1.0）

**バリエーション:**
- `voice-synthesis-config.json`: 標準設定（speaker 1、speed 1.0）
- `voice-synthesis-config.zundamon.json`: ずんだもん用（speaker 3、speed 1.1）

### video-composition-config.json

動画合成ノード専用の設定ファイル。スタンドアロン実行時に使用。

**主要な設定項目:**
- `ffmpegCommand`: FFmpegコマンド（デフォルト: "ffmpeg"）
- `resolution`: 動画解像度（デフォルト: "1280x720"）
- `fps`: フレームレート（デフォルト: 30）
- `codec`: ビデオコーデック（デフォルト: "libx264"）
- `preset`: エンコードプリセット（デフォルト: "medium"）
  - ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
- `crf`: 品質設定（0-51、デフォルト: 23、低いほど高品質）
- `backgroundImage`: 背景画像のパス（オプション）
- `backgroundVideo`: 背景動画のパス（オプション）
- `subtitleStyle`: 字幕スタイル設定
  - `fontSize`: フォントサイズ（デフォルト: 24）
  - `primaryColor`: 文字色（デフォルト: "&HFFFFFF&"、白）
  - `outlineColor`: 縁取り色（デフォルト: "&H000000&"、黒）
  - `outline`: 縁取りの太さ（デフォルト: 2）

**注意:**
- 背景画像・動画を指定しない場合、黒背景が使用されます
- 解像度は最低1280x720を推奨（要件8.3）

### youtube-upload-config.json

YouTube投稿ノード専用の設定ファイル。スタンドアロン実行時に使用。

**主要な設定項目:**
- `credentialsPath`: 認証情報ファイルのパス（デフォルト: "config/credentials.json"）
- `privacyStatus`: 公開設定（デフォルト: "private"）
  - `public`: 公開
  - `unlisted`: 限定公開
  - `private`: 非公開
- `category`: カテゴリID（デフォルト: "28"、Science & Technology）
  - 28: Science & Technology
  - 22: People & Blogs
  - 24: Entertainment
  - 27: Education
- `titleTemplate`: タイトルテンプレート
  - プレースホルダー: `{date}`, `{year}`, `{month}`, `{day}`, `{workDir}`
- `descriptionTemplate`: 説明文テンプレート
  - プレースホルダー: `{date}`, `{year}`, `{month}`, `{day}`, `{workDir}`
- `tags`: 動画タグのリスト

**注意:**
- テスト時は必ず`privacyStatus: "private"`を使用してください
- YouTube API クォータは1日10,000ユニット（動画アップロード: 1600ユニット/回）
- 約6本/日までアップロード可能

### credentials.json

YouTube APIの認証情報。**このファイルは.gitignoreに含まれており、リポジトリにコミットされません。**

**構造:**
```json
{
  "youtube": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uri": "http://localhost:3000/oauth2callback",
    "refresh_token": "YOUR_REFRESH_TOKEN"
  }
}
```

**セットアップ手順:**
1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクト作成
2. YouTube Data API v3を有効化
3. OAuth 2.0クライアントIDを作成（デスクトップアプリ）
4. 初回OAuth認証でrefresh_tokenを取得
5. refresh_tokenをcredentials.jsonに保存

## カスタマイズ

### AIニュース向け設定（短尺動画: 60-90秒）

```json
{
  "scriptGeneration": {
    "minLength": 400,
    "maxLength": 600,
    "structure": {
      "targetDuration": 75,
      "topics": {
        "count": 3
      }
    }
  }
}
```

### チュートリアル向け設定（長尺動画: 5分）

```json
{
  "scriptGeneration": {
    "minLength": 1500,
    "maxLength": 2500,
    "structure": {
      "targetDuration": 300,
      "topics": {
        "count": 1
      }
    }
  }
}
```

## トラブルシューティング

### 設定ファイルが見つからない

```
Error: Configuration file not found
```

**解決方法**: テンプレートファイルをコピーして設定ファイルを作成してください。

### 認証情報が無効

```
Error: Invalid credentials
```

**解決方法**: `credentials.json`の内容を確認し、Google Cloud Consoleから正しい認証情報を取得してください。

## セキュリティ

- `credentials.json`は絶対にリポジトリにコミットしないでください
- 認証情報は安全に管理してください
- 本番環境では環境変数での管理を推奨します
