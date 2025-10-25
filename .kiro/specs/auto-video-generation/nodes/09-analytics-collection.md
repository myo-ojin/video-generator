# Analytics Collection Node - 詳細設計

## 要件 (requirements.mdより)

このノードは以下の要件を満たす必要があります：

### 要件10

**ユーザーストーリー:** コンテンツクリエイターとして、アナリティクス収集ノードが動画のパフォーマンスデータを収集することで、コンテンツの成功を追跡できるようにしたい。

#### 受入基準

1. アナリティクス収集ノードは、YouTube Analytics APIで認証すること
2. アナリティクス収集ノードは、視聴回数、視聴時間、高評価数、コメント数、エンゲージメント率を含むメトリクスを取得すること
3. アナリティクス収集ノードは、構造化形式（JSONまたはCSV）でアナリティクスデータを保存すること
4. アナリティクス収集ノードは、特定の日付範囲のアナリティクスクエリをサポートすること
5. アナリティクス収集ノードは、3分以内にデータ収集を完了すること

### 関連要件

- 要件1.2: ノードが正常に完了したとき、システムは出力データをパイプライン内の次のノードに渡すこと
- 要件1.5: パイプラインが全9ノードを完了したとき、システムはユーザーに完了を通知すること
- 要件11.2: システムは、API認証情報と処理パラメータの設定を許可すること
- 要件12.1: システムは、各ノード実行の開始時刻と完了時刻をログに記録すること

## 概要

アナリティクス収集ノードは、YouTube Analytics APIを使用して動画のパフォーマンスデータを収集します。

## 入力

- upload-result.json

## 出力

- analytics.json

## インターフェース

```typescript
interface AnalyticsCollectionNode extends Node {
  authenticate(credentials: any): Promise<any>;
  fetchAnalytics(videoId: string, dateRange: string, auth: any): Promise<AnalyticsData>;
  parseDateRange(dateRange: string): { startDate: string; endDate: string };
}

interface AnalyticsData {
  videoId: string;
  views: number;
  watchTime: number; // seconds
  likes: number;
  comments: number;
  engagementRate: number;
  collectedAt: string;
}
```

## 実装詳細

### 1. Authentication (Reuse YouTube Auth)

```typescript
async authenticate(credentials: any): Promise<any> {
  const { google } = require('googleapis');
  
  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uri
  );
  
  if (credentials.refresh_token) {
    oauth2Client.setCredentials({
      refresh_token: credentials.refresh_token
    });
    
    await oauth2Client.getAccessToken();
    logger.info('YouTube Analytics authentication successful');
    return oauth2Client;
  }
  
  throw new Error('No refresh token found for YouTube Analytics');
}
```

### 2. Fetch Analytics Data

```typescript
async fetchAnalytics(
  videoId: string,
  dateRange: string,
  auth: any
): Promise<AnalyticsData> {
  const { google } = require('googleapis');
  const youtube = google.youtube({ version: 'v3', auth });
  const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth });
  
  logger.info(`Fetching analytics for video: ${videoId}`);
  
  // Get basic video statistics
  const videoResponse = await youtube.videos.list({
    part: ['statistics', 'contentDetails'],
    id: [videoId]
  });
  
  if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
    throw new Error(`Video not found: ${videoId}`);
  }
  
  const stats = videoResponse.data.items[0].statistics;
  
  // Parse date range
  const { startDate, endDate } = this.parseDateRange(dateRange);
  
  // Get analytics data (views, watch time, etc.)
  let analyticsData;
  try {
    const analyticsResponse = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration',
      dimensions: 'video',
      filters: `video==${videoId}`
    });
    
    analyticsData = analyticsResponse.data.rows?.[0] || [0, 0, 0];
  } catch (error) {
    logger.warn(`Analytics API query failed: ${error.message}. Using basic stats only.`);
    analyticsData = [parseInt(stats.viewCount || '0'), 0, 0];
  }
  
  // Calculate engagement rate
  const views = parseInt(stats.viewCount || '0');
  const likes = parseInt(stats.likeCount || '0');
  const comments = parseInt(stats.commentCount || '0');
  const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  
  return {
    videoId,
    views,
    watchTime: analyticsData[1] * 60, // convert minutes to seconds
    likes,
    comments,
    engagementRate: parseFloat(engagementRate.toFixed(2)),
    collectedAt: new Date().toISOString()
  };
}

private parseDateRange(dateRange: string): { startDate: string; endDate: string } {
  const endDate = new Date().toISOString().split('T')[0];
  let startDate: string;
  
  switch (dateRange) {
    case 'last7days':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'last30days':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'last90days':
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    default:
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  
  return { startDate, endDate };
}
```

### 3. Execute Method

```typescript
async execute(input: NodeInput): Promise<NodeOutput> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting Analytics Collection Node');
    
    // Load credentials
    const config = this.getConfig();
    const credentialsPath = config.credentialsPath || './config/credentials.json';
    const credentialsContent = await fs.readFile(credentialsPath, 'utf-8');
    const credentials = JSON.parse(credentialsContent);
    
    // Authenticate
    const auth = await this.authenticate(credentials.youtube);
    
    // Load upload result
    const uploadResultPath = input.previousOutput?.outputPath || 
                            path.join(input.workDir, 'upload-result.json');
    const uploadResultContent = await fs.readFile(uploadResultPath, 'utf-8');
    const uploadResult = JSON.parse(uploadResultContent);
    
    // Fetch analytics
    const dateRange = config.dateRange || 'last7days';
    const analytics = await this.fetchAnalytics(uploadResult.videoId, dateRange, auth);
    
    // Save output
    const outputPath = path.join(input.workDir, 'analytics.json');
    await fs.writeFile(outputPath, JSON.stringify(analytics, null, 2), 'utf-8');
    
    logger.info(`Analytics Collection Node completed: ${analytics.views} views, ${analytics.likes} likes`);
    
    return {
      success: true,
      data: analytics,
      outputPath,
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error(`Analytics Collection Node failed: ${error.message}`);
    throw new PipelineError(
      ErrorType.API_ERROR,
      'AnalyticsCollectionNode',
      error.message,
      error
    );
  }
}
```

## YouTube Analytics API

### 利用可能なメトリクス

| メトリクス | 説明 |
|-----------|------|
| views | 視聴回数 |
| estimatedMinutesWatched | 推定視聴時間（分） |
| averageViewDuration | 平均視聴時間（秒） |
| likes | 高評価数 |
| dislikes | 低評価数（非推奨） |
| comments | コメント数 |
| shares | シェア数 |
| subscribersGained | 獲得登録者数 |
| subscribersLost | 失った登録者数 |

### エンゲージメント率の計算

```
エンゲージメント率 = ((高評価数 + コメント数) / 視聴回数) × 100
```

### 日付範囲オプション

- **last7days**: 過去7日間
- **last30days**: 過去30日間
- **last90days**: 過去90日間

## 出力例

```json
{
  "videoId": "dQw4w9WgXcQ",
  "views": 1234,
  "watchTime": 5678,
  "likes": 89,
  "comments": 12,
  "engagementRate": 8.19,
  "collectedAt": "2024-10-24T12:34:56.789Z"
}
```

## エラーハンドリング

- 認証情報が見つからない場合：エラーをスローしてパイプラインを停止
- 動画IDが見つからない場合：エラーをスローしてパイプラインを停止
- Analytics APIクエリが失敗した場合：基本統計のみを使用（警告をログに記録）
- APIクォータ超過の場合：エラーをスローしてパイプラインを停止

## YouTube Analytics APIクォータ

- レポートクエリ：50ユニット/回
- 1日のクォータ：10,000ユニット（デフォルト）
- 1日あたり約200回のクエリが可能

## 注意事項

- アナリティクスデータは通常24-48時間の遅延がある
- 投稿直後の動画は統計が0の場合がある
- Analytics APIは一部のメトリクスにアクセス制限がある場合がある

## テスト観点

- OAuth 2.0認証の成功
- 動画統計の取得
- Analytics APIクエリの実行
- 日付範囲の正しいパース
- エンゲージメント率の正しい計算
- Analytics APIが失敗した場合のフォールバック
- 出力データの保存
- エラーハンドリングの妥当性
