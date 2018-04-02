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

import * as deploy_clients_azureblob from '../clients/azureblob';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';


interface AzureBlobContext extends deploy_plugins.AsyncFileClientPluginContext<AzureBlobTarget,
                                                                               deploy_clients_azureblob.AzureBlobClient> {
}

/**
 * An 'Azure blob' target.
 */
export interface AzureBlobTarget extends deploy_targets.Target {
    /**
     * The access key.
     */
    readonly accessKey?: string;
    /**
     * The account name.
     */
    readonly account?: string;
    /**
     * The container name.
     */
    readonly container?: string;
    /**
     * The custom root directory. 
     */
    readonly dir?: string;
    /**
     * Hash content or not.
     */
    readonly hashContent?: boolean;
    /**
     * The custom host address.
     */
    readonly host?: string;
    /**
     * Use local development storage or not.
     */
    readonly useDevelopmentStorage?: boolean;
}

class AzureBlobPlugin extends deploy_plugins.AsyncFileClientPluginBase<AzureBlobTarget,
                                                                       deploy_clients_azureblob.AzureBlobClient,
                                                                       AzureBlobContext> {
    protected async createContext(target: AzureBlobTarget): Promise<AzureBlobContext> {
        const DIR = this.replaceWithValues(target, target.dir);

        return {
            client: deploy_clients_azureblob.createClient({
                accessKey: this.replaceWithValues(target, target.accessKey),
                account: this.replaceWithValues(target, target.account),
                container: this.replaceWithValues(target, target.container),
                hashContent: target.hashContent,
                host: this.replaceWithValues(target, target.host),
                useDevelopmentStorage: target.useDevelopmentStorage,
            }),
            getDir: (subDir) => {
                return deploy_helpers.normalizePath(
                    deploy_helpers.normalizePath(DIR).trim() + 
                    '/' + 
                    deploy_helpers.normalizePath(subDir).trim()
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
    return new AzureBlobPlugin(context);
}
