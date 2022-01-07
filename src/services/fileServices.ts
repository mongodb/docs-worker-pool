import fs from 'fs-extra';
import axios from 'axios';
import path from 'path';
import yaml from 'js-yaml';
import { InvalidJobError } from '../errors/errors';

export const axiosApi = axios.create();

export interface IFileSystemServices {
  resetDirectory(dir: string): void;
  getFilesInDirectory(base: string, ext: string, files: string[] | null, result: string[] | null): Array<string>;
  fileExists(dir: string): boolean;
  rootFileExists(dir: string): boolean;
  writeToFile(fileName: string, text: string, options: any): void;
  removeDirectory(dir: string): boolean;
  readFileAsUtf8(filePath: string): string;
  saveUrlAsFile(url: string, path: string, options: any): any;
  downloadYaml(url): Promise<any>;
  createDirIfNotExists(dir: string): void;
}

export class FileSystemServices implements IFileSystemServices {
  createDirIfNotExists(dir: string): void {
    if (fs.existsSync(dir)) {
      return;
    }
    fs.mkdirSync(dir);
  }

  private async download(url: string): Promise<any> {
    return await axiosApi.get(url);
  }

  private isDownloadSuccess(resp): boolean {
    return resp?.status == 200 && resp?.data;
  }

  async downloadYaml(url: any): Promise<any> {
    const resp = await this.download(url);
    const returnObject = {};
    if (this.isDownloadSuccess(resp)) {
      const yamlParsed = yaml.safeLoad(resp.data);
      returnObject['status'] = 'success';
      returnObject['content'] = yamlParsed;
    } else {
      returnObject['status'] = 'failed';
      returnObject['content'] = resp;
    }
    return returnObject;
  }

  async saveUrlAsFile(url: string, path: string, options: any): Promise<boolean> {
    const resp = await this.download(url);
    if (resp && resp.status == 200 && resp.data) {
      this.writeToFile(path, resp.data, options);
    } else {
      throw new InvalidJobError(`Unable to download file ${url} error: ${resp?.status}`);
    }
    return true;
  }

  getFilesInDirectory(base: string, ext: string, files: any = null, result: any = null): Array<string> {
    if (fs.existsSync(base)) {
      const filesInternal = files || fs.readdirSync(base);
      let resultInternal = result || new Array<string>();
      filesInternal.forEach((file) => {
        const newbase = path.join(base, file);
        if (fs.statSync(newbase).isDirectory()) {
          resultInternal = this.getFilesInDirectory(newbase, ext, fs.readdirSync(newbase), resultInternal);
        } else if (ext === '' || file.substr(-1 * (ext.length + 1)) === `.${ext}`) {
          resultInternal.push(newbase);
        }
      });
      return resultInternal;
    }
    return [''];
  }

  resetDirectory(dir: string): void {
    fs.removeSync(dir);
    fs.mkdirSync(dir);
  }

  fileExists(dir: string): boolean {
    return fs.existsSync('./' + dir);
  }

  rootFileExists(dir: string): boolean {
    return fs.existsSync(dir);
  }

  writeToFile(fileName: string, text: string, options: any): void {
    fs.writeFileSync(fileName, text, options);
  }

  removeDirectory(dir): boolean {
    if (this.fileExists(dir)) {
      fs.removeSync('./' + dir);
      return true;
    }
    return false;
  }

  readFileAsUtf8(filePath: string): string {
    return fs.readFileSync(filePath, { encoding: 'utf8' });
  }
}
