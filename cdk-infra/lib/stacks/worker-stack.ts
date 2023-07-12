import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { WorkerConstruct } from '../constructs/worker/worker-construct';
import { WorkerEnvConstruct } from '../constructs/worker/worker-env-construct';
import { WorkerBucketsConstruct } from '../constructs/worker/buckets-construct';
import { AutoBuilderQueues } from './auto-builder-queue-stack';
import { IVpc } from 'aws-cdk-lib/aws-ec2';

interface WorkerStackProps extends StackProps {
  workerSecureStrings: Record<string, string>;
  queues: AutoBuilderQueues;
  vpc: IVpc;
}

export class WorkerStack extends Stack {
  public readonly clusterName: string;

  constructor(scope: Construct, id: string, { queues, workerSecureStrings, vpc, ...props }: WorkerStackProps) {
    super(scope, id, props);

    const { environment } = new WorkerEnvConstruct(this, 'workerSsmVars', {
      ...queues,
      secureStrings: workerSecureStrings,
    });

    const { clusterName, ecsTaskRole } = new WorkerConstruct(this, 'worker', {
      vpc,
      dockerEnvironment: environment,
      ...queues,
    });
    const { buckets } = new WorkerBucketsConstruct(this, 'workerBuckets');

    buckets.forEach((bucket) => {
      bucket.grantReadWrite(ecsTaskRole);
    });

    this.clusterName = clusterName;
  }
}
