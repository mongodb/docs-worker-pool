import axios from 'axios';
import { ILogger } from './logger';
import { IConfig } from 'config';
import * as crypto from 'crypto';
export const axiosApi = axios.create();

function bufferEqual(a:Buffer, b:Buffer) {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function timeSafeCompare(a:string, b:string) {
  let sa = String(a);
  let sb = String(b);
  let key = crypto.pseudoRandomBytes(32);
  let ah = crypto.createHmac('sha256', key).update(sa).digest();
  let bh = crypto.createHmac('sha256', key).update(sb).digest();
  return bufferEqual(ah, bh) && a === b;
}

export interface ISlackConnector {
  validateSlackRequest(payload: any): boolean;
  displayRepoOptions(repos: Array<string>, triggerId: string): Promise<any>;
  parseSelection(payload: any): any;
  sendMessage(message: any, user: string): Promise<any>;
}

export class SlackConnector implements ISlackConnector {
  private _logger: ILogger;
  private _config: IConfig;
  constructor(logger: ILogger, config: IConfig) {
    this._logger = logger;
    this._config = config;
  }
  async sendMessage(message: any, user: string): Promise<any> {
    const body = {
      channel: user,
      text: message,
    };

    console.log("Slack sendMessage", message)

    const slackToken = this._config.get<string>('slackAuthToken');
    return await axiosApi.post('https://slack.com/api/chat.postMessage', body, {
      headers: {
        Authorization: [`Bearer ${slackToken}`],
        'Content-type': 'application/json; charset=utf-8'
      },
    });
  }
  parseSelection(stateValues: any): any {
    const values = {};
    const inputMapping = {
      block_repo_option: 'repo_option',
      block_hash_option: 'hash_option',
    };

    // get key and values to figure out what user wants to deploy
    for (const blockKey in inputMapping) {
      const blockInputKey = inputMapping[blockKey];
      const stateValuesObj = stateValues[blockKey][blockInputKey];
      // selected value from dropdown
      if (stateValuesObj?.selected_option?.value) {
        values[blockInputKey] = stateValuesObj.selected_option.value;
      }
      // multi select is an array
      else if (stateValuesObj?.selected_options && stateValuesObj.selected_options.length > 0) {
        values[blockInputKey] = stateValuesObj.selected_options;
      }
      // input value
      else if (stateValuesObj?.value) {
        values[blockInputKey] = stateValuesObj.value;
      }
      // no input
      else {
        values[blockInputKey] = null;
      }
    }
    return values;
  }

  validateSlackRequest(payload: any): boolean {
      
    // params needed to verify for slack
    const headerSlackSignature = payload.headers['X-Slack-Signature'].toString(); // no idea why `typeof <sig>` = object
    const timestamp = payload.headers['X-Slack-Request-Timestamp'];
    const signingSecret = process.env.SLACK_SECRET;
    if (signingSecret) {
      const hmac = crypto.createHmac('sha256', signingSecret);
      const [version, hash] = headerSlackSignature.split('=');
      const base = `${version}:${timestamp}:${payload.body}`;
      hmac.update(base);
      return timeSafeCompare(hash, hmac.digest('hex'));
    }
    return false
  }


  async displayRepoOptions(repos: string[], triggerId: string): Promise<any> {
    const repoOptView = this._buildDropdown(repos, triggerId);
    const slackToken = this._config.get<string>('slackAuthToken');
    const slackUrl = this._config.get<string>('slackViewOpenUrl');
    return await axiosApi.post(slackUrl, repoOptView, {
      headers: {
        Authorization: [`Bearer ${slackToken}`],
        'Content-type': 'application/json; charset=utf-8'
      },
    });
  }

  private _getDropDownView(triggerId: string, repos: Array<any>) {
    return {
      trigger_id: triggerId,
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: 'Deploy Docs',
          emoji: true,
        },
        submit: {
          type: 'plain_text',
          text: 'Submit',
          emoji: true,
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
          emoji: true,
        },
        blocks: [
          {
            type: 'input',
            block_id: 'block_repo_option',
            element: {
              type: 'multi_static_select',
              action_id: 'repo_option',
              placeholder: {
                type: 'plain_text',
                text: 'Select a repo to deploy',
                emoji: true,
              },
              options: repos,
            },
            label: {
              type: 'plain_text',
              text: 'Select Repo',
              emoji: true,
            },
          },
          {
            type: 'input',
            block_id: 'block_hash_option',
            element: {
              type: 'plain_text_input',
              action_id: 'hash_option',
              placeholder: {
                type: 'plain_text',
                text: 'Enter a commit hash (defaults to latest master commit)',
              },
            },
            optional: true,
            label: {
              type: 'plain_text',
              text: 'Commit Hash',
            },
          },
        ],
      },
    };
  }

  private _buildDropdown(branches: Array<string>, triggerId: string): any {
    let reposToShow: Array<any> = [];
    branches.forEach((fullPath) => {
      const fullBranchPath = fullPath;
      const opt = {
        text: {
          type: 'plain_text',
          text: fullBranchPath,
        },
        value: fullBranchPath,
      };
      reposToShow.push(opt);
    });
    // THis is the limitation enforced by slack as no more 100 items are allowd in the dropdown
    //'[ERROR] no more than 100 items allowed [json-pointer:/view/blocks/0/element/options]'

    if (reposToShow.length > 100) {
      reposToShow = reposToShow.splice(0, 100)
    }
    return this._getDropDownView(triggerId, reposToShow);
  }
}
