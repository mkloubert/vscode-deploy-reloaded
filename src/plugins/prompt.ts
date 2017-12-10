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
}


class PromptPlugin extends deploy_plugins.IterablePluginBase<PromptTarget> {
    protected async prepareTargetsMany(promptTarget: PromptTarget, targets: deploy_targets.Target | deploy_targets.Target[]): Promise<deploy_targets.Target[] | false> {
        const ME = this;

        const CLONED_TARGETS: deploy_targets.Target[] = [];

        const SCOPES = [
            promptTarget.__workspace.settingFolder,
            Path.join(OS.homedir(), deploy_contracts.HOMEDIR_SUBFOLDER),
        ];

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
                        DOWNLOAD_SOURCE, SCOPES
                    )).toString('utf8')
                );
        }

        const PROPERTIES_AND_VALUES: deploy_contracts.KeyValuePairs = {};

        for (const P of deploy_helpers.asArray(prompts)) {
            const VALUE = await vscode.window.showInputBox({
                ignoreFocusOut: deploy_helpers.toBooleanSafe(P.ignoreFocusOut, true),
                password: deploy_helpers.toBooleanSafe(P.isPassword),
                placeHolder: deploy_helpers.toStringSafe(
                    ME.replaceWithValues(promptTarget, P.placeHolder)
                ).trim(),
                prompt: deploy_helpers.toStringSafe(
                    ME.replaceWithValues(promptTarget, P.text)
                ).trim()
            });

            if (deploy_helpers.isNullOrUndefined(VALUE)) {
                return false;  // cancelled
            }

            const PROPERTIES = deploy_helpers.asArray(P.properties).map(p => {
                return deploy_helpers.toStringSafe(p).trim();
            }).filter(p => '' !== p).forEach(p => {
                PROPERTIES_AND_VALUES[p] = VALUE;
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
