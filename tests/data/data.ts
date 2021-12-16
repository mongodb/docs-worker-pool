import { IJob } from "../../src/entities/job";
import { CommandExecutorResponse } from "../../src/services/commandExecutor";
import * as data from '../data/jobDef';
import fs from 'fs';
import path from "path";

export class TestDataProvider {

    static getJobPropertiesValidateTestCases(): Array<any> {
        return [].concat(TestDataProvider.getNullProperitesDataWithErrorForValidator(),
            TestDataProvider.getNonAsciiProperitesDataWithErrorForValidator(),
            TestDataProvider.getNonStandardProperitesDataWithErrorForValidator());
    }
    static getJobPropertiesToValidate(): any {
        return [{ 'prop': 'repoName', value: "", expectedError: "Invalid Reponame" },
        { 'prop': 'branchName', value: "", expectedError: "Invalid Branchname" },
        { 'prop': 'repoOwner', value: "", expectedError: "Invalid RepoOwner" }];
    }
    static getNullProperitesDataWithErrorForValidator() {
        let props = TestDataProvider.getJobPropertiesToValidate();
        props.forEach(element => {
            element.value = null;
        });
        return props;
    }

    static getNonAsciiProperitesDataWithErrorForValidator() {

        let props = TestDataProvider.getJobPropertiesToValidate();
        props.forEach(element => {
            element.value = '£asci§©©';
        });
        return props;
    }

    static getNonStandardProperitesDataWithErrorForValidator() {
        let props = TestDataProvider.getJobPropertiesToValidate();
        props.forEach(element => {
            element.value = '()??*&^)(*d))';
        });
        return props;
    }

    static getBranchSlug(job: IJob): any {
        return {
            prefix: "TestPrefix",
            project: "TestProject",
            repoName: job.payload.repoName,
            branches: [
              {
                "gitBranchName": job.payload.branchName,
                "urlAliases": [],
                "urlSlug": "sample_slug",
                "active": true,
                "publishOriginalBranchName": true,
                "isStableBranch": true
              }
            ]
        };
    }

    static getCommitCheckValidResponse(job: IJob): any {
        let resp = new CommandExecutorResponse();
        resp.output = [`* ${job.payload.branchName}`]
        resp.error = null;
        resp.status = 'success';
        return resp;
    }

    static getCommitCheckInValidResponse(): any {
        let resp = new CommandExecutorResponse();
        resp.output = [`* unknown values`]
        resp.error = null;
        resp.status = 'success';
        return resp;
    }

    static getAllCommitCheckCases(): Array<any> {
        return [null, {}, TestDataProvider.getCommitCheckInValidResponse(), "THROW"];
    }

    static getCommonBuildCommands(job: IJob): Array<string> {
        return [`. /venv/bin/activate`,
            `cd repos/${job.payload.repoName}`,
            `rm -f makefile`,
            `make html`];
    }

    static getExpectedProdBuildNextGenCommands(job: IJob): Array<string> {
        let genericCommands = TestDataProvider.getCommonBuildCommands(job);
        return Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), ['make get-build-dependencies', 'make next-gen-html']);
    }

    static getExpectedStagingBuildNextGenCommands(job: IJob): Array<string> {
        let genericCommands = TestDataProvider.getCommonBuildCommands(job);
        let commands = Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), ['make next-gen-html']);
        if (job.payload.repoName == 'devhub-content-integration') {
            commands[commands.length - 1] += ` STRAPI_PUBLICATION_STATE=preview`;
        }
        return commands;
    }

    static getEnvVarsWithPathPrefixWithFlags(job: IJob, nav: string | null, dropdown: string | null): string {
       return `GATSBY_PARSER_USER=TestUser\nGATSBY_PARSER_BRANCH=${job.payload.branchName}\nPATH_PREFIX=${job.payload.pathPrefix}\n`;
    }
    static getEnvVarsTestCases(): Array<any> {
        return [
            { "GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION": true, "GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN": true, navString: "TRUE", versionString: "TRUE" },
            { "GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION": true, "GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN": false, navString: "TRUE", versionString: null },
            { "GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION": false, "GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN": true, navString: null, versionString: "TRUE" },
            { "GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION": false, "GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN": false, navString: null, versionString: null }]
    }

    static getCommonDeployCommands(job: IJob): Array<string> {
        return [
            '. /venv/bin/activate',
            `cd repos/${job.payload.repoName}`,
            'make publish && make deploy'];
    }

    static getCommonDeployCommandsForStaging(job: IJob): Array<string> {
        return [
            '. /venv/bin/activate',
            `cd repos/${job.payload.repoName}`,
            'make stage'];
    }

    static getExpectedStageDeployNextGenCommands(job: IJob): Array<string> {
        let genericCommands = TestDataProvider.getCommonDeployCommands(job);
        if (job.payload.mutPrefix) {
            return Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), [`make next-gen-stage MUT_PREFIX=${job.payload.mutPrefix}`]);
        }
        return Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), [`make next-gen-stage`]);

    }

    static getExpectedProdDeployNextGenCommands(job: IJob): Array<string> {
        let genericCommands = TestDataProvider.getCommonDeployCommands(job);
        let ret = Array<string>().concat(genericCommands.slice(0, genericCommands.length - 1), [`make next-gen-deploy MUT_PREFIX=${job.payload.mutPrefix}`]);
        if (job.payload.manifestPrefix) {
            ret[ret.length - 1] += ` MANIFEST_PREFIX=${job.payload.manifestPrefix} GLOBAL_SEARCH_FLAG=${job.payload.stableBranch}`;
        }
        return ret;
    }

    static getPublishOutputWithPurgedUrls(prod: boolean): any {
        if (prod) {
            return ["Line1 \r\n Line2 \r\n {\t\"urls\": [\"url1\", \"url2\", \"url3\", \"url4\", \"url5\"]}", ["url1", "url2", "url3", "url4", "url5"]];
        } else {
            return ["Line1 \r\n Line2 \r\n Summary: All good"];
        }
    }
    static nextGenEntryInWorkerFile() {
        return ['"build-and-stage-next-gen"'].join("/r/n");
    }

    static getStatusUpdateQueryAndUpdateObject(id: String, status: string, result: any, date: Date, error: boolean = false, reason: string = ""): any {
        let retObj = {
            query: { _id: id },
            update: {
                $set: {
                    status: status,
                    endTime: date,
                }
            }
        }

        if (error) {
            retObj['update']['$set']['error'] = { time: new Date().toString(), reason: reason };
        } else {
            retObj['update']['$set']['result'] = result
        }
        return retObj;
    }

    static getFindOneAndUpdateCallInfo(): any {
        return {
            query: {
                status: 'inQueue',
                createdTime: { $lte: new Date() },
            },
            update: { $set: { startTime: new Date(), status: 'inProgress' } },
            options: { sort: { priority: -1, createdTime: 1 }, returnNewDocument: true }
        }
    }

    static getInsertLogStatementInfo(id: String, messages: string[]): any {
        return {
            query: {
                _id: id
            },
            update: {
                $push: { ['logs']: { $each: messages } }
            }
        };
    }

    static getInsertComMessageInfo(id: String, message: string): any {
        return {
            query: {
                _id: id
            },
            update: {
                $push: { comMessage: message }
            }
        };
    }

    static getInsertPurgedUrls(id: String, urls: string[]): any {
        return {
            query: {
                _id: id
            },
            update: {
                $push: { ['purgedURLs']: urls }
            }
        };
    }

    static getJobResetInfo(id: String, message: string): any {
        return {
            query: {
                _id: id
            },
            update: {
                $set: {
                    status: "inQueue",
                    startTime: null,
                    error: {},
                    logs: [message],
                }
            }
        };
    }

    static getRepoEntitlementsByGithubUsernameInfo(userName: String): any {
        return {
            query: { 'github_username': userName }
        };
    }

    static getConfiguredBranchesByGithubRepoNameInfo(repoName: String): any {
        return {
          query: { 'repoName': repoName}
        };
    }

    static getPurgeAllUrlWithSurrogateKeys(): any {
        return {
            urls: ["url1", "url2", "url3", "url4"],
            url_to_sk: {
                "url1": "url1sk",
                "url2": "url2sk",
                "url3": "url3sk",
                "url4": "url4sk"
            }
        }
    }


    static getCommandsForSnootyProjectName(repoDirName: string): string[] {
        return [
            `. /venv/bin/activate`,
            `cd ~/repos/${repoDirName}`,
            `make get-project-name`
        ]
    }

    static getCommandsForGetServerUser(): string[] {
        return [
            `whoami`
        ]
    }

    static getPatchCommands(repoDirName: string, patchName: string): string[] {
        return [
            `cd repos/${repoDirName}`,
            `patch -p1 < ${patchName}`
        ];
    }

    static getcheckoutBranchForSpecificHeadCommands(repoDirName: string, branchName: string, newHead: string): string[] {
        return [
            `cd repos/${repoDirName}`,
            `git fetch`,
            `git checkout ${branchName}`,
            `git branch ${branchName} --contains ${newHead}`
        ];

    }

    static getPullRepoCommands(repoDirName: string, branchName: string, newHead: string | null | undefined = null): string[] {
        let retVal = [
            `cd repos/${repoDirName}`,
            `git checkout ${branchName}`,
            `git pull origin ${branchName}`];

        if (newHead) {
            retVal.push(`git checkout ${newHead} .`)
        }
        return retVal;
    }
}
