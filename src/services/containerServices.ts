import { ILogger } from './logger';
import ECS, {
  RunTaskRequest,
  RunTaskResponse,
  TaskOverride,
  KeyValuePair,
  ContainerOverride,
} from 'aws-sdk/clients/ecs';
import c from 'config';
import { JobQueueMessage } from '../entities/queueMessage';
import { getDefaultSettings } from 'http2';

export interface IContainerServices {
  execute(jobId: string): Promise<any>;
}

export class ECSContainer implements IContainerServices {
  private _logger: ILogger;
  private _client: ECS;
  constructor(logger: ILogger) {
    this._logger = logger;
    this._client = new ECS({ region: c.get<string>('aws_region') });
  }
  async execute(jobId: string): Promise<any> {
    const tdArn = await this.getTaskDefinitionArn();
    const name = c.get<string>('taskDefinitionFamily');
    const runTaskParams = this.prepareECSRunTaskParams(tdArn, jobId, name, name);
    return await this._client.runTask(runTaskParams).promise();
  }

  prepareECSRunTaskParams(arn: string, jobId: string, clusterName: string, containerName: string): RunTaskRequest {
    const envJobId: KeyValuePair = {
      name: 'jobId',
      value: jobId,
    };

    const containerOverride: ContainerOverride = {
      name: containerName,
      environment: [envJobId],
      command: c.get('commandOverride'),
    };

    const taskOverride: TaskOverride = {
      containerOverrides: [containerOverride],
    };

    return {
      cluster: clusterName,
      taskDefinition: arn,
      overrides: taskOverride,
    };
  }

  async getTaskDefinitionArn(): Promise<string> {
    const result = await this._client
      .describeTaskDefinition({ taskDefinition: c.get<string>('taskDefinitionFamily') })
      .promise();
    if (result && 'taskDefinitionArn' in result) {
      return result['taskDefinitionArn'];
    }
    return '';
  }
}
