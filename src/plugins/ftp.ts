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

import * as deploy_clients_ftp from '../clients/ftp';
import * as deploy_files from '../files';
import * as deploy_log from '../log';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';


interface FTPContext extends deploy_plugins.AsyncFileClientPluginContext<FTPTarget,
                                                                         deploy_clients_ftp.FTPClientBase> {
}

/**
 * A 'ftp' target.
 */
export interface FTPTarget extends deploy_targets.Target {
    /**
     * The root directory.
     */
    readonly dir?: string;
    /**
     * The engine.
     */
    readonly engine?: string;
    /**
     * The host.
     */
    readonly host?: string;
    /**
     * The password.
     */
    readonly password?: string;
    /**
     * The TCP port.
     */
    readonly port?: number;
    /**
     * The username.
     */
    readonly user?: string;
}


class FTPPlugin extends deploy_plugins.AsyncFileClientPluginBase<FTPTarget,
                                                                 deploy_clients_ftp.FTPClientBase,
                                                                 FTPContext> {
    public async createContext(target: FTPTarget): Promise<FTPContext> {
        return {
            client: await deploy_clients_ftp.openConnection({
                engine: target.engine,
                host: target.host,
                password: target.password,
                port: target.port,
                user: target.user,
            }),
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
    return new FTPPlugin(context);
}
