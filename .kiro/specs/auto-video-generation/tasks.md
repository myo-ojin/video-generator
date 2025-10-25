# Implementation Plan

## 参照ドキュメント

実装前に以下のドキュメントを確認してください：

- **要件定義**: [requirements.md](./requirements.md)
- **設計概要**: [design.md](./design.md)
- **アーキテクチャ設計**: [architecture.md](./architecture.md)
- **ワークフロー設計**: [workflow.md](./workflow.md)

### ノード別詳細設計

各ノードの実装時は、対応する詳細設計ドキュメントを参照してください：

1. [戦略分析ノード](./nodes/01-strategy-analysis.md) - 実行モード、Codex CLI統合、キャッシュ機能
2. [プロンプト改修ノード](./nodes/02-prompt-refinement.md) - プロンプトテンプレート、トーン別設定
3. [リサーチノード](./nodes/03-research.md) - デフォルトプロンプト、トピック数指定、重複チェック
4. [原稿生成ノード](./nodes/04-script-generation.md) - 構成管理、AIニュース向け最適化
5. [字幕生成ノード](./nodes/05-subtitle-generation.md) - セグメント分割、タイムスタンプ割り当て
6. [音声合成ノード](./nodes/06-voice-synthesis.md) - VOICEVOX API統合、音声パラメータ
7. [動画合成ノード](./nodes/07-video-composition.md) - FFmpegコマンド構築、字幕埋め込み
8. [YouTube投稿ノード](./nodes/08-youtube-upload.md) - OAuth 2.0認証、メタデータ設定
9. [アナリティクス収集ノード](./nodes/09-analytics-collection.md) - Analytics API、メトリクス取得

---

- [ ] 1. プロジェクト構造とコア基盤の構築
  - TypeScriptプロジェクトの初期化（tsconfig.json、package.json）
  - ディレクトリ構造の作成（src/orchestrator、src/nodes、src/utils、config、output、logs）
  - 基本的な型定義ファイルの作成（Node、NodeInput、NodeOutput、NodeConfig）
  - _Requirements: 1.1, 1.2, 11.1_

- [ ] 2. ユーティリティモジュールの実装
  - [ ] 2.1 ロガーの実装（logger.ts）
    - Winstonまたはpinoを使用したロガーの設定
    - ログレベル対応（DEBUG、INFO、WARN、ERROR）
    - コンソールとファイル出力の実装
    - _Requirements: 12.1, 12.3, 12.4, 12.5_

  - [ ] 2.2 CLI実行ユーティリティの実装（cli-executor.ts）
    - child_processを使用したCLI実行ラッパー
    - タイムアウト処理の実装
    - 標準出力・標準エラー出力のキャプチャ
    - _Requirements: 4.1, 5.1, 12.2_

  - [ ] 2.3 設定バリデーターの実装（validator.ts）
    - 設定ファイルのスキーマ検証
    - 必須フィールドチェック
    - 環境変数の置換処理
    - _Requirements: 11.4, 11.5, 11.6_

  - [ ] 2.4 リトライロジックの実装
    - exponential backoffを使用したリトライ関数
    - リトライ可能なエラーの判定ロジック
    - _Requirements: 4.4, 5.5_

  - [ ] 2.5 ユーティリティのユニットテスト
    - ロガーのテスト（ログレベル、出力先）
    - CLI実行ユーティリティのテスト（正常系、タイムアウト、エラー）
    - バリデーターのテスト（有効/無効な設定）
    - リトライロジックのテスト（リトライ回数、バックオフ）
    - _Requirements: 12.1, 12.3_

- [ ] 3. ベースノードクラスの実装
  - [ ] 3.1 BaseNodeクラスの作成（base-node.ts）
    - Nodeインターフェースの実装
    - 共通のexecuteフロー（タイムアウト、ログ記録、エラーハンドリング）
    - 設定の読み込みと検証
    - _Requirements: 1.2, 1.3, 12.1_

- [ ] 4. 戦略分析ノードの実装
  - **詳細設計**: [nodes/01-strategy-analysis.md](./nodes/01-strategy-analysis.md)
  - [ ] 4.1 StrategyAnalysisNodeクラスの作成（strategy-analysis.ts）
    - UserProfileの読み込み処理
    - トレンド分析ロジック（Codex CLI統合）
    - ユーザープロファイルとトレンドの統合
    - 3つの実行モード（新規生成、再利用、手動指定）
    - キャッシュ機能
    - strategy.jsonの出力
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 4.2 戦略分析ノードのユニットテスト
    - UserProfile読み込みのテスト（正常系、ファイル不在時）
    - プロファイル統合のテスト（トーン、価値観、禁止ワードの反映）
    - デフォルト設定のテスト
    - 実行モード判定のテスト
    - キャッシュ機能のテスト
    - _Requirements: 2.1, 2.7_

- [ ] 5. プロンプト改修ノードの実装
  - **詳細設計**: [nodes/02-prompt-refinement.md](./nodes/02-prompt-refinement.md)
  - [ ] 5.1 PromptRefinementNodeクラスの作成（prompt-refinement.ts）
    - strategy.jsonの読み込み
    - リサーチ用プロンプトの生成
    - 原稿生成用プロンプトの生成
    - prompts.jsonの出力
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 5.2 プロンプト改修ノードのユニットテスト
    - プロンプト生成のテスト（戦略データの反映確認）
    - 出力フォーマットのテスト
    - _Requirements: 3.2, 3.3_

- [ ] 6. リサーチノードの実装
  - **詳細設計**: [nodes/03-research.md](./nodes/03-research.md)
  - [ ] 6.1 ResearchNodeクラスの作成（research.ts）
    - Codex CLI（`codex --search`）の実行
    - CLI出力のパースとデータ構造化
    - デフォルトプロンプト生成機能
    - トピック数指定機能
    - 重複チェック機能（トピック履歴管理）
    - リトライロジックの統合
    - research.jsonの出力
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 6.2 リサーチノードのユニットテスト
    - CLI実行のテスト（モックを使用）
    - 出力パースのテスト
    - デフォルトプロンプト生成のテスト
    - 重複チェックのテスト
    - トピック履歴管理のテスト
    - リトライロジックのテスト
    - _Requirements: 4.1, 4.2, 4.4_

- [ ] 7. 原稿生成ノードの実装
  - **詳細設計**: [nodes/04-script-generation.md](./nodes/04-script-generation.md)
  - [ ] 7.1 ScriptGenerationNodeクラスの作成（script-generation.ts）
    - Claude CLIの実行（プロンプトとリサーチデータを渡す）
    - デフォルトプロンプト生成機能
    - 構成管理機能（オープニング、トピック、クロージング）
    - 動的な構成指示生成
    - 原稿の長さ検証と自動調整（400〜600文字 for AIニュース）
    - 原稿のフォーマット処理
    - script.txtの出力
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 7.2 原稿生成ノードのユニットテスト
    - CLI実行のテスト（モックを使用）
    - デフォルトプロンプト生成のテスト
    - 構成指示生成のテスト
    - 原稿長さ検証と調整のテスト
    - フォーマット処理のテスト
    - _Requirements: 5.1, 5.4_

- [ ] 8. 字幕生成ノードの実装
  - **詳細設計**: [nodes/05-subtitle-generation.md](./nodes/05-subtitle-generation.md)
  - [ ] 8.1 SubtitleGenerationNodeクラスの作成（subtitle-generation.ts）
    - 原稿のセグメント分割（2行、42文字/行以内）
    - タイムスタンプの割り当て（読み上げ速度に基づく）
    - SRT形式の生成
    - UTF-8エンコーディングでの出力
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 8.2 字幕生成ノードのユニットテスト
    - セグメント分割のテスト（文字数制限、行数制限）
    - タイムスタンプ割り当てのテスト
    - SRT形式生成のテスト
    - _Requirements: 6.3, 6.4_

- [ ] 9. 音声合成ノードの実装
  - **詳細設計**: [nodes/06-voice-synthesis.md](./nodes/06-voice-synthesis.md)
  - [ ] 9.1 VoiceSynthesisNodeクラスの作成（voice-synthesis.ts）
    - VOICEVOXのHTTP APIを使用した音声合成
    - 音声パラメータの設定（speaker、speed、pitch、intonation）
    - WAVまたはMP3形式での音声ファイル保存
    - VOICEVOXの可用性チェック
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 9.2 音声合成ノードのユニットテスト
    - VOICEVOX API呼び出しのテスト（モックを使用）
    - 音声パラメータ設定のテスト
    - 可用性チェックのテスト
    - _Requirements: 7.1, 7.3, 7.5_

- [ ] 10. 動画合成ノードの実装
  - **詳細設計**: [nodes/07-video-composition.md](./nodes/07-video-composition.md)
  - [ ] 10.1 VideoCompositionNodeクラスの作成（video-composition.ts）
    - FFmpegコマンドの構築と実行
    - 音声、字幕、背景画像/動画の合成
    - MP4形式（H.264コーデック）での出力
    - 解像度の設定（最低1280x720）
    - 動画ファイルの検証
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 10.2 動画合成ノードのユニットテスト
    - FFmpegコマンド構築のテスト
    - 動画ファイル検証のテスト
    - _Requirements: 8.1, 8.2_

- [ ] 11. YouTube投稿ノードの実装
  - **詳細設計**: [nodes/08-youtube-upload.md](./nodes/08-youtube-upload.md)
  - [ ] 11.1 YouTubeUploadNodeクラスの作成（youtube-upload.ts）
    - googleapis npmパッケージの統合
    - OAuth 2.0認証の実装
    - 動画ファイルのアップロード
    - メタデータの設定（タイトル、説明、タグ、プライバシー設定）
    - upload-result.jsonの出力
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 11.2 YouTube投稿ノードのユニットテスト
    - 認証処理のテスト（モックを使用）
    - メタデータ設定のテスト
    - アップロード処理のテスト（モックを使用）
    - _Requirements: 9.1, 9.3, 9.4_

- [ ] 12. アナリティクス収集ノードの実装
  - **詳細設計**: [nodes/09-analytics-collection.md](./nodes/09-analytics-collection.md)
  - [ ] 12.1 AnalyticsCollectionNodeクラスの作成（analytics-collection.ts）
    - YouTube Analytics APIの認証
    - 動画メトリクスの取得（views、watch time、likes、comments、engagement rate）
    - 日付範囲の指定対応
    - analytics.jsonの出力
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 12.2 アナリティクス収集ノードのユニットテスト
    - 認証処理のテスト（モックを使用）
    - メトリクス取得のテスト（モックを使用）
    - 日付範囲指定のテスト
    - _Requirements: 10.1, 10.2, 10.4_

- [ ] 13. パイプラインオーケストレーターの実装
  - [ ] 13.1 PipelineOrchestratorクラスの作成（pipeline.ts）
    - 設定ファイルの読み込み（pipeline-config.json）
    - 設定の検証
    - 9つのノードの順次実行
    - ノード間のデータ受け渡し
    - エラーハンドリングとパイプライン停止
    - 中間出力の保存
    - 実行結果の通知
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.1, 11.2_

  - [ ] 13.2 パイプラインオーケストレーターのユニットテスト
    - 設定読み込みと検証のテスト
    - ノード順次実行のテスト（モックノードを使用）
    - エラーハンドリングのテスト（ノード失敗時の停止）
    - データ受け渡しのテスト
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 13.3 統合テスト
    - 複数ノード連携のテスト
    - エンドツーエンドのパイプライン実行テスト（モックデータ使用）
    - _Requirements: 1.1, 1.2_

- [ ] 14. メインエントリーポイントの実装
  - [ ] 14.1 index.tsの作成
    - コマンドライン引数の処理
    - PipelineOrchestratorの初期化と実行
    - グローバルエラーハンドリング
    - 実行結果の出力
    - _Requirements: 1.1, 1.5_

- [ ] 15. 設定ファイルテンプレートの作成
  - [ ] 15.1 設定ファイルの作成
    - pipeline-config.jsonのテンプレート作成
    - user-profile.jsonのテンプレート作成
    - credentials.jsonのテンプレート作成（.gitignoreに追加）
    - README.mdに設定方法を記載
    - _Requirements: 11.1, 11.2, 11.3, 11.7_

- [ ] 16. ビルドとデプロイメント設定
  - [ ] 16.1 ビルドスクリプトの作成
    - TypeScriptのコンパイル設定
    - package.jsonにビルドスクリプト追加
    - 実行スクリプトの作成
    - _Requirements: 1.1_

  - [ ] 16.2 デプロイメントドキュメントの作成
    - 依存ツールのインストール手順（Codex CLI、Claude CLI、VOICEVOX、FFmpeg）
    - 定期実行の設定方法（cron、Windows Task Scheduler）
    - トラブルシューティングガイド
    - _Requirements: 11.1_
