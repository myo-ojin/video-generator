# Implementation Plan - MVP版

## MVP スコープ

このMVP版では、動画生成のコア機能（Node 03-08）に焦点を当てます。以下の機能は将来の拡張として残します：

**MVP に含まれる機能:**
- ✅ リサーチノード（Node 03）- トピック収集
- ✅ 原稿生成ノード（Node 04）- スクリプト作成
- ✅ 字幕生成ノード（Node 05）- SRT生成
- ✅ 音声合成ノード（Node 06）- VOICEVOX統合
- ✅ 動画合成ノード（Node 07）- FFmpeg統合
- ✅ YouTube投稿ノード（Node 08）- 動画アップロード

**将来の拡張として残す機能:**
- 🔲 戦略分析ノード（Node 01）- ユーザープロファイル統合
- 🔲 プロンプト改修ノード（Node 02）- 高度なプロンプト最適化
- 🔲 アナリティクス収集ノード（Node 09）- パフォーマンス分析

## 参照ドキュメント

実装前に以下のドキュメントを確認してください：

- **要件定義**: [requirements.md](./requirements.md)
- **設計概要**: [design.md](./design.md)
- **アーキテクチャ設計**: [architecture.md](./architecture.md)
- **ワークフロー設計**: [workflow.md](./workflow.md)

### ノード別詳細設計

各ノードの実装時は、対応する詳細設計ドキュメントを参照してください：

1. [リサーチノード](./nodes/03-research.md) - デフォルトプロンプト、トピック数指定、重複チェック
2. [原稿生成ノード](./nodes/04-script-generation.md) - 構成管理、AIニュース向け最適化
3. [字幕生成ノード](./nodes/05-subtitle-generation.md) - セグメント分割、タイムスタンプ割り当て
4. [音声合成ノード](./nodes/06-voice-synthesis.md) - VOICEVOX API統合、音声パラメータ
5. [動画合成ノード](./nodes/07-video-composition.md) - FFmpegコマンド構築、字幕埋め込み
6. [YouTube投稿ノード](./nodes/08-youtube-upload.md) - OAuth 2.0認証、メタデータ設定

---

## 実装タスク

### フェーズ1: プロジェクト基盤構築

- [x] 1. プロジェクト構造とコア基盤の構築
  - TypeScriptプロジェクトの初期化（tsconfig.json、package.json）
  - 必要な依存パッケージのインストール（axios、googleapis、@types/node等）
  - ディレクトリ構造の作成（src/nodes、src/utils、config、output、logs）
  - 基本的な型定義ファイルの作成（types.ts: Node、NodeInput、NodeOutput、NodeConfig）
  - 将来のオーケストレーター統合を考慮したインターフェース設計
  - _Requirements: 1.1, 1.2, 11.1_
  - _実装ガイド_:
    - `src/types.ts`に共通型を定義
    - 各ノードは独立して実行可能な設計にする
    - 将来のパイプライン統合のため、標準化された入出力形式を使用

- [x] 2. ユーティリティモジュールの実装
  - [x] 2.1 型定義ファイルの作成（src/types/）
    - error-types.ts: ErrorType enum、PipelineErrorクラス
    - node-types.ts: Node、NodeInput、NodeOutput、NodeConfig
    - config-types.ts: PipelineConfig、各ノード設定の型
    - data-types.ts: ResearchData、StrategyData等のデータ構造
    - _Requirements: 1.2, 11.1_
    - _実装ガイド_:
      - 全ての型定義を一箇所に集約
      - エクスポートを適切に管理

  - [x] 2.2 ロガーの実装（src/utils/logger.ts）
    - Winstonを使用したロガーの設定
    - ログレベル対応（DEBUG、INFO、WARN、ERROR）
    - コンソールとファイル出力の実装（logs/ディレクトリ）
    - タイムスタンプとノード名を含むフォーマット
    - _Requirements: 12.1, 12.3, 12.4, 12.5_
    - _実装ガイド_:
      - シングルトンパターンで実装
      - 環境変数でログレベルを制御可能にする

  - [x] 2.3 CLI実行ユーティリティの実装（src/utils/cli-executor.ts）
    - child_processを使用したCLI実行ラッパー
    - タイムアウト処理の実装（デフォルト30秒）
    - 標準出力・標準エラー出力のキャプチャ
    - エラー時の詳細ログ出力
    - _Requirements: 4.1, 5.1, 12.2_
    - _実装ガイド_:
      - `execCommand(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>`
      - Windows環境を考慮したパス処理

  - [x] 2.4 ファイルユーティリティの実装（src/utils/file-utils.ts）
    - JSON読み込み・書き込み関数
    - テキストファイル読み込み・書き込み関数
    - ディレクトリ存在確認と作成
    - UTF-8エンコーディング対応
    - _Requirements: 11.1, 11.2_
    - _実装ガイド_:
      - エラーハンドリングを含む
      - 相対パスと絶対パスの両方に対応

  - [x] 2.5 リトライロジックの実装（src/utils/retry.ts）
    - exponential backoffを使用したリトライ関数
    - リトライ可能なエラーの判定ロジック（ネットワークエラー、タイムアウト等）
    - 最大リトライ回数の設定（デフォルト3回）
    - _Requirements: 4.4, 5.5_
    - _実装ガイド_:
      - `retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>`
      - バックオフ時間: 1秒、2秒、4秒

### フェーズ2: コアノード実装（Node 03-08）

- [x] 3. ベースノードクラスの実装
  - [x] 3.1 BaseNodeクラスの作成（src/nodes/base-node.ts）
    - 抽象クラスとして実装
    - 共通のexecuteフロー（ログ記録、エラーハンドリング）
    - 設定の読み込みと検証の共通ロジック
    - 入出力ファイルパスの管理
    - _Requirements: 1.2, 1.3, 12.1_
    - _実装ガイド_:
      - `abstract execute(input: NodeInput): Promise<NodeOutput>`
      - 各ノードはこのクラスを継承

- [ ] 4. リサーチノードの実装
  - **詳細設計**: [nodes/03-research.md](./nodes/03-research.md)
  - [x] 4.1 ResearchNodeクラスの作成（src/nodes/research-node.ts）
    - BaseNodeを継承
    - Codex CLI（`codex --search`）の実行
    - CLI出力のパースとデータ構造化
    - デフォルトプロンプト生成機能（prompts.json不在時）
    - トピック数指定機能（デフォルト3、設定で3-4に変更可能）
    - 重複チェック機能（cache/topic-history.jsonで管理）
    - リトライロジックの統合
    - output/research.jsonの出力
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
    - _実装ガイド_:
      - 設定: `config/research-config.json`
      - トピック履歴: `cache/topic-history.json`
      - 出力形式: `{ topics: [{ title, summary, source, date }] }`
      - 重複判定: タイトルの類似度チェック（簡易的な文字列比較）

  - [x] 4.2 リサーチノード設定ファイルの作成
    - config/research-config.jsonのテンプレート作成
    - デフォルトプロンプト、トピック数、重複チェック設定を含む
    - _Requirements: 4.2, 4.5_

  - [x] 4.3 リサーチノード実行スクリプトの作成
    - src/scripts/run-research.tsの作成
    - スタンドアロンでの実行をサポート
    - コマンドライン引数で設定ファイルパスを指定可能
    - _実装ガイド_: `ts-node src/scripts/run-research.ts --config config/research-config.json`

- [ ] 5. 原稿生成ノードの実装
  - **詳細設計**: [nodes/04-script-generation.md](./nodes/04-script-generation.md)
  - [x] 5.1 ScriptGenerationNodeクラスの作成（src/nodes/script-generation-node.ts）
    - BaseNodeを継承
    - output/research.jsonの読み込み
    - Claude CLI（`claude`コマンド）の実行
    - デフォルトプロンプト生成機能（prompts.json不在時）
    - 構成管理機能（オープニング、トピック×3、クロージング）
    - 動的な構成指示生成（リサーチデータを元に）
    - 原稿の長さ検証と自動調整（400〜600文字 for AIニュース、1500〜2500文字 for チュートリアル）
    - 原稿のフォーマット処理（改行、句読点の正規化）
    - output/script.txtの出力
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
    - _実装ガイド_:
      - プロンプトテンプレート: 設定ファイルから読み込み
      - 文字数チェック: 生成後に検証し、必要に応じて再生成
      - 構成例: "こんにちは、今日のAIニュースです。[トピック1][トピック2][トピック3]以上、今日のAIニュースでした。"

  - [x] 5.2 原稿生成ノード設定ファイルの作成
    - config/script-generation-config.jsonのテンプレート作成
    - プロンプトテンプレート、構成設定、文字数制限を含む
    - _Requirements: 5.2, 5.4_

  - [x] 5.3 原稿生成ノード実行スクリプトの作成
    - src/scripts/run-script-generation.tsの作成
    - スタンドアロンでの実行をサポート
    - _実装ガイド_: `ts-node src/scripts/run-script-generation.ts`

- [x] 6. 字幕生成ノードの実装
  - **詳細設計**: [nodes/05-subtitle-generation.md](./nodes/05-subtitle-generation.md)
  - [x] 6.1 SubtitleGenerationNodeクラスの作成（src/nodes/subtitle-generation-node.ts）
    - BaseNodeを継承
    - output/script.txtの読み込み
    - 原稿のセグメント分割（2行、42文字/行以内）
    - タイムスタンプの割り当て（読み上げ速度: 5.8文字/秒、約350文字/分、VOICEVOX速度設定に合わせて調整可能）
    - SRT形式の生成（番号、タイムスタンプ、テキスト）
    - UTF-8エンコーディングでoutput/subtitles.srtに出力
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
    - _実装ガイド_:
      - セグメント分割アルゴリズム: 句読点で区切り、文字数制限内に収める
      - タイムスタンプ形式: `00:00:00,000 --> 00:00:05,000`
      - 改行処理: 2行を超える場合は次のセグメントに

  - [x] 6.2 字幕生成ノード実行スクリプトの作成
    - src/scripts/run-subtitle-generation.tsの作成
    - スタンドアロンでの実行をサポート
    - _実装ガイド_: `ts-node src/scripts/run-subtitle-generation.ts`

- [x] 7. 音声合成ノードの実装
  - **詳細設計**: [nodes/06-voice-synthesis.md](./nodes/06-voice-synthesis.md)
  - [x] 7.1 VoiceSynthesisNodeクラスの作成（src/nodes/voice-synthesis-node.ts）
    - BaseNodeを継承
    - output/script.txtの読み込み
    - VOICEVOXのHTTP API（http://localhost:50021）を使用した音声合成
    - 音声パラメータの設定（speaker、speed、pitch、intonation）
    - WAV形式での音声ファイル保存（output/audio.wav）
    - VOICEVOXの可用性チェック（起動確認）
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
    - _実装ガイド_:
      - API呼び出し: POST /audio_query → POST /synthesis
      - デフォルトspeaker: 1（四国めたん）
      - エラーハンドリング: VOICEVOXが起動していない場合の明確なエラーメッセージ

  - [x] 7.2 音声合成ノード設定ファイルの作成
    - config/voice-synthesis-config.jsonのテンプレート作成
    - speaker ID、speed、pitch、intonation設定を含む
    - _Requirements: 7.3_

  - [x] 7.3 音声合成ノード実行スクリプトの作成
    - src/scripts/run-voice-synthesis.tsの作成
    - スタンドアロンでの実行をサポート
    - _実装ガイド_: `ts-node src/scripts/run-voice-synthesis.ts`

- [x] 8. 動画合成ノードの実装
  - **詳細設計**: [nodes/07-video-composition.md](./nodes/07-video-composition.md)
  - [x] 8.1 VideoCompositionNodeクラスの作成（src/nodes/video-composition-node.ts）
    - BaseNodeを継承
    - output/audio.wav、output/subtitles.srt、背景画像/動画の読み込み
    - FFmpegコマンドの構築と実行
    - 音声、字幕、背景の合成
    - MP4形式（H.264コーデック）での出力（output/video.mp4）
    - 解像度の設定（1280x720）
    - 動画ファイルの検証（ファイルサイズ、再生可能性）
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
    - _実装ガイド_:
      - FFmpegコマンド例: `ffmpeg -loop 1 -i background.jpg -i audio.wav -vf subtitles=subtitles.srt -c:v libx264 -c:a aac -shortest output.mp4`
      - 背景: デフォルト画像を用意（config/default-background.jpg）
      - 字幕スタイル: 白文字、黒縁、下部中央配置

  - [x] 8.2 動画合成ノード設定ファイルの作成
    - config/video-composition-config.jsonのテンプレート作成
    - 背景画像パス、解像度、字幕スタイル設定を含む
    - _Requirements: 8.2, 8.4_

  - [x] 8.3 動画合成ノード実行スクリプトの作成
    - src/scripts/run-video-composition.tsの作成
    - スタンドアロンでの実行をサポート
    - _実装ガイド_: `ts-node src/scripts/run-video-composition.ts`

- [ ] 9. YouTube投稿ノードの実装
  - **詳細設計**: [nodes/08-youtube-upload.md](./nodes/08-youtube-upload.md)
  - [ ] 9.1 YouTubeUploadNodeクラスの作成（src/nodes/youtube-upload-node.ts）
    - BaseNodeを継承
    - googleapis npmパッケージの統合
    - OAuth 2.0認証の実装（config/credentials.jsonから読み込み）
    - output/video.mp4のアップロード
    - メタデータの設定（タイトル、説明、タグ、プライバシー設定）
    - アップロード進捗のログ出力
    - output/upload-result.json（動画ID、URL）の出力
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
    - _実装ガイド_:
      - 認証フロー: OAuth 2.0（初回のみブラウザで認証、トークンを保存）
      - デフォルトタイトル: "AIニュース - [日付]"
      - デフォルトプライバシー: "private"（テスト用）

  - [ ] 9.2 YouTube投稿ノード設定ファイルの作成
    - config/youtube-upload-config.jsonのテンプレート作成
    - タイトルテンプレート、説明、タグ、プライバシー設定を含む
    - config/credentials.jsonのテンプレート作成（.gitignoreに追加）
    - _Requirements: 9.3, 9.4, 11.3_

  - [ ] 9.3 YouTube投稿ノード実行スクリプトの作成
    - src/scripts/run-youtube-upload.tsの作成
    - スタンドアロンでの実行をサポート
    - _実装ガイド_: `ts-node src/scripts/run-youtube-upload.ts`

### フェーズ3: 統合とドキュメント

- [x] 10. 簡易パイプライン実行スクリプトの作成
  - [x] 10.1 パイプライン実行スクリプトの作成（src/scripts/run-pipeline.ts）
    - Node 03-08を順次実行するシンプルなスクリプト
    - 各ノードの実行結果を確認し、エラー時は停止
    - 実行ログの出力
    - 将来のオーケストレーター統合を考慮した設計
    - _Requirements: 1.1, 1.2, 1.3_
    - _実装ガイド_:
      - 各ノードを順番にインスタンス化して実行
      - エラー時は詳細なログを出力して停止
      - 成功時は次のノードに進む

  - [x] 10.2 パイプライン設定ファイルの作成
    - config/pipeline-config.jsonのテンプレート作成
    - 実行するノードのリストと各ノードの設定ファイルパスを含む
    - _Requirements: 11.1, 11.2_

- [ ] 11. ドキュメントとセットアップガイドの作成
  - [ ] 11.1 README.mdの作成
    - プロジェクト概要
    - 必要な依存ツールのリスト（Node.js、TypeScript、Codex CLI、Claude CLI、VOICEVOX、FFmpeg）
    - インストール手順
    - 設定ファイルの説明
    - 実行方法（個別ノード実行、パイプライン実行）
    - トラブルシューティング
    - _Requirements: 11.1_

  - [ ] 11.2 セットアップスクリプトの作成（setup.sh / setup.bat）
    - 依存パッケージのインストール
    - ディレクトリ構造の作成
    - 設定ファイルのコピー
    - Windows/Linux両対応
    - _Requirements: 11.1_

  - [ ] 11.3 .gitignoreの作成
    - node_modules、output、logs、config/credentials.jsonを除外
    - _Requirements: 11.3_

### フェーズ4: 将来の拡張準備

- [ ] 12. 拡張ポイントの文書化
  - [ ] 12.1 ARCHITECTURE.mdの作成
    - 現在の実装の概要
    - 将来の拡張ポイント（Node 01、02、09の統合方法）
    - オーケストレーターの統合方法
    - 新しいノードの追加方法
    - _実装ガイド_:
      - Node 01（戦略分析）の統合: user-profile.jsonを読み込み、リサーチプロンプトに反映
      - Node 02（プロンプト改修）の統合: 戦略データを元にプロンプトを最適化
      - Node 09（アナリティクス）の統合: YouTube Analytics APIでメトリクスを取得

  - [ ] 12.2 拡張用インターフェースの準備
    - src/types.tsに将来のノード用のインターフェースを追加（コメントアウト）
    - StrategyData、PromptData、AnalyticsData型の定義
    - _実装ガイド_: 将来の実装者が参照できるように型定義を用意

## 実装の進め方

1. **フェーズ1から順番に実装**: 基盤→コアノード→統合の順で進める
2. **各ノードは独立して実行可能**: スタンドアロンでテスト可能な設計
3. **設定ファイルで柔軟に制御**: ハードコードを避け、設定ファイルで動作を変更可能に
4. **ログを充実させる**: デバッグしやすいように詳細なログを出力
5. **エラーハンドリングを徹底**: 各ノードで適切なエラーメッセージを出力

## テスト方法

各ノードの実装後、以下の手順でテストしてください：

1. **個別ノードテスト**: 各ノードの実行スクリプトを使用してスタンドアロンで実行
2. **出力ファイル確認**: output/ディレクトリに期待通りのファイルが生成されているか確認
3. **パイプラインテスト**: run-pipeline.tsを使用して全ノードを連続実行
4. **エラーケーステスト**: 意図的にエラーを発生させ、適切にハンドリングされるか確認

## 注意事項

- **外部ツールの依存**: Codex CLI、Claude CLI、VOICEVOX、FFmpegが正しくインストールされている必要があります
- **認証情報の管理**: config/credentials.jsonは.gitignoreに追加し、リポジトリにコミットしないでください
- **Windows環境**: パス区切り文字やコマンド実行方法がLinuxと異なる場合があるため、両環境で動作確認してください
- **API制限**: YouTube APIには1日あたりのクォータ制限があります。テスト時は注意してください
- **設定ファイルパス**: 全ての設定ファイルは `config/` ディレクトリに配置（ワークスペースルートからの相対パス）
- **型定義の配置**: 全ての型定義は `src/types/` ディレクトリに集約
- **読み上げ速度**: 字幕のタイムスタンプはVOICEVOXの速度設定（デフォルト1.0）に合わせて調整してください
