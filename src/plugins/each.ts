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

import * as deploy_download from '../download';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as Enumerable from 'node-enumerable';


/**
 * A 'each' target.
 */
export interface EachTarget extends deploy_targets.Target, deploy_targets.TargetProvider {
    /**
     * A list of values or a source from where to load it.
     */
    readonly from: string | any | any[];
    /**
     * One or more property names where the source values should be written to.
     */
    readonly 'to': string | string[];
    /**
     * Use placeholders for string values or not.
     */
    readonly usePlaceholders?: boolean;
}

class EachPlugin extends deploy_plugins.IterablePluginBase<EachTarget> {
    protected async prepareTarget(eachTarget: EachTarget, target: deploy_targets.Target): Promise<deploy_targets.Target[]> {
        const ME = this;
        const WORKSPACE = eachTarget.__workspace;

        const CLONED_TARGETS: deploy_targets.Target[] = [];

        let from: any = eachTarget.from;
        if (deploy_helpers.isString(from)) {
            // extrenal source

            const DOWNLOAD_SOURCE = ME.replaceWithValues(
                eachTarget,
                from
            );

            from = JSON.parse(
                (await deploy_download.download(DOWNLOAD_SOURCE,
                                                WORKSPACE.getSettingScopes())).toString('utf8')
            );
        }

        from = deploy_helpers.asArray(from, false);

        const TO = Enumerable.from(deploy_helpers.asArray(eachTarget.to)).select(t => {
            return deploy_helpers.toStringSafe(t).trim();
        }).where(t => '' !== t)
          .toArray();
        const USE_PLACE_HOLDERS = deploy_helpers.toBooleanSafe(eachTarget.usePlaceholders, true);

        for (const F of from) {
            const CT = deploy_helpers.cloneObjectFlat(target);

            for (const PROP of TO) {
                let valueToSet = F;
                if (deploy_helpers.isString(valueToSet)) {
                    if (USE_PLACE_HOLDERS) {
                        valueToSet = ME.replaceWithValues(eachTarget, valueToSet);
                    }
                }

                CT[PROP] = valueToSet;
            }

            CLONED_TARGETS.push(CT);
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
    return new EachPlugin(context);
}
