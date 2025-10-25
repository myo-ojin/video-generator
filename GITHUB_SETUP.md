# GitHub リポジトリセットアップガイド

このガイドでは、AI News Video GeneratorをGitHubにアップロードする手順を説明します。

## 前提条件

- Gitがインストールされていること
- GitHubアカウントを持っていること
- GitHubにSSHキーまたはPersonal Access Tokenが設定されていること

## ステップ1: GitHubでリポジトリを作成

1. [GitHub](https://github.com)にログイン
2. 右上の「+」→「New repository」をクリック
3. リポジトリ情報を入力：
   - **Repository name**: `ai-news-video-generator`（または任意の名前）
   - **Description**: `Automated AI news video generation pipeline system`
   - **Visibility**: Public または Private
   - **Initialize this repository with**: 何もチェックしない（既存プロジェクトをアップロードするため）
4. 「Create repository」をクリック

## ステップ2: ローカルリポジトリの初期化

プロジェクトディレクトリで以下のコマンドを実行：

```bash
# Gitリポジトリを初期化
git init

# すべてのファイルをステージング
git add .

# 初回コミット
git commit -m "Initial commit: AI News Video Generator MVP v0.1.0"
```

## ステップ3: リモートリポジトリの設定

GitHubで作成したリポジトリのURLを使用：

```bash
# リモートリポジトリを追加（HTTPSの場合）
git remote add origin https://github.com/YOUR_USERNAME/ai-news-video-generator.git

# または SSHの場合
git remote add origin git@github.com:YOUR_USERNAME/ai-news-video-generator.git
```

**注意**: `YOUR_USERNAME`を自分のGitHubユーザー名に置き換えてください。

## ステップ4: プッシュ

```bash
# メインブランチにプッシュ
git branch -M main
git push -u origin main
```

## ステップ5: 確認

1. GitHubのリポジトリページをブラウザで開く
2. ファイルが正しくアップロードされているか確認
3. README.mdが表示されているか確認

## 重要な確認事項

### ✅ アップロード前チェックリスト

- [ ] `.gitignore`が正しく設定されている
- [ ] `config/credentials.json`が除外されている（絶対にコミットしない！）
- [ ] `node_modules/`が除外されている
- [ ] `dist/`が除外されている
- [ ] `logs/`が除外されている
- [ ] `output/`が除外されている
- [ ] `.env`ファイルが除外されている

### ⚠️ 機密情報の確認

以下のファイルが**絶対に**コミットされていないことを確認：

```bash
# コミット内容を確認
git status

# 除外されているファイルを確認
git check-ignore -v config/credentials.json
```

`config/credentials.json`が表示されれば正しく除外されています。

## トラブルシューティング

### 認証エラーが出る場合

**HTTPSの場合**:
```bash
# Personal Access Tokenを使用
# GitHubの Settings → Developer settings → Personal access tokens で作成
```

**SSHの場合**:
```bash
# SSHキーを設定
ssh-keygen -t ed25519 -C "your_email@example.com"
# 公開鍵をGitHubに追加
```

### 既にリモートが設定されている場合

```bash
# 既存のリモートを確認
git remote -v

# リモートを削除
git remote remove origin

# 新しいリモートを追加
git remote add origin YOUR_REPOSITORY_URL
```

### 大きなファイルがある場合

```bash
# ファイルサイズを確認
du -sh *

# 大きなファイルを除外
echo "large-file.mp4" >> .gitignore
git rm --cached large-file.mp4
```

## 推奨設定

### ブランチ保護ルール

リポジトリの Settings → Branches で以下を設定：

- [ ] Require pull request reviews before merging
- [ ] Require status checks to pass before merging
- [ ] Include administrators

### GitHub Actions（オプション）

CI/CDを設定する場合は、`.github/workflows/`ディレクトリを作成してワークフローを追加。

### リポジトリトピック

リポジトリページで「Add topics」をクリックして以下を追加：

- `ai`
- `video-generation`
- `youtube`
- `automation`
- `typescript`
- `nodejs`
- `pipeline`

## 次のステップ

1. **README.mdの更新**: リポジトリURLを追加
2. **Issuesの作成**: バグや機能要望を管理
3. **Projectsの作成**: タスク管理
4. **Wikiの作成**: 詳細なドキュメント
5. **Releasesの作成**: バージョン管理

## コミットメッセージの規約

今後のコミットは以下の形式を推奨：

```
<type>: <subject>

<body>

<footer>
```

**Type**:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: フォーマット
- `refactor`: リファクタリング
- `test`: テスト
- `chore`: その他

**例**:
```bash
git commit -m "feat: add analytics collection node"
git commit -m "fix: resolve YouTube upload timeout issue"
git commit -m "docs: update README with new features"
```

## 参考リンク

- [GitHub Docs](https://docs.github.com/)
- [Git Documentation](https://git-scm.com/doc)
- [GitHub CLI](https://cli.github.com/)

---

**注意**: このファイル（GITHUB_SETUP.md）はセットアップ後に削除するか、`.github/`ディレクトリに移動することを推奨します。
