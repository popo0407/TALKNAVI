param (
    [Parameter(Mandatory = $false)]
    [string]$Profile
)

$ErrorActionPreference = "Stop"

$profileArgs = if ($Profile) { "--profile $Profile" } else { "" }

Write-Host "🚀 デプロイを開始します" -ForegroundColor Cyan
if ($Profile) { Write-Host "(Profile: $Profile)" -ForegroundColor Gray }

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

# 3. AWSの準備とデプロイ
Write-Host "`n[3/3] AWSリソースを準備・デプロイ中..." -ForegroundColor Yellow
Push-Location "$PSScriptRoot/../backend"

# Bootstrap (環境の初期化) を実行
Write-Host "Checking AWS environment (Bootstrap)..." -ForegroundColor Gray
Invoke-Expression "npx cdk bootstrap $profileArgs"

# デプロイを実行
Write-Host "Deploying stacks..." -ForegroundColor Gray
Invoke-Expression "npx cdk deploy --all --require-approval never $profileArgs"
Pop-Location

Write-Host "`n✅ すべての工程が完了しました！" -ForegroundColor Green
