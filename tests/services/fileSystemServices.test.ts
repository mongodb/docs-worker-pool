import { TestDataProvider } from '../data/data';
import { FileSystemServices, axiosApi } from '../../services/fileServices';
import yaml from 'js-yaml';

import MockAdapter from 'axios-mock-adapter';

describe('FileSystemServices Tests', () => {
    let fileSystemServices: FileSystemServices;

    let mock;
    beforeEach(() => {
        mock = new MockAdapter(axiosApi);
        fileSystemServices = new FileSystemServices();
    })
    afterEach(() => {
        mock.reset();
    })
    test('Construct FileSystemServices', () => {
        expect(new FileSystemServices()).toBeDefined();
    })

    describe('FileSystemServices downloadYaml Tests', () => {
        test('FileSystemServices downloadYaml  succeeds', async() => {
            const testData = TestDataProvider.getSampleYamlFile('../data/sample.yaml');
            mock.onGet("test_yaml_url").reply(200, testData);
            const expected = yaml.safeLoad(testData)
            let resp = await fileSystemServices.downloadYaml('test_yaml_url');
            expect(resp.status).toBe('success');
            expect(resp.content).toEqual(expected);
            expect(mock.history.get.length).toBe(1);
        })

        test('FileSystemServices downloadYaml fails with an exception', async() => {
            mock.onGet("test_yaml_url").reply(500, "Invalid yaml");
            try {
                await fileSystemServices.downloadYaml('test_yaml_url');
            } catch (error) {
                expect(error.message).toBe("Request failed with status code 500")
            }
            expect(mock.history.get.length).toBe(1);
        })

        test('FileSystemServices downloadYaml fails with an errorcode', async() => {
            mock.onGet("test_yaml_url").reply(201, "Invalid yaml");
            let resp =await fileSystemServices.downloadYaml('test_yaml_url');
            expect(resp.status).toBe('failed');
            expect(resp.content.data).toBe("Invalid yaml");
            expect(mock.history.get.length).toBe(1);
        })
    })

    describe('FileSystemServices saveUrlAsFile Tests', () => {
        // test('FileSystemServices saveUrlAsFile  succeeds', async() => {
        //     mock.onGet("test_yaml_url").reply(200, "good content");
        //     let resp = await fileSystemServices.saveUrlAsFile('test_url', 'testPath',{
        //         encoding: 'utf8',
        //         flag: 'w'
        //     });
        //     expect(resp.status).toBe('success');
        //     expect(fs.writeFileSync.mock.calls).toHaveLength(1);
        // })

        test('FileSystemServices saveUrlAsFile fails with an invalid data', async() => {
            mock.onGet("test_url").reply(200, null);
            await expect(fileSystemServices.saveUrlAsFile('test_url', 'testPath', {})).rejects.toThrow(`Unable to download file test_url error: 200`);
        })

        test('FileSystemServices saveUrlAsFile fails with an non 200 errorcode', async() => {
            mock.onGet("test_url").reply(201, {"content":"accepted"});
            await expect(fileSystemServices.saveUrlAsFile('test_url', 'testPath', {})).rejects.toThrow(`Unable to download file test_url error: 201`);
        })
    });
})