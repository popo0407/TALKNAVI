# TALKNAVI

AI ファシリテーターシステム。
チャットベースで会議の進行支援、リアルタイム板書、タイムキーピングを行います。

## ドキュメント

- [要件定義書](docs/requirements.md)
- [アーキテクチャ設計書](docs/architecture.md)
- [デプロイ手順書](docs/deployment.md) ※詳細はこちらを参照

## 技術スタック

- **Frontend**: Next.js (Static Export)
- **Backend**: AWS AppSync, AWS Lambda, Amazon DynamoDB, AWS CDK
- **AI**: Amazon Bedrock (Claude 3.5 Sonnet)

## デプロイ手順

### 1. フロントエンドのビルド

```bash
cd frontend
npm run build
```

### 2. バックエンド（Lambda）のビルド

メモリ不足を回避するため、Lambda 関数は手動でバンドルします。

```bash
cd backend
npm run build:lambda
```

### 3. インフラのデプロイ

```bash
cd backend
npx cdk deploy
```

※ AWS 認証情報（Credentials）が有効であることを確認してください。
