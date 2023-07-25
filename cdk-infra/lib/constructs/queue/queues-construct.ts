import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class AutoBuilderQueuesConstruct extends Construct {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const maxReceiveCount = 3;

    const jobsQueueDlq = new Queue(this, 'jobsQueueDlq');

    const jobsQueue = new Queue(this, 'JobsQueue', {
      deadLetterQueue: {
        queue: jobsQueueDlq,
        maxReceiveCount,
      },
    });

    const jobUpdatesQueueDlq = new Queue(this, 'jobUpdatesQueueDlq');

    const jobUpdatesQueue = new Queue(this, 'JobUpdatesQueue', {
      deadLetterQueue: {
        queue: jobUpdatesQueueDlq,
        maxReceiveCount,
      },
    });

    this.jobsQueue = jobsQueue;
    this.jobUpdatesQueue = jobUpdatesQueue;
  }
}
