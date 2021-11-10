import { TestDataProvider } from '../../data/data';
import { JobSpecificCommandExecutor } from '../../../src/services/commandExecutor';
import cp from 'child_process';
jest.mock('child_process');

describe('JobSpecificCommandExecutor Tests', () => {
    let commandExecutor: JobSpecificCommandExecutor;

    beforeEach(() => {
        commandExecutor = new JobSpecificCommandExecutor();
    })

    afterEach(() => {
        jest.resetAllMocks();
    })

    test('Construct JobSpecificCommandExecutor', () => {
        expect(new JobSpecificCommandExecutor()).toBeDefined();
    })

    describe('JobSpecificCommandExecutor getSnootyProjectName Tests', () => {
        test('JobSpecificCommandExecutor getSnootyProjectName  succeeds', async() => {
            const testData = TestDataProvider.getCommandsForSnootyProjectName("test_repo");
            cp.execSync.mockImplementation((command, options, callback) => Buffer.from('test_repo_project_snooty_name'));
            let resp = await commandExecutor.getSnootyProjectName('test_repo');
            expect(resp.error).toBe(undefined);
            expect(resp.output).toBe('test_repo_project_snooty_name');
            expect(resp.status).toBe('success');
            expect(cp.execSync.mock.calls[0][0]).toEqual(testData.join(' && '));
            expect(cp.execSync).toBeCalledTimes(1);
        })

        test('JobSpecificCommandExecutor getSnootyProjectName  fails return proper response', async() => {
            const testData = TestDataProvider.getCommandsForSnootyProjectName("test_repo");
            cp.execSync.mockImplementation((command, options, callback) => {
                throw Error("Test error");
                // callback(null, {stdErr: "invalid command", stdout: 'test_repo_project_snooty_name' });
            });
            let resp = await commandExecutor.getSnootyProjectName('test_repo');
            expect(resp.error).not.toBe(undefined);
            expect(resp.output).toBe(null);
            expect(resp.status).toBe('failed');
        })
    })

    describe('JobSpecificCommandExecutor getServerUser Tests', () => {
        test('JobSpecificCommandExecutor getServerUser  succeeds', async() => {
            const testData = TestDataProvider.getCommandsForGetServerUser("test_repo");
            cp.execSync.mockImplementation((command, options, callback) => Buffer.from('test_user_in_test_machine'));
            let resp = await commandExecutor.getServerUser();
            expect(resp.error).toBe(undefined);
            expect(resp.output).toBe('test_user_in_test_machine');
            expect(resp.status).toBe('success');
            expect(cp.execSync.mock.calls[0][0]).toEqual(testData.join(' && '));
            expect(cp.execSync).toBeCalledTimes(1);
        })
    })
})