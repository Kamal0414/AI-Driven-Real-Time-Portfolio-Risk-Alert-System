# Deployment Guide

End-to-end instructions for deploying the system to AWS, written for first-time AWS users.

## Prerequisites

### 1. Software you need on your machine

| Tool | Why | Install |
|------|-----|---------|
| **Node.js 20+** | Runtime for CDK + Lambdas | https://nodejs.org/ |
| **AWS CLI v2** | Authenticate with AWS from terminal | https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html |
| **AWS account** | Where everything will run | https://aws.amazon.com/free/ |

You do NOT need to install CDK separately - it's pulled in via npm.

### 2. AWS account setup (one-time)

1. **Sign up for AWS Free Tier:** https://aws.amazon.com/free/
2. **Create an IAM user with admin access** (for personal projects only):
   - AWS Console -> IAM -> Users -> "Create user"
   - User name: `cdk-deployer`
   - Attach policy: `AdministratorAccess`
   - Click into the user -> "Security credentials" -> "Create access key" -> "Command Line Interface (CLI)"
   - **Save the Access Key ID and Secret Access Key** - you need them next
3. **Configure the AWS CLI:**
   ```bash
   aws configure
   ```
   Enter:
   - AWS Access Key ID: (from step 2)
   - AWS Secret Access Key: (from step 2)
   - Default region: `us-east-1` (or any region you prefer)
   - Default output format: `json`

4. **Test it works:**
   ```bash
   aws sts get-caller-identity
   ```
   Should return your account number and user ARN.

## One-time CDK Bootstrap

CDK needs an S3 bucket + IAM roles in your account before its first deployment.
Run this once per region:

```bash
cd infra
npx cdk bootstrap
```

You should see "Environment aws://YOUR_ACCOUNT/us-east-1 bootstrapped."

## Deploy Everything

```bash
# From the repo root
npm install
npm run build -w @prr/shared

# From infra/
cd infra
npx cdk deploy --all --require-approval never
```

This creates ~30 AWS resources across 7 stacks. First deploy takes ~5-10 minutes.

When it finishes, **save these outputs**:

```
prr-api.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com
```

## Seed the Database

After the first deploy, the DynamoDB tables are empty. Load 100 demo portfolios:

```bash
# From the repo root
npm run seed -w @prr/portfolio-service
```

You should see:
```
Generating 100 portfolios...
Validation: 100/100 portfolios valid
Writing to DynamoDB...
Successfully seeded 100 portfolios
```

The Market Data Lambda starts running automatically (every 7s),
so the Risk Service will start computing valuations immediately
and the AI Service will generate insights as breaches occur.

## Run the Dashboard

```bash
cd frontend/dashboard
cp .env.example .env.local
# Edit .env.local - set VITE_API_URL to the prr-api.ApiUrl value from CDK
npm run dev
```

Open http://localhost:5173 - you should see all 100 portfolios and live alerts streaming in.

## Verify Everything Works

```bash
# Check the Market Data Lambda is running every 7s
aws logs tail /aws/lambda/prr-market-tick --follow

# Check Risk Service is processing
aws logs tail /aws/lambda/prr-risk-on-price --follow

# Check AI Service is generating insights
aws logs tail /aws/lambda/prr-ai-on-breach --follow

# Quick API smoke test
curl https://YOUR_API_URL/portfolios
# Should return: {"ok":true,"data":{"portfolios":[...],"count":100}}

curl https://YOUR_API_URL/insights/latest
# Should return: {"ok":true,"data":{"insights":[...],"count":N}}
```

## Tear Down (when done with the demo)

To delete all AWS resources and stop billing:

```bash
cd infra
npx cdk destroy --all --force
```

This removes everything - tables, Lambdas, queues, the API. Free tier
credits are not consumed when nothing exists.

## Cost Expectations

Running 24/7 with the default 7-second tick:

| Service | Monthly Cost |
|---------|-------------|
| Lambda invocations | $0 (within free tier) |
| EventBridge | <$1 |
| DynamoDB on-demand | $1-3 (mostly writes) |
| API Gateway | $0 (within free tier) |
| CloudWatch Logs | $0 (1-week retention, <1GB) |
| **TOTAL** | **~$1-3/month** |

To drop to **$0** between demos, just `cdk destroy --all`.

## Hosting the Dashboard (optional)

For a publicly accessible demo, host the dashboard on S3 + CloudFront:

```bash
# Build the dashboard
cd frontend/dashboard
npm run build

# Create an S3 bucket and upload
aws s3 mb s3://prr-dashboard-yourname
aws s3 sync dist/ s3://prr-dashboard-yourname --delete
aws s3 website s3://prr-dashboard-yourname --index-document index.html
```

For HTTPS + custom domain, put a CloudFront distribution in front
(both within Free Tier).

## Troubleshooting

### `cdk deploy` fails with "no credentials"
Run `aws configure` again or check `aws sts get-caller-identity`.

### Lambdas time out / OOM
Bump memory in `infra/lib/stacks/risk-stack.ts` - `memorySize: 1024`.

### Dashboard shows "Network error"
Check `VITE_API_URL` in `.env.local` matches the deployed `ApiUrl`.
Also verify CORS preflight isn't blocked - the API has CORS open by default.

### "PriceUpdated event not firing"
Check the Scheduler in AWS Console -> EventBridge -> Scheduler -> Schedules.
Should show "ENABLED" state.

### "AI Lambda DLQ has messages"
Check the DLQ in SQS console: `prr-ai-insight-dlq`. Drain via:
```bash
aws sqs purge-queue --queue-url $(aws sqs get-queue-url --queue-name prr-ai-insight-dlq --query QueueUrl --output text)
```

### `npm install` fails on Windows
Some npm packages need build tools. Install:
```bash
npm install --global windows-build-tools
```
Or use WSL2 for a smoother experience.
