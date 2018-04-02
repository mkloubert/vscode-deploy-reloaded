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
import * as vscode from 'vscode';


/**
 * A 'list' target.
 */
export interface ListTarget extends deploy_targets.Target, deploy_targets.TargetProvider {
    /**
     * One or more entries with settings to show or a source from where to download them.
     */
    readonly entries: string | ListTargetEntry | ListTargetEntry[];
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
     * The settings for the "real" target or a source from where to download them.
     */
    readonly settings: string | ListTargetSettings;
}

/**
 * Settings for a "real" target.
 */
export type ListTargetSettings = { [key: string]: any } | string;

class ListPlugin extends deploy_plugins.IterablePluginBase<ListTarget> {
    protected async prepareTargetsMany(listTarget: ListTarget, targets: deploy_targets.Target | deploy_targets.Target[]): Promise<deploy_targets.Target[] | false> {
        const ME = this;
        const WORKSPACE = listTarget.__workspace;

        const CLONED_TARGETS: deploy_targets.Target[] = [];

        let entries: string | ListTargetEntry | ListTargetEntry[];
        if (!deploy_helpers.isObject<ListTargetEntry>(entries) && !Array.isArray(entries)) {
            // download from source
            const DOWNLOAD_SOURCE = ME.replaceWithValues(
                listTarget,
                entries
            );

            entries =
                <ListTargetEntry | ListTargetEntry[]>JSON.parse(
                    (await deploy_download.download(
                        DOWNLOAD_SOURCE, WORKSPACE.getSettingScopes()
                    )).toString('utf8')
                );
        }

        const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = deploy_helpers.asArray(entries).map((e, i) => {
            let name = deploy_helpers.toStringSafe(
                ME.replaceWithValues(listTarget, e.name)
            ).trim();
            if ('' === name) {
                name = listTarget.__workspace
                                 .t('plugins.list.defaultEntryName', i + 1);
            }

            const DESCRIPTION = deploy_helpers.toStringSafe(
                ME.replaceWithValues(listTarget, e.description)
            ).trim();

            return {
                action: async () => {
                    let settingsToApply = e.settings;
                    if (!deploy_helpers.isObject<ListTargetSettings>(settingsToApply)) {
                        // download from source
                        const DOWNLOAD_SOURCE = ME.replaceWithValues(
                            listTarget,
                            settingsToApply
                        );

                        settingsToApply =
                            <ListTargetSettings>JSON.parse(
                                (await deploy_download.download(
                                    DOWNLOAD_SOURCE, WORKSPACE.getSettingScopes()
                                )).toString('utf8')
                            );
                    }

                    for (const T of deploy_helpers.asArray(targets)) {
                        let ct = deploy_helpers.cloneObjectFlat(T);
                        if (settingsToApply) {
                            ct = MergeDeep(ct, settingsToApply);
                        }
    
                        CLONED_TARGETS.push(ct);
                    }
                },
                description: DESCRIPTION,
                label: name,
            };
        });

        const SELECTED_ITEM = await vscode.window.showQuickPick(QUICK_PICKS, {
            placeHolder: listTarget.__workspace
                                   .t('plugins.list.selectEntry'),
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
