import { HybridJobLogger } from '../../../src/services/logger';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { sensitiveKeys } from '../../../src/enhanced/utils/get-sensitive-values';
import { mockDeep } from 'jest-mock-extended';

describe('HybridJobLogger Tests', () => {
  let hybridJobLogger: HybridJobLogger;
  let jobRepo: JobRepository;
  let warnSpy;
  let infoSpy;
  let errorSpy;
  beforeEach(() => {
    jobRepo = mockDeep<JobRepository>();
    hybridJobLogger = new HybridJobLogger(jobRepo);

    // Maintain clean test output by mocking the console
    warnSpy = jest.spyOn(global.console, 'warn').mockImplementation(() => {
      /* do nothing */
    });
    infoSpy = jest.spyOn(global.console, 'info').mockImplementation(() => {
      /* do nothing */
    });
    errorSpy = jest.spyOn(global.console, 'error').mockImplementation(() => {
      /* do nothing */
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('HybridJobLogger Constructor', () => {
    expect(hybridJobLogger).toBeDefined();
  });

  describe('HybridJobLogger Base ConsoleLogger Tests', () => {
    test('HybridJobLogger Base ConsoleLogger info  succeeds', () => {
      hybridJobLogger.info('TestContext', 'testMessage');
      expect(console.info).toBeCalledWith(`Context: TestContext message: testMessage`);
      expect(console.info.mock.calls).toHaveLength(1);
    });

    test('HybridJobLogger Base ConsoleLogger warn  succeeds', () => {
      hybridJobLogger.warn('TestContext', 'testMessage');
      expect(console.warn).toBeCalledWith(`Context: TestContext message: testMessage`);
      expect(console.warn.mock.calls).toHaveLength(1);
    });

    test('HybridJobLogger Base ConsoleLogger error  succeeds', () => {
      hybridJobLogger.error('TestContext', 'testMessage');
      expect(console.error).toBeCalledWith(`Context: TestContext message: testMessage`);
      expect(console.error.mock.calls).toHaveLength(1);
    });
  });

  describe('HybridJobLogger derived Tests', () => {
    test('HybridJobLogger save succeeds', async () => {
      await hybridJobLogger.save('TestContext', 'testMessage');
      expect(console.info).toBeCalledWith(`Context: TestContext message: testMessage`);
      expect(console.info.mock.calls).toHaveLength(1);
      expect(jobRepo.insertLogStatement.mock.calls).toHaveLength(1);
    });
  });

  describe('HybridJobLogger Redact Test', () => {
    test('HybridJobLogger redacts secrets from the message', async () => {
      sensitiveKeys.push('my_secret');
      await hybridJobLogger.save('SensitiveKeyContext', 'Oops I just logged my_secret');
      expect(console.info).toBeCalledWith('Context: SensitiveKeyContext message: Oops I just logged *******');
      expect(console.info.mock.calls).toHaveLength(1);
      expect(jobRepo.insertLogStatement.mock.calls).toHaveLength(1);
    });
  });
});
