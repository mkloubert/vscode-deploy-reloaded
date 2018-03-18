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

import * as _ from 'lodash';
import * as deploy_clients_ftp from '../clients/ftp';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as vscode from 'vscode';


interface FTPContext extends deploy_plugins.AsyncFileClientPluginContext<FTPTarget,
                                                                         deploy_clients_ftp.FTPClientBase> {
}

/**
 * A 'ftp' target.
 */
export interface FTPTarget extends deploy_targets.Target {
    /**
     * Always ask for password and do not cache, if no password is defined.
     */
    readonly alwaysAskForPassword?: boolean;
    /**
     * Always ask for uasername and do not cache, if no user is defined.
     */
    readonly alwaysAskForUser?: boolean;
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


const CACHE_PASSWORD = 'password';
const CACHE_USER = 'user';

class FTPPlugin extends deploy_plugins.AsyncFileClientPluginBase<FTPTarget,
                                                                 deploy_clients_ftp.FTPClientBase,
                                                                 FTPContext> {
    protected async createContext(target: FTPTarget): Promise<FTPContext> {
        const CACHE = this.getCache( target );

        const DIR = this.replaceWithValues(target, target.dir);

        let cachePassword = false;
        let cacheUsername = false;

        const ALWAYS_ASK_FOR_USER = deploy_helpers.toBooleanSafe( target.alwaysAskForUser );
        let user = target.user;
        if (_.isNil(user)) {
            let askForUser = ALWAYS_ASK_FOR_USER;
            if (!askForUser) {
                askForUser = !CACHE.has( CACHE_USER );
            }

            if (askForUser) {
                user = await vscode.window.showInputBox({
                    ignoreFocusOut: true,
                    prompt: this.t(target, 'credentials.enterUsername')
                });

                if (_.isNil(user)) {
                    return;
                }
            }
            else {
                user = CACHE.get( CACHE_USER );
            }

            cacheUsername = !ALWAYS_ASK_FOR_USER;
        }

        const ALWAYS_ASK_FOR_PASSWORD = deploy_helpers.toBooleanSafe( target.alwaysAskForPassword );
        let pwd = target.password;
        if (_.isNil(pwd)) {
            let askForPassword = ALWAYS_ASK_FOR_PASSWORD;
            if (!askForPassword) {
                askForPassword = !CACHE.has( CACHE_PASSWORD );
            }

            if (askForPassword) {
                pwd = await vscode.window.showInputBox({
                    ignoreFocusOut: true,
                    password: true,
                    prompt: this.t(target, 'credentials.enterPassword')
                });

                if (_.isNil(pwd)) {
                    return;
                }
            }
            else {
                pwd = CACHE.get( CACHE_PASSWORD );
            }

            cachePassword = !ALWAYS_ASK_FOR_PASSWORD;
        }

        try {
            const CTX = {
                client: await deploy_clients_ftp.openConnection({
                    engine: this.replaceWithValues(target, target.engine),
                    host: this.replaceWithValues(target, target.host),
                    password: pwd,
                    port: parseInt(
                        deploy_helpers.toStringSafe(
                            this.replaceWithValues(target, target.port)
                        ).trim()
                    ),
                    user: user,
                }),
                getDir: (subDir) => {
                    return deploy_helpers.normalizePath(
                        deploy_helpers.normalizePath(DIR) + 
                        '/' + 
                        deploy_helpers.normalizePath(subDir)
                    );
                },
                target: target
            };

            if (cacheUsername) {
                CACHE.set(CACHE_USER, user);
            }
            else {
                CACHE.unset(CACHE_USER);
            }

            if (cachePassword) {
                CACHE.set(CACHE_PASSWORD, pwd);
            }
            else {
                CACHE.unset(CACHE_PASSWORD);
            }

            return CTX;
        }
        catch (e) {
            CACHE.unset(CACHE_USER)
                 .unset(CACHE_PASSWORD);

            throw e;
        }
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
