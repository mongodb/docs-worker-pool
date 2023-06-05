import * as c from 'config';
import { Octokit } from 'octokit';
import { ILogger } from './logger';
import { IConfig } from 'config';
import { GithubCommentError } from '../errors/errors';
import { Payload } from '../entities/job';
import { ConsoleLogger } from '../services/logger';

export interface IGithubConnector {
  getOpenPRs(): Promise<any>;
  getParentPRs(payload: Payload): Promise<Array<number>>;
  postComment(payload: Payload, pr: number, message: string): Promise<any>;
  updateComment(payload: Payload, pr: number, message: string): Promise<any>;
  getPullRequestCommentId(Payload: Payload, pr: number): Promise<any>;
}

export class GithubConnector implements IGithubConnector {
  private _logger: ILogger;
  private _config: IConfig;
  private _octokit: Octokit;

  constructor(logger: ILogger, config: IConfig, githubToken: string) {
    this._logger = logger;
    this._config = config;
    this._octokit = new Octokit({
      auth: githubToken,
    });
  }

  // We may not need this. Alt. could be used to choose which PR?
  // If the latter, TODO: pass in relevant values rather than hardcoding, obvs.
  async getOpenPRs(): Promise<any> {
    const results = await this._octokit.request('GET /repos/{owner}/{repo}/pulls?state=open', {
      owner: 'schmalliso',
      repo: 'snooty',
      headers: { 'X-Github-Api-Version': '2022-11-28' },
    });
    for (const pr of results['data']) {
      console.log(pr['number']);
      console.log(pr['user']['login']);
    }
    return results['data'];
  }

  // get PR(s) to which commit belongs
  // !! TODO in principle we should only care about PRs where the commit is the most recent commit
  async getParentPRs(payload: Payload): Promise<Array<number>> {
    const parentPRs: Array<number> = [];
    if (!payload.newHead) {
      throw new GithubCommentError(`Cannot determine commit hash. This is probably a slack deploy job`);
    }
    console.log(2);
    const results = await this._octokit.request('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', {
      owner: 'schmalliso', // will need to determine if 10gen or mongodb
      repo: payload.repoName,
      commit_sha: payload.newHead,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    console.log(6);
    if (results.data) {
      for (const d of results.data) {
        parentPRs.push(d.number);
      }
    }
    console.log(7);
    //console.log(parentPRs)
    return parentPRs;
  }

  // Create new comment with relevant links
  // TODO: pass in owner, repo, issue number, message details
  // see api/controllers/v1/jobs.ts#L195 for summary message we send in Slack
  async postComment(payload: Payload, pr: number, message: string): Promise<any> {
    try {
      await this._octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner: 'schmalliso', //'schmalliso', NEED TO FIGURE OUT MONGODB OR 10GEN -- CAN DO FROM PR?
        repo: payload.repoName, //'docs-poop',
        issue_number: pr, //1,
        // todo: make the body actually correct and aesthetic
        body: `${message}`,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    } catch (error) {
      this._logger.error(`Failed to post to Github`, error);
    }
  }

  // Given the comment ID of the comment posted by the docs-builder-bot user
  // as returned by getPullRequestCommentId, update the comment as needed
  // (i.e. with a new build log) by appending the link to the end.
  async updateComment(payload: Payload, comment: number, message: string): Promise<any> {
    const resp = await this._octokit.request('GET /repos/{owner}/{repo}/issues/comments/{comment_id}', {
      owner: 'schmalliso',
      repo: 'docs-ecosystem',
      comment_id: comment,
    });
    console.log(resp);
    const currentComment = resp.data.body;
    console.log(currentComment);
    const newComment = resp.data.body + `\n${message}`;
    try {
      await this._octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
        owner: 'schmalliso',
        repo: 'docs-ecosystem',
        comment_id: comment,
        body: newComment,
      });
    } catch (error) {
      console.log(error);
    }
  }

  // get the ID of the comment created by the docs-builder-bot user
  // if there is no docs-builder-bot comment, return null
  async getPullRequestCommentId(payload: Payload, pr: number): Promise<any> {
    const comments = await this._octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: 'schmalliso',
      repo: payload.repoName,
      issue_number: pr,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (comments['data'].length > 0) {
      console.log('Yes');
      for (const comment of comments['data']) {
        // TODO: this to docs-builder-bot once that's a thing
        if (comment.user && comment.user.login == 'schmalliso') {
          return comment['id'];
        }
      }
    }
    return;
  }
}
// const consoleLogger = new ConsoleLogger();

// const testpayload: Payload = {
//   jobType: 'githubPush',
//   source: 'github',
//   action: 'push',
//   repoName: 'docs-ecosystem',
//   branchName: 'test1',rm 
//   isFork: true,
//   private: false,
//   isXlarge: true,
//   repoOwner: 'schmalliso',
//   url: 'https://github.com/schmalliso/docs-ecosystem.git',
//   newHead: '76850bd68337803368ce85904f6de0b4c9657b5e',
//   patch: undefined,
//   alias: null,
//   manifestPrefix: undefined,
//   pathPrefix: null,
//   aliased: undefined,
//   primaryAlias: undefined,
//   stable: undefined,
//   isNextGen: true,
//   regression: undefined,
//   urlSlug: 'test1',
//   prefix: 'drivers',
//   project: 'drivers',
//   includeInGlobalSearch: false,
//   mutPrefix: undefined,
//   repoBranches: null
// }

// console.log(1);
// githubConnector.getParentPRs(testpayload).then(function(results){
//   console.log(8);
//   console.log(results)
//   for (const result of results) {
//     const commentid = githubConnector.getPullRequestCommentId(testpayload, result).then(function(id){
//       console.log(`The comment ID is: ${id}`)
//       if (id != undefined) {
//         githubConnector.updateComment(testpayload, id, '* append this pleez')
//       } else {
//         githubConnector.postComment(testpayload, result, "This is a new comment from Allison during development")
//       }

//     })
//     }
//   })
