import axios from 'axios';
import { ILogger } from './logger';
import { IConfig } from 'config';
import * as crypto from 'crypto';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';
export const axiosApi = axios.create();

function bufferEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function timeSafeCompare(a: string, b: string) {
  const sa = String(a);
  const sb = String(b);
  const key = crypto.pseudoRandomBytes(32);
  const ah = crypto.createHmac('sha256', key).update(sa).digest();
  const bh = crypto.createHmac('sha256', key).update(sb).digest();
  return bufferEqual(ah, bh) && a === b;
}

export interface ISlackConnector {
  validateSlackRequest(payload: any): boolean;
  displayRepoOptions(repos: Array<string>, triggerId: string, isAdmin: boolean): Promise<any>;
  parseSelection(
    payload: any,
    isAdmin: boolean,
    repoBranchesRepository: RepoBranchesRepository,
    optionGroups: any[]
  ): any;
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
    try {
      const body = {
        channel: user,
        text: message,
      };
      const slackToken = this._config.get<string>('slackAuthToken');
      return await axiosApi.post('https://slack.com/api/chat.postMessage', body, {
        headers: {
          Authorization: [`Bearer ${slackToken}`],
          'Content-type': 'application/json; charset=utf-8',
        },
      });
    } catch (error) {
      this._logger.error('Slack SendMessage', error);
    }
    return {};
  }

  async parseSelection(
    stateValues: any,
    isAdmin: boolean,
    repoBranchesRepository: RepoBranchesRepository,
    optionGroups: any[]
  ): Promise<any> {
    const values = {};
    const inputMapping = {
      block_repo_option: 'repo_option',
      block_hash_option: 'hash_option',
    };

    // if deploy all was selected:
    if (stateValues['block_deploy_option']?.deploy_option?.selected_option?.value == 'deploy_all') {
      if (!isAdmin) {
        throw new Error('User is not an admin and therefore not entitled to deploy all repos');
      }

      values['deploy_option'] = 'deploy_all';
      //go through all options in dropdown by option group
      //append version to repo_option if active
      for (const group of optionGroups) {
        console.log('group' + group);
        values['repo_option'].append(
          ...group.options.map((option) => {
            if (!option.text.text.startsWith('(!inactive)')) return option;
          })
        );
      }
      return values;
    }

    //if deploy indivual repos was selected:
    // get key and values to figure out what user wants to deploy
    for (const blockKey in inputMapping) {
      const blockInputKey = inputMapping[blockKey];
      const stateValuesObj = stateValues[blockKey][blockInputKey];

      // multi select is an array
      if (stateValuesObj?.selected_options?.length > 0) {
        values[blockInputKey] = stateValuesObj.selected_options;
      }
      //return an error if radio button choice 'deploy individual repos' was selected but no repo was actually chosen
      else if (blockInputKey == 'repo_option') {
        throw new Error('Deploy individual repos was selected but no repo was actually chosen to be deployed');
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
    const headerSlackSignature =
      payload.headers['X-Slack-Signature']?.toString() ?? payload.headers['x-slack-signature']?.toString(); // no idea why `typeof <sig>` = object
    const timestamp = payload.headers['X-Slack-Request-Timestamp'] ?? payload.headers['x-slack-request-timestamp'];
    const signingSecret = process.env.SLACK_SECRET;
    if (signingSecret) {
      const hmac = crypto.createHmac('sha256', signingSecret);
      const [version, hash] = headerSlackSignature.split('=');
      const base = `${version}:${timestamp}:${payload.body}`;
      hmac.update(base);
      return timeSafeCompare(hash, hmac.digest('hex'));
    }
    return false;
  }

  async displayRepoOptions(repos: string[], triggerId: string, isAdmin: boolean): Promise<any> {
    const repoOptView = this._getDropDownView(triggerId, repos, isAdmin);
    const slackToken = this._config.get<string>('slackAuthToken');
    const slackUrl = this._config.get<string>('slackViewOpenUrl');
    return await axiosApi.post(slackUrl, repoOptView, {
      headers: {
        Authorization: [`Bearer ${slackToken}`],
        'Content-type': 'application/json; charset=utf-8',
      },
    });
  }
  private _getDropDownView(triggerId: string, repos: Array<any>, isAdmin: boolean) {
    const deployAll = isAdmin
      ? {
          type: 'section',
          block_id: 'block_deploy_option',
          text: {
            type: 'plain_text',
            text: 'How would you like to deploy docs sites?',
          },
          accessory: {
            type: 'radio_buttons',
            action_id: 'deploy_option',
            initial_option: {
              value: 'deploy_individually',
              text: {
                type: 'plain_text',
                text: 'Deploy individual repos',
              },
            },
            options: [
              {
                value: 'deploy_individually',
                text: {
                  type: 'plain_text',
                  text: 'Deploy individual repos',
                },
              },
              {
                value: 'deploy_all',
                text: {
                  type: 'plain_text',
                  text: 'Deploy all repos',
                },
              },
            ],
          },
        }
      : {
          type: 'section',
          text: {
            type: 'plain_text',
            text: ' ',
          },
        };

    return {
      trigger_id: triggerId,
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: 'Deploy Docs',
        },
        submit: {
          type: 'plain_text',
          text: 'Submit',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        blocks: [
          {
            type: 'input',
            block_id: 'block_repo_option',
            label: {
              type: 'plain_text',
              text: 'Select Repo',
            },
            element: {
              type: 'multi_static_select',
              action_id: 'repo_option',
              placeholder: {
                type: 'plain_text',
                text: 'Select a repo to deploy',
              },
              option_groups: repos,
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
          deployAll,
        ],
      },
    };
  }
}
