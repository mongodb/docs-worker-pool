import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { WorkerConstruct } from '../constructs/worker/worker-construct';
import { WorkerEnvConstruct } from '../constructs/worker/worker-env-construct';
import { WorkerBucketsConstruct } from '../constructs/worker/buckets-construct';
import { AutoBuilderQueues } from './auto-builder-queue-stack';

interface WorkerStackProps extends StackProps {
  workerSecureStrings: Record<string, string>;
  queues: AutoBuilderQueues;
}

export class WorkerStack extends Stack {
  public readonly clusterName: string;

  constructor(scope: Construct, id: string, { queues, workerSecureStrings, ...props }: WorkerStackProps) {
    super(scope, id, props);

    const { environment: workerEnvironment } = new WorkerEnvConstruct(this, 'workerSsmVars', {
      ...queues,
      secureStrings: workerSecureStrings,
    });

    const { clusterName, ecsTaskRole } = new WorkerConstruct(this, 'worker', {
      environment: workerEnvironment,
      ...queues,
    });
    const { buckets } = new WorkerBucketsConstruct(this, 'workerBuckets');

    buckets.forEach((bucket) => {
      bucket.grantReadWrite(ecsTaskRole);
    });

    this.clusterName = clusterName;
  }
}
