---
name: aws-ops
description: AWS環境特有の運用・開発ルール
---

## AWS CDK によるインフラ管理原則

- **IaC の統一**: インフラ構築は AWS CDK (v2) を使用し、TypeScript で記述する。CloudFormation テンプレートの直接編集は禁止。
- **L2/L3 コンストラクトの優先**: セキュリティ（IAM 最小権限）と保守性の観点から、可能な限り L2 以上のコンストラクトを使用する。
- **アセット管理の自動化**: Lambda コードやフロントエンド資産の配備は、CDK の `fromAsset` や `BucketDeployment` を活用し、手動の S3 アップロードを排除する。
- **環境分離**: 本番・開発などの環境差分は `cdk.json` の `context` または環境変数で管理し、コード自体を分岐させない。
- **ブートストラップ**: 新しい AWS アカウント/リージョンへのデプロイ前には必ず `cdk bootstrap` を実行すること。

## Lambda 開発ルール

- **事前ビルド方式**: Lambda のビルドに Docker を必要とする `NodejsFunction` ではなく、`esbuild` 等で事前ビルドした成果物を `lambda.Code.fromAsset` でデプロイする方式を推奨する（企業環境での Docker 制限対策）。

## API Gateway & AppSync 連携ルール

- **AppSync の優先**: リアルタイム性や GraphQL の柔軟性が必要な場合は AppSync を優先的に検討する。
- **CORS (OPTIONS) の認証除外**: API Gateway を使用する場合、ブラウザのプリフライトリクエスト (`OPTIONS`) は認証を通過できないため、`OPTIONS` メソッドの `AuthorizationType` は必ず `NONE` に設定すること。
- **Authorization ヘッダー形式**: Cognito User Pool Authorizer を使用する場合、デフォルトでは `Authorization` ヘッダーに ID トークンを直接（`Bearer ` プレフィックスなしで）含める必要がある。

## その他運用ルール

- **CLI 認証**: AWS CLI を使用する場合はコマンド出力前に認証状況を確認すること。
- **テンプレートのエンコーディング**: CloudFormation テンプレート（CDK 実行時に生成されるものを含む）に日本語が含まれるとエラーの原因になるため、論理 ID や説明文には英語を使用すること。
