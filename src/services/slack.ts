import axios from 'axios';
import { ILogger } from "./logger";
import { IConfig } from "config";
import * as tsscmp from 'tsscmp';
import crypto from 'crypto';

export const axiosApi = axios.create();


export interface ISlackConnector {
    validateSlackRequest(payload:any):boolean;
    displayRepoOptions(repos:Array<string>,triggerId:string): Promise<string>;
    parseSelection(payload:any):any;
    sendMessage(message:any, user:string): Promise<string>;
}

export class SlackConnector implements ISlackConnector {
    private _logger: ILogger
    private _config: IConfig
    constructor(logger: ILogger, config: IConfig) {
        this._logger = logger;
        this._config = config;
    }
    async sendMessage(message: any, user: string): Promise<any> {
        const body = {
            "channel": user,
            "text": message
          }
        return await axiosApi.post("https://slack.com/api/chat.postMessage", body, { headers: {
            "Authorization": [
              `Bearer ${ this._config.get<string>("slackToken")}`
            ]
          } });
    }
    parseSelection(stateValues: any): any {
        let values = {};
        let inputMapping = {
          'block_repo_option': 'repo_option',
          'block_hash_option': 'hash_option',
        };
        
        // get key and values to figure out what user wants to deploy
        for (let blockKey in inputMapping) {
            let blockInputKey = inputMapping[blockKey];
            let stateValuesObj = stateValues[blockKey][blockInputKey];
          // selected value from dropdown
          if (stateValuesObj && stateValuesObj.selected_option && stateValuesObj.selected_option.value) {
            values[blockInputKey] = stateValuesObj.selected_option.value;
          } 
          // multi select is an array
          else if (stateValuesObj && stateValuesObj.selected_options && stateValuesObj.selected_options.length > 0) {
            values[blockInputKey] = stateValuesObj.selected_options;
          }
          // input value
          else if (stateValuesObj && stateValuesObj.value) {
            values[blockInputKey] = stateValuesObj.value;
          } 
          // no input
          else {
            values[blockInputKey] = null;
          }
        }
        return values;
    }

    validateSlackRequest(payload:any):boolean {
        // params needed to verify for slack
        const headerSlackSignature = payload.headers['X-Slack-Signature'].toString(); // no idea why `typeof <sig>` = object
        const timestamp = payload.headers['X-Slack-Request-Timestamp'];
        const signingSecret = this._config.get<string>("slackSecret");
        const hmac = crypto.createHmac('sha256', signingSecret);
        const [version, hash] = headerSlackSignature.split('=');
        const base = `${version}:${timestamp}:${JSON.stringify(payload.body)}`;
        hmac.update(base);
        return tsscmp(hash, hmac.digest('hex'));
      }

    async displayRepoOptions(repos: string[], triggerId: string): Promise<string> {
        const repoOptView = this._buildDropdown(repos, triggerId);
        const slackToken = this._config.get<string>("slackToken");
        const slackUrl = this._config.get<string>("slackViewOpenUrl");
        return await axiosApi.post(slackUrl, repoOptView, { headers: {
            "Authorization": [
              `Bearer ${slackToken}`
            ]
          } });
    }

    private _getDropDownView(triggerId: string, repos:Array<any>) {
        return {
            "trigger_id": triggerId,
              "view": {
                "type": "modal",
                "title": {
                    "type": "plain_text",
                    "text": "Deploy Docs",
                    "emoji": true
                },
                "submit": {
                    "type": "plain_text",
                    "text": "Submit",
                    "emoji": true
                },
                "close": {
                    "type": "plain_text",
                    "text": "Cancel",
                    "emoji": true
                },
                "blocks": [
                    {
                        "type": "input",
                        "block_id": "block_repo_option",
                        "element": {
                            "type": "multi_static_select",
                            "action_id": "repo_option",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select a repo to deploy",
                                "emoji": true
                            },
                            "options": repos,
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Select Repo",
                            "emoji": true
                        }
                    },
                    {
                        "type": "input",
                        "block_id": "block_hash_option",
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "hash_option",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Enter a commit hash (defaults to latest master commit)"
                            }
                        },
                        "optional": true,
                        "label": {
                            "type": "plain_text",
                            "text": "Commit Hash"
                        }
                    }
                ]
              }
          };
        
    }

    private _buildDropdown(branches:Array<string>,triggerId:string): any {
        let reposToShow:Array<any> = [];
        branches.forEach(fullPath => { 
            const fullBranchPath = fullPath
            var opt = {
              "text": {
                "type": "plain_text",
                "text": fullBranchPath,
              },
              "value": fullBranchPath
            };
            reposToShow.push(opt);
          }); 
          return this._getDropDownView(triggerId, reposToShow);
    }
}