const fs = require('fs');
const { LoggerClass } = require('../../utils/logger');
const Logger = require('../../utils/logger').LoggerClass;

/** these tests are for the Logger component */

const data = fs.readFileSync('tests/unit/documents/stage.output.txt', 'utf8').toString();
const noData = fs.readFileSync('tests/unit/documents/stage.output.none.txt', 'utf8').toString();

describe('Test Logger', () => {
    // Dont actually reset the directory and dont care about the logging
    beforeAll(() => {

    });
    //  Tests for build() function
    it('slack output is trimmed', async () => {
        const returnString = await LoggerClass.trimOutputForUserFacingLogMessages(data);
        const returnStringArray = (await returnString).split('\n');
        expect(returnStringArray).toHaveLength(10);
    });
    it('slack output is empty where appropriate', async () => {
        const returnString = await LoggerClass.trimOutputForUserFacingLogMessages(noData);
        expect(returnString).toBe('');
    });
    it('test that slack doesnt pubish empty logs', async () => {
        const logger = new Logger(null);
        logger.sendSlackMsg = jest.fn().mockResolvedValue();
        await logger.filterOutputForUserLogs(noData);
        expect(logger.sendSlackMsg).toHaveBeenCalledTimes(0);
    });
    it('test that slack pubishes non-empty logs', async () => {
        const logger = new Logger(null);
        logger.sendSlackMsg = jest.fn().mockResolvedValue();
        await logger.filterOutputForUserLogs(data);
        expect(logger.sendSlackMsg).toHaveBeenCalledTimes(1);
    });
});
