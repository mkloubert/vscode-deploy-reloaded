/**
 * This file is part of the vscode-deploy-reloaded distribution.
 * Copyright (c) Marcel Joachim Kloubert.
 * 
 * vscode-deploy-reloaded is free software: you can redistribute it and/or modify  
 * it under the terms of the GNU Lesser General Public License as   
 * published by the Free Software Foundation, version 3.
 *
 * vscode-deploy-reloaded is distributed in the hope that it will be useful, but 
 * WITHOUT ANY WARRANTY; without even the implied warranty of 
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU 
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as deploy_contracts from '../contracts';
import * as deploy_download from '../download';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
const MergeDeep = require('merge-deep');
import * as OS from 'os';
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * A 'prompt' target.
 */
export interface PromptTarget extends deploy_targets.Target, deploy_targets.TargetProvider {
    /**
     * One or more prompt entries or a string with a path or URI from where to load the entries from.
     */
    readonly prompts: string | PromptEntry | PromptEntry[];
}

/**
 * A prompt entry.
 */
export interface PromptEntry {
    /**
     * Ignore focus out or not.
     */
    readonly ignoreFocusOut?: boolean;
    /**
     * Is a password value or not.
     */
    readonly isPassword?: boolean;
    /**
     * The custom placeholder to show.
     */
    readonly placeHolder?: string;
    /**
     * One or properties to write the values to.
     */
    readonly properties?: string | string[];
    /**
     * The prompt text.
     */
    readonly text?: string;
    /**
     * 
     */
    readonly type?: string;
}

type ValueValidatorResult = string | undefined | null;


class PromptPlugin extends deploy_plugins.IterablePluginBase<PromptTarget> {
    protected async prepareTargetsMany(promptTarget: PromptTarget, targets: deploy_targets.Target | deploy_targets.Target[]): Promise<deploy_targets.Target[] | false> {
        const ME = this;
        const WORKSPACE = promptTarget.__workspace;

        const CLONED_TARGETS: deploy_targets.Target[] = [];

        let prompts = promptTarget.prompts;
        if (!deploy_helpers.isObject<PromptEntry>(prompts) && !Array.isArray(prompts)) {
            // download from source
            const DOWNLOAD_SOURCE = ME.replaceWithValues(
                promptTarget,
                prompts
            );

            prompts =
                <PromptEntry | PromptEntry[]>JSON.parse(
                    (await deploy_download.download(
                        DOWNLOAD_SOURCE, WORKSPACE.getSettingScopes()
                    )).toString('utf8')
                );
        }

        const PROPERTIES_AND_VALUES: deploy_contracts.KeyValuePairs = {};

        for (const P of deploy_helpers.asArray(prompts)) {
            const VALUE_TYPE = deploy_helpers.normalizeString(
                ME.replaceWithValues(promptTarget, P.type)
            );

            let validator: (value: string) => ValueValidatorResult | Thenable<ValueValidatorResult>;
            switch (VALUE_TYPE) {
                case 'bool':
                case 'boolean':
                    validator = (str) => {
                        switch (deploy_helpers.normalizeString(str)) {
                            case '':
                            case '1':
                            case 'true':
                            case 'yes':
                            case 'y':
                            case '0':
                            case 'false':
                            case 'no':
                            case 'n':
                                // valid
                                break;

                            default:
                                return ME.t(promptTarget,
                                            'plugins.prompt.validation.noBool');
                        }
                    };
                    break;

                case 'int':
                case 'integer':
                    validator = (str) => {
                        if (!deploy_helpers.isEmptyString(str)) {
                            if (isNaN( parseInt(deploy_helpers.toStringSafe(str).trim()) )) {
                                return ME.t(promptTarget,
                                            'plugins.prompt.validation.noInt');
                            }
                        }
                    };
                    break;

                case 'float':
                case 'number':
                    validator = (str) => {
                        if (!deploy_helpers.isEmptyString(str)) {
                            if (isNaN( parseFloat(deploy_helpers.toStringSafe(str).trim()) )) {
                                return ME.t(promptTarget,
                                            'plugins.prompt.validation.noFloat');
                            }
                        }
                    };
                    break;

                case 'json':
                case 'obj':
                case 'object':
                    validator = (str) => {
                        try {
                            JSON.parse(str.trim());
                        }
                        catch (e) {
                            return ME.t(promptTarget,
                                        'plugins.prompt.validation.noJSON');
                        }
                    };
                    break;    
            }

            let valueToSet: any = await vscode.window.showInputBox({
                ignoreFocusOut: deploy_helpers.toBooleanSafe(P.ignoreFocusOut, true),
                password: deploy_helpers.toBooleanSafe(P.isPassword),
                placeHolder: deploy_helpers.toStringSafe(
                    ME.replaceWithValues(promptTarget, P.placeHolder)
                ).trim(),
                prompt: deploy_helpers.toStringSafe(
                    ME.replaceWithValues(promptTarget, P.text)
                ).trim(),
                validateInput: async (str) => {
                    if (validator) {
                        return await Promise.resolve(
                            validator(str)
                        );
                    }

                    return null;
                }
            });

            if (deploy_helpers.isNullOrUndefined(valueToSet)) {
                return false;  // cancelled
            }

            let converter: (input: any) => any;
            switch (VALUE_TYPE) {
                case 'bool':
                case 'boolean':
                    converter = (i) => {
                        if (deploy_helpers.isEmptyString(i)) {
                            return null;
                        }

                        switch (deploy_helpers.normalizeString(i)) {
                            case '1':
                            case 'true':
                            case 'yes':
                            case 'y':
                                return true;
                        }

                        return false;
                    };
                    break;

                case 'file':
                    converter = async (i) => {
                        if (deploy_helpers.isEmptyString(i)) {
                            return null;
                        }

                        return JSON.parse(
                            (await deploy_download.download(
                                i, WORKSPACE.getSettingScopes()
                            )).toString('utf8')
                              .trim()
                        );
                    };
                    break;

                case 'float':
                case 'number':
                    converter = (i) => {
                        if (deploy_helpers.isEmptyString(i)) {
                            return null;
                        }

                        return parseFloat(deploy_helpers.toStringSafe(i).trim());
                    };
                    break;

                case 'int':
                case 'integer':
                    converter = (i) => {
                        if (deploy_helpers.isEmptyString(i)) {
                            return null;
                        }

                        return parseInt(deploy_helpers.toStringSafe(i).trim());
                    };
                    break;

                case 'json':
                case 'obj':
                case 'object':
                    converter = (i) => {
                        return JSON.parse(
                            deploy_helpers.toStringSafe(i).trim()
                        );
                    };
                    break;

                case '':
                case 'string':
                case 'str':
                    break;
            }

            if (converter) {
                valueToSet = await Promise.resolve(
                    converter(valueToSet)
                );
            }

            const PROPERTIES = deploy_helpers.asArray(P.properties).map(p => {
                return deploy_helpers.toStringSafe(p).trim();
            }).filter(p => '' !== p).forEach(p => {
                PROPERTIES_AND_VALUES[p] = valueToSet;
            });
        }

        // create targets with prompt settings
        for (const T of deploy_helpers.asArray(targets)) {
            let ct = deploy_helpers.cloneObjectFlat(T);
            ct = MergeDeep(ct, PROPERTIES_AND_VALUES);

            CLONED_TARGETS.push(ct);
        }
        
        return CLONED_TARGETS;
    }
}

/**
 * Creates a new instance of that plugin.
 * 
 * @param {deploy_plugins.PluginContext} context The context for the plugin.
 * 
 * @return {deploy_plugins.Plugin} The new plugin.
 */
export function createPlugins(context: deploy_plugins.PluginContext) {
    return new PromptPlugin(context);
}
