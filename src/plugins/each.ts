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

import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as Enumerable from 'node-enumerable';


/**
 * A 'each' target.
 */
export interface EachTarget extends deploy_targets.Target, deploy_targets.TargetProvider {
    readonly from: any | any[];
    readonly 'to': string | string[];
    readonly usePlaceholders?: boolean;
}


class EachPlugin extends deploy_plugins.IterablePluginBase<EachTarget> {
    protected prepareTarget(eachTarget: EachTarget, target: deploy_targets.Target): deploy_targets.Target[] {
        const ME = this;

        const CLONED_TARGETS: deploy_targets.Target[] = [];

        const FROM = deploy_helpers.asArray(eachTarget.from, false);
        const TO = Enumerable.from(deploy_helpers.asArray(eachTarget.to)).select(t => {
            return deploy_helpers.toStringSafe(t).trim()
        }).where(t => '' !== t)
            .toArray();
        const USE_PLACE_HOLDERS = deploy_helpers.toBooleanSafe(eachTarget.usePlaceholders, true);

        for (const F of FROM) {
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
