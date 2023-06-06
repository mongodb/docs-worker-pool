import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class AutoBuilderQueuesConstruct extends Construct {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const jobsQueue = new Queue(this, 'JobsQueue');
    const jobUpdatesQueue = new Queue(this, 'JobUpdatesQueue');

    this.jobsQueue = jobsQueue;
    this.jobUpdatesQueue = jobUpdatesQueue;
  }
}
