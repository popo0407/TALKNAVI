#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { BackendStack } from '../lib/backend-stack';

const app = new cdk.App();
new BackendStack(app, 'BackendStack', {
  /* CDK CLIの認証情報（環境変数など）からアカウントとリージョンを自動取得する */
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
});
