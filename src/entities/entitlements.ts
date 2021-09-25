export interface IRepoEntitlements {
    slack_user_id: string
    github_username: string
    repos: string[]
  }

  export class RepoEntitlements implements IRepoEntitlements{
      slack_user_id: string;
      github_username: string;
      repos: string[];
  }