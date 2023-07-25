import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AutoBuilderQueuesConstruct } from '../constructs/queue/queues-construct';
import { IQueue } from 'aws-cdk-lib/aws-sqs';

export interface AutoBuilderQueues {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
}

export class AutoBuilderQueueStack extends Stack {
  public readonly jobUpdatesQueue: IQueue;
  public readonly jobsQueue: IQueue;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const { jobUpdatesQueue, jobsQueue } = new AutoBuilderQueuesConstruct(this, 'queues');

    this.jobUpdatesQueue = jobUpdatesQueue;
    this.jobsQueue = jobsQueue;
  }
}
