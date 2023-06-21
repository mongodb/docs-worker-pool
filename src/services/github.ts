import { Octokit } from '@octokit/rest';
import { ILogger } from './logger';
import { IConfig } from 'config';
import { GithubCommentError } from '../errors/errors';
import { Payload } from '../entities/job';

export interface IGithubConnector {
  getParentPRs(payload: Payload): Promise<Array<number>>;
  postComment(payload: Payload, pr: number, message: string): Promise<201 | undefined>;
  updateComment(payload: Payload, pr: number, message: string): Promise<200 | undefined>;
  getPullRequestCommentId(Payload: Payload, pr: number): Promise<number | undefined>;
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

  // // We may not need this. Alt. could be used to choose which PR?
  // // If the latter, TODO: pass in relevant values rather than hardcoding, obvs.
  // async getOpenPRs(): Promise<any> {
  //   const results = await this._octokit.request('GET /repos/{owner}/{repo}/pulls?state=open', {
  //     owner: 'schmalliso',
  //     repo: 'snooty',
  //     headers: { 'X-Github-Api-Version': '2022-11-28' },
  //   });
  //   for (const pr of results['data']) {
  //     console.log(pr['number']);
  //     console.log(pr['user']['login']);
  //   }
  //   return results['data'];
  // }

  // get PR(s) to which commit belongs
  // !! TODO in principle we should only care about PRs where the commit is the most recent commit
  async getParentPRs(payload: Payload): Promise<Array<number>> {
    const parentPRs: Array<number> = [];
    if (!payload.newHead) {
      throw new GithubCommentError(`Cannot determine commit hash. This is probably a slack deploy job`);
    }
    console.log(payload);
    const results = await this._octokit.request('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', {
      owner: payload.repoOwner, // will need to determine if 10gen or mongodb
      repo: payload.repoName,
      commit_sha: payload.newHead,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (results.data) {
      for (const d of results.data) {
        parentPRs.push(d.number);
      }
    }
    return parentPRs;
  }

  // Create new comment with relevant links
  async postComment(payload: Payload, pr: number, message: string): Promise<201 | undefined> {
    try {
      console.log(payload);
      await this._octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner: payload.repoOwner, //NEED TO FIGURE OUT MONGODB OR 10GEN -- CAN DO FROM PR?
        repo: payload.repoName,
        issue_number: pr,
        body: `${message}`,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      return 201;
    } catch (error) {
      this._logger.error(`Failed to post to Github`, error);
      return;
    }
  }

  // Given the comment ID of the comment posted by the docs-builder-bot user
  // as returned by getPullRequestCommentId, update the comment as needed
  // (i.e. with a new build log) by appending the link to the end.
  async updateComment(payload: Payload, comment: number, message: string): Promise<200 | undefined> {
    console.log(payload);
    const resp = await this._octokit.request('GET /repos/{owner}/{repo}/issues/comments/{comment_id}', {
      owner: payload.repoOwner, // 10gen mongodb
      repo: payload.repoName,
      comment_id: comment,
    });
    const newComment = resp.data.body + `\n${message}`;
    try {
      await this._octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
        owner: payload.repoOwner, // 10gen mongodb
        repo: payload.repoName,
        comment_id: comment,
        body: newComment,
      });
      return 200;
    } catch (error) {
      console.log(error);
      return;
    }
  }

  // get the ID of the comment created by the docs-builder-bot user
  // if there is no docs-builder-bot comment, return undefined
  async getPullRequestCommentId(payload: Payload, pr: number): Promise<number | undefined> {
    console.log(payload);
    const comments = await this._octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: payload.repoOwner, // 10gen mongodb
      repo: payload.repoName,
      issue_number: pr,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (comments['data'].length > 0) {
      for (const comment of comments['data']) {
        if (comment.user && comment.user.login == 'docs-builder-bot') {
          return comment['id'];
        }
      }
    }
    return;
  }
}
