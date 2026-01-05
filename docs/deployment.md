# デプロイ手順書

このシステムを AWS 環境にデプロイするための手順書です。AWS CDK を使用して、インフラ構築とアプリケーションの配備を自動化しています。

## 1. 事前準備

デプロイを行う端末に以下のツールがインストールされている必要があります。

- **Node.js (v20 以上推奨)**: `node -v` で確認
- **AWS CLI**: `aws --version` で確認
- **AWS 認証情報の設定**:
  - 会社から提供された Access Key / Secret Key を設定してください。
  - コマンド: `aws configure --profile <プロファイル名>`
  - ※ `<プロファイル名>` は、`dev` や `prod` など、自分で識別しやすい名前を付けます。

### 「AWS プロファイル」とは？

複数の AWS アカウントや権限を使い分けるための「名前付き設定」です。

- `aws configure --profile dev` で設定した情報は、`dev` という名前で保存されます。
- デプロイ時に `--profile dev` と指定することで、そのアカウントに対して操作を行えます。

## 2. 初回セットアップ (Bootstrap)

新しい AWS アカウントまたはリージョンに初めてデプロイする場合のみ、以下のコマンドを実行します。これは CDK がデプロイに必要な管理用リソース（S3 バケットなど）を AWS 上に作成する作業です。

```powershell
cd backend
npx cdk bootstrap --profile <プロファイル名>
```

## 3. デプロイ手順

一括デプロイスクリプトを使用する方法と、手動で実行する方法があります。

### 方法 A: 一括デプロイスクリプトを使用する（推奨）

`scripts/deploy.ps1` を使用すると、フロントエンドのビルドから AWS へのデプロイまでを自動で行います。

```powershell
# 実行例（プロファイル名が dev の場合）
.\scripts\deploy.ps1 -Profile dev
```

### 方法 B: 手動で実行する

以下の順序で実行します。

### ステップ 1: フロントエンドのビルド

フロントエンドの静的ファイルを生成します。

```powershell
cd frontend
npm install
npm run build
```

※ `frontend/out` フォルダが生成されます。

### ステップ 2: バックエンドのビルドとデプロイ

バックエンド（Lambda）のビルドと、全リソースのデプロイを行います。

```powershell
cd ../backend
npm install
npm run build:lambda  # Lambdaのコードをesbuildでビルド
npx cdk deploy --all --require-approval never --profile <プロファイル名>
```

## 4. デプロイ後の確認

デプロイが完了すると、ターミナルに以下の情報（Outputs）が表示されます。

- **GraphQLAPIURL**: AppSync のエンドポイント
- **GraphQLAPIKey**: API キー
- **WebsiteURL**: フロントエンドの URL（CloudFront）

`WebsiteURL` にブラウザでアクセスし、システムが動作しているか確認してください。

## 5. トラブルシューティング

- **権限エラー (AccessDenied)**:
  使用している AWS プロファイルに `AdministratorAccess` などの十分な権限があるか確認してください。
- **Docker がないというエラー**:
  このプロジェクトは `esbuild` を使用するように設定されています。もし Docker エラーが出る場合は、`backend/lib/backend-stack.ts` で `NodejsFunction` ではなく `lambda.Function` + `fromAsset` を使用しているか確認してください。
- **デプロイが途中で止まる**:
  CloudFormation のコンソール画面でエラー内容を確認してください。
