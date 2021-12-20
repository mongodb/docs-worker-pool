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

    describe('JobSpecificCommandExecutor getServerUser Tests', () => {
        test('JobSpecificCommandExecutor getServerUser  succeeds', async() => {
            const testData = TestDataProvider.getCommandsForGetServerUser("test_repo");
            cp.exec.mockImplementation((command, callback) => {
                callback(null, { stdout: 'test_user_in_test_machine' });
            });
            let resp = await commandExecutor.getServerUser();
            expect(resp.error).toBe(undefined);
            expect(resp.output).toBe('test_user_in_test_machine');
            expect(resp.status).toBe('success');
            expect(cp.exec.mock.calls[0][0]).toEqual(testData.join(' && '));
            expect(cp.exec).toBeCalledTimes(1);
        })
    })
})