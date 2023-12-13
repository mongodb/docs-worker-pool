import { Db } from 'mongodb';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';
import { IConfig } from 'config';
import { MatchCondition, Projection } from '../monorepo/types/aggregation-types';

const docsetsCollectionName = process.env.DOCSETS_COL_NAME || 'docsets';
export class DocsetsRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'DocsetsRepository', db.collection(docsetsCollectionName));
  }

  static getAggregationPipeline(matchConditions: MatchCondition, projection?: Projection) {
    const DEFAULT_PROJECTIONS = {
      _id: 0,
      repos: 0,
      repo: 0,
    };

    // Add prefix 'repo' to each field in matchConditions
    const formattedMatchConditions = Object.entries(matchConditions).reduce((acc, [key, val]) => {
      acc[`repo.${key}`] = val;
      return acc;
    }, {});

    return [
      // Stage 1: Unwind the repos array to create multiple documents for each referenced repo
      {
        $unwind: '$repos',
      },
      // Stage 2: Lookup to join with the repos_branches collection
      {
        $lookup: {
          from: 'repos_branches',
          localField: 'repos',
          foreignField: '_id',
          as: 'repo',
        },
      },
      // Stage 3: Match documents based on given field
      {
        $match: formattedMatchConditions,
      },
      // Stage 4: Merge/flatten repo into docset
      {
        $replaceRoot: { newRoot: { $mergeObjects: [{ $arrayElemAt: ['$repo', 0] }, '$$ROOT'] } },
      },
      // Stage 5: Exclude fields
      {
        $project: projection || DEFAULT_PROJECTIONS,
      },
    ];
  }

  async getProjectByRepoName(repoName: string, directory?: string): Promise<string | undefined> {
    const matchConditions = { repoName };
    if (directory) matchConditions['directories.snooty_toml'] = `/${directory}`;
    const projection = { project: 1 };
    const aggregationPipeline = DocsetsRepository.getAggregationPipeline(matchConditions, projection);
    const cursor = await this.aggregate(aggregationPipeline, `Error while getting project by repo name ${repoName}`);
    const res = await cursor.toArray();
    if (!res.length) {
      const msg = `DocsetsRepository.getProjectByRepoName - Could not find project by repoName: ${repoName}`;
      this._logger.info(this._repoName, msg);
    }
    return res[0]?.project;
  }

  async getRepo(repoName: string, directory?: string): Promise<any> {
    const matchConditions = { repoName };
    if (directory) matchConditions['directories.snooty_toml'] = `/${directory}`;

    const aggregationPipeline = DocsetsRepository.getAggregationPipeline(matchConditions);
    const cursor = await this.aggregate(aggregationPipeline, `Error while fetching repo by repo name ${repoName}`);
    const res = await cursor.toArray();
    if (!res.length) {
      const msg = `DocsetsRepository.getRepo - Could not find repo by repoName: ${repoName} ${
        directory ? `with directory: /${directory}` : ''
      }`;
      this._logger.info(this._repoName, msg);
    }
    return res?.[0];
  }

  async getRepoBranchesByRepoName(repoName: string, project: string): Promise<any> {
    const matchConditions = { repoName, project };

    const aggregationPipeline = DocsetsRepository.getAggregationPipeline(matchConditions);
    const cursor = await this.aggregate(
      aggregationPipeline,
      `Error while fetching repo by repo name ${repoName} and project ${project}`
    );
    const res = await cursor.toArray();
    if (res.length && res[0]?.bucket && res[0]?.url) {
      return res[0];
    }
    return { status: 'failure' };
  }

  /**
   * Compares the project path from a monorepo push event, and compares it with
   * what is configured in the docset entry in Atlas.
   * @param path The project path where the snooty.toml file exists from the monorepo.
   * This path will reflect the current project path from a given commit.
   * @param projectName The project name for the docset entry.
   * @returns A boolean representing whether or not the configured docset entry snooty_toml path
   * matches the path found in GitHub.
   */
  // Warning: Directories field might be changing locations in schema. This method is unused and validity should be checked before usage.
  async checkSnootyTomlPath(path: string, projectName: string) {
    const query = { project: projectName };
    try {
      const docsetObject = await this.findOne(
        query,
        `Mongo Timeout Error: Timedout while retrieving repos entry for ${path}`
      );

      if (!docsetObject) {
        console.warn(`WARNING: The docset does not exist for the following project: ${projectName} \n path: ${path}`);

        return false;
      }

      return docsetObject.directories.snooty_toml === path;
    } catch (error) {
      console.warn(
        `WARNING: Error occurred when retrieving project path for ${projectName}. The following path was provided: ${path}`,
        error
      );
      return false;
    }
  }
}
