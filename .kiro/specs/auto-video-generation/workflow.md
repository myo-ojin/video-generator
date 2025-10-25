# ワークフロー設計

## 全体ワークフロー

### 標準実行フロー（全ノード）

```mermaid
graph TD
    A[開始] --> B[設定読み込み]
    B --> C[Pipeline Orchestrator初期化]
    C --> D[Strategy Analysis Node]
    D --> E[Prompt Refinement Node]
    E --> F[Research Node]
    F --> G[Script Generation Node]
    G --> H[Subtitle Generation Node]
    H --> I[Voice Synthesis Node]
    I --> J[Video Composition Node]
    J --> K[YouTube Upload Node]
    K --> L[Analytics Collection Node]
    L --> M[完了通知]
    M --> N[終了]
    
    D -.失敗.-> Z[エラーハンドリング]
    F -.失敗.-> Z
    G -.失敗.-> Z
    I -.失敗.-> Z
    J -.失敗.-> Z
    K -.失敗.-> Z
    Z --> AA[ログ記録]
    AA --> AB[終了]
```

### MVP実行フロー（Node 03-08）

```mermaid
graph TD
    A[開始] --> B[設定読み込み]
    B --> C[Pipeline Orchestrator初期化]
    C --> F[Research Node]
    F --> G[Script Generation Node]
    G --> H[Subtitle Generation Node]
    H --> I[Voice Synthesis Node]
    I --> J[Video Composition Node]
    J --> K[YouTube Upload Node]
    K --> M[完了通知]
    M --> N[終了]
    
    F -.失敗.-> Z[エラーハンドリング]
    G -.失敗.-> Z
    I -.失敗.-> Z
    J -.失敗.-> Z
    K -.失敗.-> Z
    Z --> AA[ログ記録]
    AA --> AB[終了]
```

## ノード別ワークフロー

### 03 Research Node

```mermaid
graph TD
    A[開始] --> B{prompts.json存在?}
    B -->|Yes| C[プロンプト読み込み]
    B -->|No| D[デフォルトプロンプト生成]
    
    D --> E[strategy.json確認]
    E -->|存在| F[テーマ・キーワード取得]
    E -->|不在| G[設定のデフォルト値使用]
    F --> H[プロンプトテンプレート適用]
    G --> H
    
    C --> I[トピック履歴読み込み]
    H --> I
    I --> J{重複チェック有効?}
    J -->|Yes| K[除外指示をプロンプトに追加]
    J -->|No| L[Codex CLI実行]
    K --> L
    
    L --> M{成功?}
    M -->|No| N[リトライ]
    N --> M
    M -->|Yes| O[出力パース]
    
    O --> P[重複チェック]
    P --> Q[ユニークトピック抽出]
    Q --> R[トピック履歴保存]
    R --> S[research.json保存]
    S --> T[完了]
```

### 04 Script Generation Node

```mermaid
graph TD
    A[開始] --> B{prompts.json存在?}
    B -->|Yes| C[scriptPrompt読み込み]
    B -->|No| D[デフォルトプロンプト生成]
    
    D --> E[research.json読み込み]
    E --> F[strategy.json確認]
    F -->|存在| G[テーマ・トーン・ターゲット取得]
    F -->|不在| H[設定のデフォルト値使用]
    G --> I[構成指示生成]
    H --> I
    I --> J[プロンプトテンプレート適用]
    
    C --> K[リサーチデータ置換]
    J --> K
    
    K --> L[Claude CLI実行]
    L --> M{成功?}
    M -->|No| N[リトライ]
    N --> M
    M -->|Yes| O[原稿フォーマット]
    
    O --> P[長さ検証]
    P -->|OK| Q[script.txt保存]
    P -->|NG| R[長さ調整]
    R --> S{調整成功?}
    S -->|Yes| Q
    S -->|No| T[エラー]
    Q --> U[完了]
```

### 05 Subtitle Generation Node

```mermaid
graph TD
    A[開始] --> B[script.txt読み込み]
    B --> C[文章をセグメント分割]
    C --> D{文字数・行数制限OK?}
    D -->|No| E[再分割]
    E --> D
    D -->|Yes| F[タイムスタンプ割り当て]
    F --> G[読み上げ速度計算]
    G --> H[各セグメントの秒数決定]
    H --> I[SRT形式生成]
    I --> J[subtitles.srt保存]
    J --> K[完了]
```

### 06 Voice Synthesis Node

```mermaid
graph TD
    A[開始] --> B[VOICEVOX可用性チェック]
    B -->|不可| C[エラー]
    B -->|可| D[script.txt読み込み]
    D --> E[音声パラメータ設定]
    E --> F[VOICEVOX API: audio_query]
    F --> G[音声パラメータ適用]
    G --> H[VOICEVOX API: synthesis]
    H --> I[音声データ取得]
    I --> J[audio.wav保存]
    J --> K[完了]
```

### 07 Video Composition Node

```mermaid
graph TD
    A[開始] --> B[入力ファイル確認]
    B --> C[audio.wav]
    B --> D[subtitles.srt]
    B --> E[背景画像/動画]
    
    C --> F[FFmpegコマンド構築]
    D --> F
    E --> F
    
    F --> G[解像度・FPS設定]
    G --> H[コーデック設定]
    H --> I[字幕フィルター設定]
    I --> J[FFmpeg実行]
    J --> K{成功?}
    K -->|No| L[エラー]
    K -->|Yes| M[動画ファイル検証]
    M -->|OK| N[video.mp4保存]
    M -->|NG| L
    N --> O[完了]
```

### 08 YouTube Upload Node

```mermaid
graph TD
    A[開始] --> B[認証情報読み込み]
    B --> C[OAuth 2.0認証]
    C -->|失敗| D[エラー]
    C -->|成功| E[strategy.json読み込み]
    E --> F[メタデータ準備]
    F --> G[タイトル・説明・タグ設定]
    G --> H[video.mp4読み込み]
    H --> I[YouTube API: videos.insert]
    I --> J{成功?}
    J -->|No| K[リトライ]
    K --> I
    J -->|Yes| L[動画ID取得]
    L --> M[upload-result.json保存]
    M --> N[完了]
```

## エラーハンドリングフロー

```mermaid
graph TD
    A[エラー発生] --> B{エラータイプ判定}
    
    B -->|CLI実行エラー| C{リトライ可能?}
    C -->|Yes| D[リトライカウント確認]
    D -->|上限未満| E[Exponential Backoff]
    E --> F[再実行]
    D -->|上限到達| G[エラーログ記録]
    C -->|No| G
    
    B -->|設定エラー| G
    B -->|ファイル不在| H{フォールバック可能?}
    H -->|Yes| I[デフォルト値使用]
    I --> J[警告ログ記録]
    J --> K[処理継続]
    H -->|No| G
    
    B -->|タイムアウト| C
    B -->|APIエラー| C
    B -->|バリデーションエラー| G
    
    G --> L[パイプライン停止]
    L --> M[エラー通知]
    M --> N[終了]
```

## 日次実行ワークフロー（AIニュース）

```mermaid
graph TD
    A[毎日 9:00 AM] --> B[パイプライン起動]
    B --> C[前日のトピック履歴読み込み]
    C --> D[今日のAIニュースをリサーチ]
    D --> E{3つのユニークトピック取得?}
    E -->|No| F[追加リサーチ]
    F --> E
    E -->|Yes| G[75秒の原稿生成]
    G --> H[字幕生成]
    H --> I[音声合成]
    I --> J[動画合成]
    J --> K[YouTube投稿]
    K --> L[トピック履歴更新]
    L --> M[完了通知]
    M --> N[次回実行待機]
```

## データフロー詳細

### ファイル間データフロー

```
strategy.json
  ├─→ prompts.json (metadata)
  └─→ script.txt (theme, tone)
  
research.json
  └─→ script.txt (content)
  
script.txt
  ├─→ subtitles.srt (text + timing)
  └─→ audio.wav (text → speech)
  
subtitles.srt + audio.wav
  └─→ video.mp4 (composition)
  
video.mp4 + strategy.json
  └─→ upload-result.json (YouTube)
  
upload-result.json
  └─→ analytics.json (metrics)
```

### キャッシュ・履歴フロー

```
strategy.json
  └─→ cache/strategy.json (再利用用)
  
research.json
  └─→ cache/topic-history.json (重複チェック用)
  
upload-result.json
  └─→ cache/video-history.json (アナリティクス追跡用)
```

## 並列実行の可能性（将来拡張）

```mermaid
graph TD
    A[Script Generation完了] --> B[Subtitle Generation]
    A --> C[Voice Synthesis]
    
    B --> D[両方完了待機]
    C --> D
    
    D --> E[Video Composition]
```

## ロールバック戦略

### ノード失敗時の対応

1. **Research Node失敗**
   - 前日のリサーチ結果を使用
   - プレースホルダーデータで継続

2. **Script Generation失敗**
   - テンプレート原稿を使用
   - 手動介入を要求

3. **Voice Synthesis失敗**
   - 前回の音声を再利用
   - TTS代替サービスを使用

4. **YouTube Upload失敗**
   - ローカルに保存
   - 次回実行時に再試行

## 監視ポイント

### 各ノードの監視項目

| ノード | 監視項目 | 閾値 |
|--------|---------|------|
| Research | 実行時間 | 10分以内 |
| Research | トピック数 | 3個以上 |
| Script | 文字数 | 400-600文字 |
| Script | 実行時間 | 5分以内 |
| Voice | 音声ファイルサイズ | 1MB以上 |
| Video | 動画ファイルサイズ | 5MB以上 |
| Video | 解像度 | 1280x720以上 |
| Upload | アップロード成功率 | 95%以上 |

## トラブルシューティングフロー

```mermaid
graph TD
    A[問題発生] --> B{どのノード?}
    
    B -->|Research| C[Codex CLI確認]
    C --> D[プロンプト確認]
    D --> E[トピック履歴確認]
    
    B -->|Script| F[Claude CLI確認]
    F --> G[リサーチデータ確認]
    G --> H[構成設定確認]
    
    B -->|Voice| I[VOICEVOX起動確認]
    I --> J[音声パラメータ確認]
    
    B -->|Video| K[FFmpegインストール確認]
    K --> L[入力ファイル確認]
    
    B -->|Upload| M[YouTube認証確認]
    M --> N[クォータ確認]
```
