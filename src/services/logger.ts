import { JobRepository } from '../repositories/jobRepository';

export interface ILogger {
  info(contextId: string, message: string): void;
  warn(contextId: string, message: string): void;
  error(contextId: string, message: string): void;
}

export interface IJobRepoLogger extends ILogger {
  save(contextId: string, message: string): Promise<void>;
}

export class ConsoleLogger implements ILogger {
  info(contextId: string, message: string): void {
    console.info(`Context: ${contextId} message: ${message}`);
  }
  warn(contextId: string, message: string): void {
    console.warn(`Context: ${contextId} message: ${message}`);
  }
  error(contextId: string, message: string): void {
    console.error(`Context: ${contextId} message: ${message}`);
  }
}

export class HybridJobLogger extends ConsoleLogger implements IJobRepoLogger {
  _jobRepo: JobRepository;
  constructor(jobRepo: JobRepository) {
    super();
    this._jobRepo = jobRepo;
  }
  async save(contextId: string, message: string): Promise<void> {
    try {
      this.info(contextId, message);
      await this._jobRepo.insertLogStatement(contextId, [message]);
    } catch (err) {
      this.error(contextId, err);
    }
  }
}
