param (
    [Parameter(Mandatory = $true)]
    [string]$Profile
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 デプロイを開始します (Profile: $Profile)" -ForegroundColor Cyan

# 1. フロントエンドのビルド
Write-Host "`n[1/3] フロントエンドをビルド中..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot/../frontend"
npm install
npm run build
Pop-Location

# 2. バックエンド（Lambda）のビルド
Write-Host "`n[2/3] バックエンド(Lambda)をビルド中..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot/../backend"
npm install
npm run build:lambda
Pop-Location

# 3. AWSへのデプロイ
Write-Host "`n[3/3] AWSリソースをデプロイ中..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot/../backend"
npx cdk deploy --all --require-approval never --profile $Profile
Pop-Location

Write-Host "`n✅ すべての工程が完了しました！" -ForegroundColor Green
