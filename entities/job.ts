export interface IJob {
    _id: string;
    payload: IPayload;
    createdTime: Date;
    email: string;
    endTime: Date | null | undefined;
    error: any| null | undefined;
    logs: string[]| null | undefined;
    priority: Number| null | undefined;
    result: any| null | undefined;
    startTime: Date;
    status: string;
    title: string;
    user: string;
    comMessage: string[]| null | undefined;
    purgedUrls:  string[]| null | undefined;
    manifestPrefix: string | undefined;
    pathPrefix: string | null | undefined;
    mutPrefix: string | null | undefined;
    buildCommands: Array<string> | null | undefined;
    publishCommands: Array<string> | null | undefined;
  }
  
  export interface IPayload {
    jobType: string;
    source: string;
    action: string;
    repoName: string;
    branchName: string;
    isFork: boolean;
    private: boolean;
    isXlarge: boolean| null | undefined;
    repoOwner: string;
    url: string;
    newHead: string| null | undefined;
  }

export class Job implements IJob {
  _id: string;
  payload: IPayload;
  createdTime: Date;
  email: string;
  endTime: Date | null | undefined;
  error: any;
  logs: string[] | null | undefined;
  priority: Number | null | undefined;
  result: any;
  startTime: Date;
  status: string;
  title: string;
  user: string;
  comMessage: string[] | null | undefined;
  purgedUrls:  string[]| null | undefined;
  manifestPrefix: string | undefined;
  pathPrefix: string | null |undefined;
  mutPrefix: string | null | undefined;
  buildCommands: string[] |null | undefined;
  publishCommands: string[] |null | undefined;
}