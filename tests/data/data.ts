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

    static getPublishBranchesContent(job: IJob): any {
        return {
            prefix: "TestPrefix",
            version: {
                published: [1, 2, 3],
                active: [1, 2, 3],
                stable: job.payload.branchName
            },
            git: {
                branches: {
                    manual: 'master',
                    published: [job.payload.branchName]
                }
            }
        };
    }

    static configurePublishedBranches(job: IJob): IJob {
        job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(job);
        return job;
    }

    static configurePublishedBranchesWithPrimaryAlias(job: IJob): IJob {
        job.payload.primaryAlias = job.payload.branchName;
        return TestDataProvider.configurePublishedBranches(job);
    }

    static configurePublishedBranchesWithOutPrimaryAliasAndAliasSet(job: IJob): IJob {
        job.payload.primaryAlias = null;
        job.payload.aliased = true;
        return TestDataProvider.configurePublishedBranches(job);
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

    static getPathPrefixCases(): Array<any> {
        // Null version 

        const job = Object.assign(data.default.value);
        let itemValid = TestDataProvider.getPublishBranchesContent(job);

        // Null version
        let itemNullVersion = TestDataProvider.getPublishBranchesContent(job);
        itemNullVersion.version = null;

        let itemPrefixEmpty = TestDataProvider.getPublishBranchesContent(job);
        itemPrefixEmpty.prefix = '';

        let itemVersionActiveEmpty = TestDataProvider.getPublishBranchesContent(job);
        itemVersionActiveEmpty.version.active = [];

        return [{
            value: itemValid,
            error: null,
            pathPrefix: `${itemValid.prefix}/${job.payload.branchName}`,
            mutPrefix: `${itemValid.prefix}/${job.payload.branchName}`
        },
        {
            value: itemNullVersion,
            error: "Cannot read property 'active' of null",
            pathPrefix: null,
            mutPrefix: null
        },
        {
            value: itemPrefixEmpty,
            error: null,
            pathPrefix: `${itemPrefixEmpty.prefix}/${job.payload.branchName}`,
            mutPrefix: `${itemPrefixEmpty.prefix}/${job.payload.branchName}`
        },
        {
            value: itemVersionActiveEmpty,
            error: null,
            pathPrefix: itemValid.prefix,
            mutPrefix: itemValid.prefix
        },

        ];
    }

    static getManifestPrefixCases(): Array<any> {
        const job = Object.assign(data.default.value);
        let itemValid = TestDataProvider.getPublishBranchesContent(job);
        return [{
            branchInfo: itemValid,
            aliased: false,
            primaryAlias: 'DONTSET',
            alias: 'DONTSET',
            manifestPrefix: `${job.payload.repoName}-${job.payload.branchName}`
        }, {
            branchInfo: itemValid,
            aliased: true,
            primaryAlias: 'primary',
            alias: 'DONTSET',
            manifestPrefix: `${job.payload.repoName}-${job.payload.branchName}`
        }, {
            branchInfo: itemValid,
            aliased: true,
            primaryAlias: 'primary',
            alias: 'UsingAlias',
            manifestPrefix: `${job.payload.repoName}-UsingAlias`
        }, {
            branchInfo: itemValid,
            aliased: true,
            primaryAlias: null,
            alias: 'DONTSET',
            manifestPrefix: undefined
        }];
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

    static getRepoBranchesData(repoName:String):any {
        return {'repoName':`${repoName}`, 
         'bucket': {'regression': 'docs-mongodb-org-stg', 'dev': 'docs-mongodb-org-dev', 'stg': 'docs-mongodb-org-stg', 'prd': 'docs-mongodb-org-prd'}, 
        'url': {'regression': 'https://docs-mongodbcom-integration.corp.mongodb.com', 'dev': 'https://docs-mongodborg-staging.corp.mongodb.com', 'stg': 'https://docs-mongodborg-staging.corp.mongodb.com', 'prd': 'https://docs.mongodb.com'}}
    }

    static getRepoBranchesByRepoName(repoName: String): any {
        return {
            query: { 'repoName': repoName }
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
