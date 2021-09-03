import { IJob } from "../../entities/job";
import { CommandExecutorResponse } from "../../services/commandExecutor";

export class TestDataProvider {

    static getJobPropertiesValidateTestCases():Array<any> {
        return [].concat(TestDataProvider.getNullProperitesDataWithErrorForValidator(),
                     TestDataProvider.getNonAsciiProperitesDataWithErrorForValidator(),
                     TestDataProvider.getNonStandardProperitesDataWithErrorForValidator());
    }
    static getJobPropertiesToValidate(): any {
        return [{'prop':'repoName', value:"", expectedError:"Invalid Reponame"}, 
                {'prop':'branchName', value:"", expectedError:"Invalid Branchname"},
                {'prop':'repoOwner', value:"", expectedError:"Invalid RepoOwner"}];
    }
    static getNullProperitesDataWithErrorForValidator(){
        let props = TestDataProvider.getJobPropertiesToValidate();
        props.forEach(element => {
            element.value = null;
        });
        return props;
    }

    static getNonAsciiProperitesDataWithErrorForValidator(){

        let props = TestDataProvider.getJobPropertiesToValidate();
        props.forEach(element => {
            element.value =  '£asci§©©';
        });
        return props;
    }

    static getNonStandardProperitesDataWithErrorForValidator(){
        let props = TestDataProvider.getJobPropertiesToValidate();
        props.forEach(element => {
            element.value =  '()??*&^)(*d))';
        });
        return props;
    }

    static getPublishBranchesContent(job:IJob): any {
        return {
            prefix: "TestPrefix",
            content: {
                version: {
                    active:[1,2,3],
                    stable: job.payload.branchName
                }
            },
            git: {
                branches:{
                    published: [job.payload.branchName]
                }
            }
        };
    }

    static configurePublishedBranches(job:IJob): IJob {
        job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(job);
        return job;
    }

    static configurePublishedBranchesWithPrimaryAlias(job:IJob): IJob {
        job.payload.primaryAlias = job.payload.branchName;
        return TestDataProvider.configurePublishedBranches(job);
    }

    static configurePublishedBranchesWithOutPrimaryAliasAndAliasSet(job:IJob): IJob {
        job.payload.primaryAlias = null;
        job.payload.aliased = true;
        return TestDataProvider.configurePublishedBranches(job);
    }

    static getCommitCheckValidResponse(job:IJob): any {
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
        return [null, {}, TestDataProvider.getCommitCheckInValidResponse()];
    }
}
