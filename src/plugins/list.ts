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
import * as Enumerable from 'node-enumerable';
const MergeDeep = require('merge-deep');
import * as OS from 'os';
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * A 'list' target.
 */
export interface ListTarget extends deploy_targets.Target, deploy_targets.TargetProvider {
    /**
     * One or more entries with settings to show.
     */
    readonly entries: ListTargetEntry | ListTargetEntry[];
}

/**
 * An entry of a list target.
 */
export interface ListTargetEntry extends deploy_contracts.WithOptionalName {
    /**
     * A description for the GUI.
     */
    readonly description?: string;
    /**
     * The settings for the "real" target.
     */
    readonly settings: ListTargetSettings;
}

/**
 * Settings for a "real" target.
 */
export type ListTargetSettings = { [key: string]: any } | string;


class ListPlugin extends deploy_plugins.IterablePluginBase<ListTarget> {
    protected async prepareTargetsMany(listTarget: ListTarget, targets: deploy_targets.Target | deploy_targets.Target[]): Promise<deploy_targets.Target[] | false> {
        const ME = this;

        const CLONED_TARGETS: deploy_targets.Target[] = [];

        const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = deploy_helpers.asArray(listTarget.entries).map((e, i) => {
            let name = deploy_helpers.toStringSafe(e.name).trim();
            if ('' === name) {
                //TODO: translate
                name = `Entry #${i + 1}`;
            }

            const DESCRIPTION = deploy_helpers.toStringSafe(e.description).trim();

            return {
                action: async () => {
                    for (const T of deploy_helpers.asArray(targets)) {
                        let ct = deploy_helpers.cloneObjectFlat(T);
                        ct = MergeDeep(ct, e.settings);
    
                        CLONED_TARGETS.push(ct);
                    }
                },
                description: DESCRIPTION,
                label: name,
            };
        });

        //TODO: translate
        const SELECTED_ITEM = await vscode.window.showQuickPick(QUICK_PICKS, {
            placeHolder: 'Select the entry with settings to use for deployment...',
        });

        if (!SELECTED_ITEM) {
            return false;
        }

        await Promise.resolve(
            SELECTED_ITEM.action()
        );

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
    return new ListPlugin(context);
}
