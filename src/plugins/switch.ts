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

import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as deploy_workspaces from '../workspaces';


class SwitchPlugin extends deploy_plugins.IterablePluginBase<deploy_workspaces.SwitchTarget> {
    protected async prepareTargetsMany(switchTarget: deploy_workspaces.SwitchTarget): Promise<deploy_targets.Target[] | false> {
        const ME = this;
        const WORKSPACE = switchTarget.__workspace;

        const OPTION = WORKSPACE.getSelectedSwitchOption(switchTarget);
        if (false === OPTION) {
            WORKSPACE.showWarningMessage(
                WORKSPACE.t('plugins.switch.noOptionSelected2')
            );

            return false;
        }

        const TARGETS = deploy_targets.getTargetsByName(
            OPTION.targets,
            WORKSPACE.getTargets(),
        );
        if (false === TARGETS) {
            return false;
        }

        return TARGETS;
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
    return new SwitchPlugin(context);
}
