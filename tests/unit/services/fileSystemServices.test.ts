import { FileSystemServices, axiosApi } from '../../../services/fileServices';
import yaml from 'js-yaml';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs-extra';
jest.mock('fs-extra');
describe('FileSystemServices Tests', () => {
    let fileSystemServices: FileSystemServices;

    let mock;
    beforeEach(() => {
        mock = new MockAdapter(axiosApi);
        fileSystemServices = new FileSystemServices();
        fs.existsSync.mockClear();
        fs.readdirSync.mockClear();
        fs.statSync.mockClear();
        fs.mkdirSync.mockClear();
        fs.removeSync.mockClear();
        fs.writeFileSync.mockClear();
    })
    test('Construct FileSystemServices', () => {
        expect(new FileSystemServices()).toBeDefined();
    })

    describe('FileSystemServices downloadYaml Tests', () => {
        test('FileSystemServices downloadYaml  succeeds', async() => {
            mock.onGet("test_yaml_url").reply(200, "Sample");
            const expected = yaml.safeLoad("Sample")
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
        test('FileSystemServices saveUrlAsFile  succeeds', async() => {
            mock.onGet("test_url").reply(200, "good content");
            let resp = await fileSystemServices.saveUrlAsFile('test_url', 'testPath',{
                encoding: 'utf8',
                flag: 'w'
            });
            expect(resp).toBe(true);
            expect(fs.writeFileSync.mock.calls).toHaveLength(1);
            expect(fs.writeFileSync.mock.calls[0][0]).toEqual('testPath');
            expect(fs.writeFileSync.mock.calls[0][1]).toEqual('good content');
            expect(fs.writeFileSync.mock.calls[0][2]).toEqual({
                encoding: 'utf8',
                flag: 'w'
            });
        })

        test('FileSystemServices saveUrlAsFile fails with an invalid data', async() => {
            mock.onGet("test_url").reply(200, null);
            await expect(fileSystemServices.saveUrlAsFile('test_url', 'testPath', {})).rejects.toThrow(`Unable to download file test_url error: 200`);
        })

        test('FileSystemServices saveUrlAsFile fails with an non 200 errorcode', async() => {
            mock.onGet("test_url").reply(201, {"content":"accepted"});
            await expect(fileSystemServices.saveUrlAsFile('test_url', 'testPath', {})).rejects.toThrow(`Unable to download file test_url error: 201`);
        })
    });

    describe('FileSystemServices getFilesInDirectory Tests', () => {
        test('FileSystemServices getFilesInDirectory  succeeds non recursive', () => {
            fs.existsSync.mockReturnValueOnce(true);
            
            fs.readdirSync.mockReturnValueOnce(["file1", "file2", "file2"]);
            fs.statSync.mockReturnValue({
                isDirectory() {
                    return false;
                }
            })
            let resp = fileSystemServices.getFilesInDirectory('testPath', '');

            expect(resp).toEqual(["testPath/file1", "testPath/file2", "testPath/file2"]);
            expect(fs.existsSync.mock.calls).toHaveLength(1);

            expect(fs.readdirSync.mock.calls).toHaveLength(1);
            expect(fs.readdirSync.mock.calls[0][0]).toEqual('testPath');
            expect(fs.statSync.mock.calls).toHaveLength(3);
        })

        test('FileSystemServices getFilesInDirectory  succeeds non recursive with ext', () => {
            fs.existsSync.mockReturnValueOnce(true);
            
            fs.readdirSync.mockReturnValueOnce(["file1", "file2.txt", "file3.txt"]);
            fs.statSync.mockReturnValue({
                isDirectory() {
                    return false;
                }
            })
            let resp = fileSystemServices.getFilesInDirectory('testPath', 'txt');

            expect(resp).toEqual(["testPath/file2.txt", "testPath/file3.txt"]);
            expect(fs.existsSync.mock.calls).toHaveLength(1);

            expect(fs.readdirSync.mock.calls).toHaveLength(1);
            expect(fs.readdirSync.mock.calls[0][0]).toEqual('testPath');
            expect(fs.statSync.mock.calls).toHaveLength(3);
        })


        test('FileSystemServices getFilesInDirectory  returns empty for a non existing base path', () => {
            fs.existsSync.mockReturnValueOnce(false);
            let resp = fileSystemServices.getFilesInDirectory('testPath', '');
            expect(resp).toEqual([""]);
            expect(fs.existsSync.mock.calls).toHaveLength(1);
            expect(fs.readdirSync.mock.calls).toHaveLength(0);
            expect(fs.statSync.mock.calls).toHaveLength(0);
        })

        test('FileSystemServices getFilesInDirectory  succeeds recursive', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockImplementation((p) => {
                if (p == 'testPath') {
                    return ["file1", "file2", "file3"];
                } else if (p == "testPath/file2") {
                    return ["file4", "file5"];
                }
            });
            fs.statSync.mockImplementation((p) => {
                if (p == 'testPath/file2') {
                    return {
                        isDirectory() {
                        return true;
                    } };
                } else {
                    return {
                        isDirectory() {
                        return false;
                    } };
                }
                   
                });
            let resp = fileSystemServices.getFilesInDirectory('testPath', '');

            expect(resp).toEqual(["testPath/file1", "testPath/file2/file4", "testPath/file2/file5", "testPath/file3"]);
            expect(fs.existsSync.mock.calls).toHaveLength(2);

            expect(fs.readdirSync.mock.calls).toHaveLength(2);
            expect(fs.statSync.mock.calls).toHaveLength(5);
        })
    });

    describe('FileSystemServices resetDirectory Tests', () => {
        test('FileSystemServices resetDirectory  succeeds', () => {
            fileSystemServices.resetDirectory('testPath');
            expect(fs.removeSync.mock.calls).toHaveLength(1);
            expect(fs.mkdirSync.mock.calls).toHaveLength(1);
        })
    });

    describe('FileSystemServices fileExists Tests', () => {
        test('FileSystemServices fileExists  succeeds', () => {
            fileSystemServices.fileExists('testPath');
            expect(fs.existsSync.mock.calls).toHaveLength(1);
            expect(fs.existsSync.mock.calls[0][0]).toEqual('./testPath');
        })
    });

    describe('FileSystemServices rootFileExists Tests', () => {
        test('FileSystemServices rootFileExists  succeeds', () => {
            fileSystemServices.rootFileExists('testPath');
            expect(fs.existsSync.mock.calls).toHaveLength(1);
            expect(fs.existsSync.mock.calls[0][0]).toEqual('testPath');
        })
    });

    describe('FileSystemServices writeToFile Tests', () => {
        test('FileSystemServices writeToFile  succeeds', () => {
            fileSystemServices.writeToFile('testPath', "sometext", {});
            expect(fs.writeFileSync.mock.calls).toHaveLength(1);
            expect(fs.writeFileSync.mock.calls[0][0]).toEqual('testPath');
            expect(fs.writeFileSync.mock.calls[0][1]).toEqual('sometext');
            expect(fs.writeFileSync.mock.calls[0][2]).toEqual({});
        })
    });

    describe('FileSystemServices ReadfileAsUTF8 Tests', () => {
        test('FileSystemServices readFileAsUtf8  succeeds', () => {
            fileSystemServices.readFileAsUtf8('testPath');
            expect(fs.readFileSync.mock.calls).toHaveLength(1);
            expect(fs.readFileSync.mock.calls[0][0]).toEqual('testPath');
            expect(fs.readFileSync.mock.calls[0][1]).toEqual( { "encoding": 'utf8' });
        })
    });

    describe('FileSystemServices removeDirectory Tests', () => {
        test('FileSystemServices removeDirectory  file not exists return false', () => {
            fs.existsSync.mockReturnValueOnce(false);
            const resp = fileSystemServices.removeDirectory('testPath');
            expect(resp).toBe(false);
            expect(fs.existsSync.mock.calls).toHaveLength(1);
            expect(fs.existsSync.mock.calls[0][0]).toEqual('./testPath');
            expect(fs.removeSync.mock.calls).toHaveLength(0);
        })

        test('FileSystemServices removeDirectory  file exists returns true', () => {
            fs.existsSync.mockReturnValueOnce(true);
            const resp = fileSystemServices.removeDirectory('testPath');
            expect(resp).toBe(true);
            expect(fs.existsSync.mock.calls).toHaveLength(1);
            expect(fs.existsSync.mock.calls[0][0]).toEqual('./testPath');
            expect(fs.removeSync.mock.calls).toHaveLength(1);
            expect(fs.removeSync.mock.calls[0][0]).toEqual('./testPath');
        })
    });
})