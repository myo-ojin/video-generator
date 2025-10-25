# YouTube Upload Node - 詳細設計

## 要件 (requirements.mdより)

このノードは以下の要件を満たす必要があります：

### 要件9

**ユーザーストーリー:** コンテンツクリエイターとして、YouTube投稿ノードが動画を自動的に公開することで、各動画を手動でアップロードする必要がないようにしたい。

#### 受入基準

1. YouTube投稿ノードは、OAuth 2.0認証情報を使用してYouTube APIで認証すること
2. YouTube投稿ノードは、合成された動画ファイルを指定されたYouTubeチャンネルにアップロードすること
3. YouTube投稿ノードは、戦略データに基づいてタイトル、説明、タグを含む動画メタデータを設定すること
4. YouTube投稿ノードは、設定で指定された動画のプライバシーステータス（公開、限定公開、非公開）を設定すること
5. アップロードが完了したとき、YouTube投稿ノードは動画IDを返すこと

### 関連要件

- 要件1.2: ノードが正常に完了したとき、システムは出力データをパイプライン内の次のノードに渡すこと
- 要件1.3: ノードが実行中に失敗した場合、システムはエラー詳細をログに記録し、パイプラインを停止すること
- 要件11.2: システムは、API認証情報と処理パラメータの設定を許可すること
- 要件12.1: システムは、各ノード実行の開始時刻と完了時刻をログに記録すること

## 概要

YouTube投稿ノードは、googleapis npmパッケージを使用して動画をYouTubeにアップロードします。

## 入力

- video.mp4
- strategy.json

## 出力

- upload-result.json

## インターフェース

```typescript
interface YouTubeUploadNode extends Node {
  authenticate(credentials: any): Promise<any>;
  uploadVideo(videoPath: string, metadata: VideoMetadata, auth: any): Promise<UploadResult>;
  prepareMetadata(strategy: StrategyData, config: any): VideoMetadata;
}

interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  privacyStatus: 'public' | 'unlisted' | 'private';
  category: string;
}

interface UploadResult {
  videoId: string;
  url: string;
  uploadTime: string;
}
```

## 実装詳細

### 1. OAuth 2.0 Authentication

```typescript
async authenticate(credentials: any): Promise<any> {
  const { google } = require('googleapis');
  
  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uri
  );
  
  // Check if we have a saved token
  if (credentials.refresh_token) {
    oauth2Client.setCredentials({
      refresh_token: credentials.refresh_token
    });
    
    // Refresh access token if needed
    try {
      await oauth2Client.getAccessToken();
      logger.info('YouTube authentication successful (using refresh token)');
      return oauth2Client;
    } catch (error) {
      logger.error('Failed to refresh token:', error.message);
      throw new Error('YouTube authentication failed. Please re-authenticate.');
    }
  }
  
  throw new Error('No refresh token found. Please complete OAuth flow first.');
}
```

### 2. Video Upload

```typescript
async uploadVideo(
  videoPath: string,
  metadata: VideoMetadata,
  auth: any
): Promise<UploadResult> {
  const { google } = require('googleapis');
  const youtube = google.youtube({ version: 'v3', auth });
  
  logger.info(`Uploading video: ${metadata.title}`);
  
  const fileSize = (await fs.stat(videoPath)).size;
  logger.info(`Video file size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  
  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: metadata.category
      },
      status: {
        privacyStatus: metadata.privacyStatus,
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: createReadStream(videoPath)
    }
  });
  
  const videoId = response.data.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  
  logger.info(`Video uploaded successfully: ${url}`);
  
  return {
    videoId,
    url,
    uploadTime: new Date().toISOString()
  };
}
```

### 3. Metadata Preparation

```typescript
prepareMetadata(strategy: StrategyData, config: any): VideoMetadata {
  // Generate description from strategy
  const description = this.generateDescription(strategy);
  
  return {
    title: strategy.suggestedTitle,
    description,
    tags: strategy.suggestedTags,
    privacyStatus: config.privacyStatus || 'unlisted',
    category: config.category || '22' // People & Blogs
  };
}

private generateDescription(strategy: StrategyData): string {
  const lines = [
    strategy.contentTheme,
    '',
    `ターゲット: ${strategy.targetAudience}`,
    '',
    '【キーワード】',
    strategy.keywords.join(', '),
    '',
    '【タグ】',
    `#${strategy.suggestedTags.join(' #')}`
  ];
  
  return lines.join('\n');
}
```

### 4. Execute Method

```typescript
async execute(input: NodeInput): Promise<NodeOutput> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting YouTube Upload Node');
    
    // Load credentials
    const config = this.getConfig();
    const credentialsPath = config.credentialsPath || './config/credentials.json';
    const credentialsContent = await fs.readFile(credentialsPath, 'utf-8');
    const credentials = JSON.parse(credentialsContent);
    
    // Authenticate
    const auth = await this.authenticate(credentials.youtube);
    
    // Load strategy
    const strategyPath = path.join(input.workDir, 'strategy.json');
    const strategyContent = await fs.readFile(strategyPath, 'utf-8');
    const strategy = JSON.parse(strategyContent);
    
    // Prepare metadata
    const metadata = this.prepareMetadata(strategy, config);
    
    // Get video path
    const videoPath = input.previousOutput?.outputPath || 
                     path.join(input.workDir, 'video.mp4');
    
    // Upload video
    const result = await this.uploadVideo(videoPath, metadata, auth);
    
    // Save result
    const outputPath = path.join(input.workDir, 'upload-result.json');
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    
    logger.info(`YouTube Upload Node completed: ${result.url}`);
    
    return {
      success: true,
      data: result,
      outputPath,
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error(`YouTube Upload Node failed: ${error.message}`);
    throw new PipelineError(
      ErrorType.API_ERROR,
      'YouTubeUploadNode',
      error.message,
      error
    );
  }
}
```

## YouTube API設定

### 必要な認証情報

**credentials.json:**
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

### OAuth 2.0フロー

1. Google Cloud Consoleでプロジェクト作成
2. YouTube Data API v3を有効化
3. OAuth 2.0クライアントIDを作成
4. 初回認証でrefresh_tokenを取得
5. refresh_tokenを使用して自動認証

### カテゴリID一覧

| ID | カテゴリ |
|----|---------|
| 1 | Film & Animation |
| 2 | Autos & Vehicles |
| 10 | Music |
| 15 | Pets & Animals |
| 17 | Sports |
| 19 | Travel & Events |
| 20 | Gaming |
| 22 | People & Blogs |
| 23 | Comedy |
| 24 | Entertainment |
| 25 | News & Politics |
| 26 | Howto & Style |
| 27 | Education |
| 28 | Science & Technology |

## エラーハンドリング

- 認証情報が見つからない場合：エラーをスローしてパイプラインを停止
- refresh_tokenが無効な場合：エラーをスローしてパイプラインを停止
- 動画ファイルが見つからない場合：エラーをスローしてパイプラインを停止
- アップロードが失敗した場合：リトライ（最大2回）
- APIクォータ超過の場合：エラーをスローしてパイプラインを停止

## YouTube APIクォータ

- 動画アップロード：1600ユニット/回
- 1日のクォータ：10,000ユニット（デフォルト）
- 1日あたり約6本の動画をアップロード可能

## テスト観点

- OAuth 2.0認証の成功
- refresh_tokenを使用した自動認証
- メタデータの正しい生成
- 動画ファイルのアップロード
- プライバシー設定の反映
- カテゴリ設定の反映
- アップロード結果の保存
- エラーハンドリングの妥当性
- リトライロジックの動作確認
