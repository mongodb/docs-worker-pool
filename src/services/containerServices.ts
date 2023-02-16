import { ILogger } from './logger';
import {
  ECS,
  RunTaskRequest,
  RunTaskResponse,
  TaskOverride,
  KeyValuePair,
  ContainerOverride,
  NetworkConfiguration,
  AwsVpcConfiguration,
  LaunchType,
} from '@aws-sdk/client-ecs';
import c, { IConfig } from 'config';
import { readSync } from 'fs';

export interface IContainerServices {
  execute(jobId: string): Promise<any>;
}

export class ECSContainer implements IContainerServices {
  private _logger: ILogger;
  private _client: ECS;
  private _config: IConfig;
  constructor(config: IConfig, logger: ILogger) {
    this._logger = logger;
    this._config = config;
    this._client = new ECS({ region: config.get<string>('aws_region') });
  }
  async execute(jobId: string): Promise<any> {
    const name = this._config.get<string>('taskDefinitionFamily');
    const tdArn = await this.getTaskDefinitionArn(name);
    if (tdArn) {
      const runTaskParams = this.prepareECSRunTaskParams(tdArn, jobId, name, name);
      return await this._client.runTask(runTaskParams);
    }
    return null;
  }

  prepareECSRunTaskParams(arn: string, jobId: string, clusterName: string, containerName: string): RunTaskRequest {
    const envJobId: KeyValuePair = {
      name: 'jobId',
      value: jobId,
    };

    const jobsQueueUrl: KeyValuePair = {
      name: 'JOBS_QUEUE_URL',
      value: this._config.get('jobsQueueUrl'),
    };

    const jobUpdateUrl: KeyValuePair = {
      name: 'JOB_UPDATES_QUEUE_URL',
      value: this._config.get('jobUpdatesQueueUrl'),
    };

    const awsvpcConfig: AwsVpcConfiguration = {
      subnets: this._config.get('subnets'),
      assignPublicIp: 'DISABLED',
    };

    const networkConfig: NetworkConfiguration = {
      awsvpcConfiguration: awsvpcConfig,
    };

    const containerOverride: ContainerOverride = {
      name: containerName,
      environment: [envJobId, jobsQueueUrl, jobUpdateUrl],
      command: this._config.get('commandOverride'),
    };

    const taskOverride: TaskOverride = {
      containerOverrides: [containerOverride],
    };

    return {
      cluster: clusterName,
      taskDefinition: arn,
      overrides: taskOverride,
      launchType: LaunchType.FARGATE,
      networkConfiguration: networkConfig,
    };
  }

  async getTaskDefinitionArn(name: string): Promise<string | undefined> {
    const result = await this._client.describeTaskDefinition({ taskDefinition: name });
    if (result) {
      return result.taskDefinition?.taskDefinitionArn;
    }
    return '';
  }

  async stopZombieECSTask(taskId: string) {
    const clusterName = this._config.get<string>('taskDefinitionFamily');
    try {
      const res = await this._client.describeTasks({
        cluster: clusterName,
        tasks: [taskId],
      });

      // Only stop ECS task if it's still running
      if (res.tasks?.[0].lastStatus === 'RUNNING') {
        await this._client.stopTask({
          cluster: clusterName,
          task: taskId,
        });
      }
    } catch (error) {
      throw error;
    }
  }
}
