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

import * as deploy_clients_dropbox from '../clients/dropbox';
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_log from '../log';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';


interface DropboxContext extends deploy_plugins.AsyncFileClientPluginContext<DropboxTarget,
                                                                             deploy_clients_dropbox.DropBoxClient> {
}

/**
 * A 'Dropbox' target.
 */
export interface DropboxTarget extends deploy_targets.Target {
    /**
     * The root directory.
     */
    readonly dir?: string;
    /**
     * The API token to use.
     */
    readonly token: string;
}


class DropboxPlugin extends deploy_plugins.AsyncFileClientPluginBase<DropboxTarget,
                                                                     deploy_clients_dropbox.DropBoxClient,
                                                                     DropboxContext> {
    public createContext(target: DropboxTarget): DropboxContext {
        const DIR = this.replaceWithValues(target, target.dir);

        return {
            client: deploy_clients_dropbox.createClient({
                accessToken: this.replaceWithValues(target, target.token),
            }),
            getDir: (subDir) => {
                return deploy_clients_dropbox.normalizePath(
                    deploy_clients_dropbox.normalizePath(DIR).trim() + 
                    '/' + 
                    deploy_clients_dropbox.normalizePath(subDir).trim()
                );
            },
            target: target
        };
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
    return new DropboxPlugin(context);
}
