import fs from 'fs-extra';
import axios from 'axios';
import path from 'path';
import yaml from 'js-yaml';
import { InvalidJobError } from '../errors/errors';
export interface IFileSystemServices {
    resetDirectory(dir: string): void;
    getFilesInDirectory(base: string, ext: string): Array<string>;
    resetDirectory(dir: string): void;
    fileExists(dir: string): boolean;
    rootFileExists(dir: string): boolean;
    writeToFile(fileName: string, text: string, options: any): void;
    removeDirectory(dir: string): boolean;
    readFileAsUtf8(filePath: string): string;
    saveUrlAsFile(url: string, path: string, options: any): any;
    downloadYaml(url): Promise<any>;

}

export class FileSystemServices implements IFileSystemServices {

    private async download(url: string): Promise<any> {
        return await axios.get(url);
    }

    private isDownloadSuccess(resp): boolean {
        return (resp?.status == 200 && resp?.data);
    }

    async downloadYaml(url: any): Promise<any> {
        let resp = await this.download(url);
        const returnObject = {};
        if (this.isDownloadSuccess(resp)) {
            const yamlParsed = yaml.safeLoad(resp.data);
            returnObject['status'] = 'success';
            returnObject['content'] = yamlParsed;
        } else {
            returnObject['status'] = 'failure';
            returnObject['content'] = resp;
        }
        return returnObject;
    }

    async saveUrlAsFile(url: string, path: string, options: any): Promise<any> {
        let resp = await this.download(url);
        if (resp && resp.status == 200 && resp.data) {
            return this.writeToFile(path, resp.data, options);
        } else {
            throw new InvalidJobError(`Unable to download file ${url} error: ${resp}`)
        }
    }

    getFilesInDirectory(base: string, ext: string): Array<string> {
        if (fs.existsSync(base)) {
            const filesInternal = fs.readdirSync(base);
            let resultInternal = new Array<string>();
            filesInternal.forEach(file => {
                const newbase = path.join(base, file);
                if (fs.statSync(newbase).isDirectory()) {
                    resultInternal = module.exports.getFilesInDir(
                        newbase,
                        ext,
                        fs.readdirSync(newbase),
                        resultInternal
                    );
                } else if (ext === '' || file.substr(-1 * (ext.length + 1)) === `.${ext}`) {
                    resultInternal.push(newbase);
                }
            });
            return resultInternal;
        }
        return ['']

    }

    resetDirectory(dir: string): void {
        fs.removeSync(dir);
        fs.mkdirsSync(dir);
    }

    fileExists(dir: string): boolean {
        return fs.existsSync('./' + dir);
    }

    rootFileExists(dir: string): boolean {
        return fs.existsSync(dir);
    }

    writeToFile(fileName: string, text: string, options: any): void {
        return fs.writeFileSync(fileName, text, options);
    }

    removeDirectory(dir): boolean {
        if (this.fileExists(dir)) {
            fs.removeSync('./' + dir);
            return true;
        }
        return false;
    }

    readFileAsUtf8(filePath: string): string {
        return fs.readFileSync(filePath, { "encoding": 'utf8' });
    }

}


