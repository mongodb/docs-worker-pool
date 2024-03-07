import { JobRepository } from '../repositories/jobRepository';
import { filterSensitiveValues } from '../enhanced/utils/filter-sensitive-values';

export interface ILogger {
  info(contextId: string, message: string): void;
  warn(contextId: string, message: string): void;
  error(contextId: string, message: string): void;
}

export interface IJobRepoLogger extends ILogger {
  save(contextId: string, message: string): Promise<void>;
}

export class ConsoleLogger implements ILogger {
  private filterMessage(message: string) {
    return filterSensitiveValues(message);
  }
  info(contextId: string, message: string): void {
    console.info(`Context: ${contextId} message: ${this.filterMessage(message)}`);
  }
  warn(contextId: string, message: string): void {
    console.warn(`Context: ${contextId} message: ${this.filterMessage(message)}`);
  }
  error(contextId: string, message: string): void {
    console.error(`Context: ${contextId} message: ${this.filterMessage(message)}`);
  }
}

export class HybridJobLogger extends ConsoleLogger implements IJobRepoLogger {
  _jobRepo: JobRepository;
  constructor(jobRepo: JobRepository) {
    super();
    this._jobRepo = jobRepo;
  }
  async save(contextId: string, message: string): Promise<void> {
    message = filterSensitiveValues(message);
    try {
      this.info(contextId, message);
      await this._jobRepo.insertLogStatement(contextId, [message]);
    } catch (err) {
      this.error(contextId, err);
    }
  }
}
