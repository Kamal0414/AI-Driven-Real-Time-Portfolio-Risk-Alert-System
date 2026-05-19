import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

/** Absolute path to the monorepo root package-lock.json. */
const REPO_LOCK_FILE = path.resolve(__dirname, '../../../package-lock.json');


/**
 * Props for the reusable NodeLambda construct.
 */
export interface NodeLambdaProps {
  /**
   * Absolute path to the handler entry file.
   * Example: path.join(__dirname, '../../services/portfolio-service/src/handlers/getPortfolio.ts')
   */
  entry: string;

  /** Exported handler function name (default: 'handler'). */
  handler?: string;

  /** Lambda function name (optional — CDK will auto-generate if omitted). */
  functionName?: string;

  /** Description shown in the AWS console. */
  description?: string;

  /** Memory in MB (default: 256 — sweet spot for Node.js cold starts). */
  memorySize?: number;

  /** Timeout (default: 15s for API handlers, override for async). */
  timeout?: cdk.Duration;

  /** Environment variables merged with defaults. */
  environment?: Record<string, string>;

  /** Lambda architecture (default: ARM64 — cheaper + faster). */
  architecture?: lambda.Architecture;

  /** Log retention (default: 1 week — Free Tier friendly). */
  logRetention?: logs.RetentionDays;

  /** Bundling options override (rarely needed). */
  bundling?: nodejs.BundlingOptions;
}

/**
 * NodeLambda — reusable construct for all Lambda functions in the system.
 *
 * Key decisions:
 * - Uses `NodejsFunction` (esbuild bundling) — no Docker needed, ~1-2 MB bundles.
 * - ARM64 (Graviton2) — 20% cheaper than x86, same or better performance.
 * - Node 20 runtime — latest LTS, supported by Lambda.
 * - 1-week log retention — keeps CloudWatch costs near zero.
 * - Tree-shaking + minification enabled for smallest cold starts.
 * - External AWS SDK v3 (Lambda runtime includes it — saves bundle size).
 */
export class NodeLambda extends Construct {
  public readonly function: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: NodeLambdaProps) {
    super(scope, id);

    this.function = new nodejs.NodejsFunction(this, 'Fn', {
      entry: props.entry,
      depsLockFilePath: REPO_LOCK_FILE,
      projectRoot: path.resolve(__dirname, '../../..'),
      handler: props.handler ?? 'handler',
      functionName: props.functionName,
      description: props.description,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: props.architecture ?? lambda.Architecture.ARM_64,
      memorySize: props.memorySize ?? 256,
      timeout: props.timeout ?? cdk.Duration.seconds(15),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        ...props.environment,
      },
      logRetention: props.logRetention ?? logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.DISABLED, // Enable X-Ray later if needed
      bundling: props.bundling ?? {
        minify: true,
        sourceMap: true,
        target: 'es2022',
        format: nodejs.OutputFormat.ESM,
        mainFields: ['module', 'main'],
        // AWS SDK v3 is included in the Lambda runtime — don't bundle it.
        externalModules: [
          '@aws-sdk/*',
          '@aws-lambda-powertools/*',
        ],
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    });
  }
}
