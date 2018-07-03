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
import * as deploy_contracts from '../contracts';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as deploy_workspaces from '../workspaces';
import * as Events from 'events';
import * as vscode from 'vscode';


/**
 * A module for an event that is raised BEFORE a file is going to be uploaded.
 */
export interface FTPBeforeUploadModule {
    /**
     * The execution method.
     */
    readonly execute: FTPBeforeUploadModuleExecutor;
}

/**
 * Describes an execution method of a module for an event that is raised BEFORE a file is going to be uploaded.
 * 
 * @param {FTPBeforeUploadModuleExecutorArguments} args Arguments for the execution.
 * 
 * @return {any} The result.
 */
export type FTPBeforeUploadModuleExecutor = (args: FTPBeforeUploadModuleExecutorArguments) => any;

/**
 * Arguments of a module's method for an event that is raised BEFORE a file is going to be uploaded.
 */
export interface FTPBeforeUploadModuleExecutorArguments extends FTPUploadScriptArguments {
    /**
     * The underlying context.
     */
    readonly context: deploy_clients_ftp.FTPBeforeUploadArguments;
}

interface FTPContext extends deploy_plugins.AsyncFileClientPluginContext<FTPTarget,
                                                                         deploy_clients_ftp.FTPClientBase> {
}

/**
 * Script arguments for a deploy event.
 */
export interface FTPDeployEventScriptArguments extends deploy_contracts.ScriptArguments {
    /**
     * The kind of deploy event.
     */
    readonly deployEvent: deploy_contracts.DeployEvent;
    /**
     * The kind of operation.
     */
    readonly deployOperation: deploy_contracts.DeployOperation;
    /**
     * The underlying target.
     */
    readonly target: FTPTarget;
    /**
     * The underlying workspace.
     */
    readonly workspace: deploy_workspaces.Workspace;
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
     * Ask for password.
     */
    readonly askForPassword?: boolean;
    /**
     * Ask for username.
     */
    readonly askForUser?: boolean;
    /**
     * The path to an (event) script, which is executed BEFORE a file is going to be uploaded.
     */
    readonly beforeUpload?: string;
    /**
     * Options for the script defined in 'beforeUpload'.
     */
    readonly beforeUploadOptions?: any;
    /**
     * Commands to execute.
     */
    readonly commands?: deploy_clients_ftp.FTPCommandSettings;
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
     * Reject unauthorized server certificates or not.
     */
    readonly rejectUnauthorized?: boolean;
    /**
     * Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990) Default: false, applies only when engine is set to 'ftp'
     */
    readonly secure?: boolean | string;
    /**
     * Server supports deep directory creation or not.
     */
    readonly supportsDeepDirectoryCreation?: boolean;
    /**
     * The path to an (event) script, which is executed AFTER a file has been uploaded or tried to be uploaded.
     */
    readonly uploaded?: string;
    /**
     * Options for the script defined in 'uploaded'.
     */
    readonly uploadedOptions?: any;
    /**
     * The username.
     */
    readonly user?: string;
}

/**
 * Arguments for an upload based event.
 */
export interface FTPUploadScriptArguments extends FTPDeployEventScriptArguments {
}

/**
 * A module for an event that is raised AFTER a file has been uploaded or has trying to be uploaded.
 */
export interface FTPUploadedModule {
    /**
     * The execution method.
     */
    readonly execute: FTPUploadedModuleExecutor;
}

/**
 * Describes an execution method of a module for an event that is raised AFTER a file has been uploaded or has trying to be uploaded.
 * 
 * @param {FTPUploadedModuleExecutorArguments} args Arguments for the execution.
 * 
 * @return {any} The result.
 */
export type FTPUploadedModuleExecutor = (args: FTPUploadedModuleExecutorArguments) => any;

/**
 * Arguments of a module's method for an event that is raised AFTER a file has been uploaded or has trying to be uploaded.
 */
export interface FTPUploadedModuleExecutorArguments extends FTPUploadScriptArguments {
    /**
     * The underlying context.
     */
    readonly context: deploy_clients_ftp.FTPUploadCompletedArguments;
}


const CACHE_PASSWORD = 'password';
const CACHE_USER = 'user';

class FTPPlugin extends deploy_plugins.AsyncFileClientPluginBase<FTPTarget,
                                                                 deploy_clients_ftp.FTPClientBase,
                                                                 FTPContext> {
    private readonly _EVENTS = new Events.EventEmitter();
    private readonly _GLOBAL_STATE: deploy_contracts.KeyValuePairs = {};
    private readonly _SCRIPT_STATES: deploy_contracts.KeyValuePairs = {};                                                                

    protected async createContext(target: FTPTarget): Promise<FTPContext> {
        const CACHE = this.getCache( target );
        const WORKSPACE = target.__workspace;

        const DIR = this.replaceWithValues(target, target.dir);

        let cachePassword = false;
        let cacheUsername = false;

        const ASK_FOR_USER = deploy_helpers.toBooleanSafe( target.askForUser );
        const ALWAYS_ASK_FOR_USER = deploy_helpers.toBooleanSafe( target.alwaysAskForUser );
        let user = target.user;
        if (ASK_FOR_USER && _.isNil(user)) {
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

        const ASK_FOR_PASSWORD = deploy_helpers.toBooleanSafe( target.askForPassword );
        const ALWAYS_ASK_FOR_PASSWORD = deploy_helpers.toBooleanSafe( target.alwaysAskForPassword );
        let pwd = target.password;
        if (ASK_FOR_PASSWORD && _.isNil(pwd)) {
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

        let beforeUpload: deploy_clients_ftp.FTPBeforeUpload;
        let uploadCompleted: deploy_clients_ftp.FTPUploadCompleted;
        {
            const SCRIPT_STATE_KEY = deploy_helpers.toStringSafe(target.__id);

            const BEFORE_UPLOAD_SCRIPT = WORKSPACE.replaceWithValues(target.beforeUpload);
            if (!deploy_helpers.isEmptyString(BEFORE_UPLOAD_SCRIPT)) {
                const BEFORE_UPLOAD_SCRIPT_PATH = await WORKSPACE.getExistingSettingPath(BEFORE_UPLOAD_SCRIPT);
                if (false === BEFORE_UPLOAD_SCRIPT_PATH) {
                    throw new Error(WORKSPACE.t('fileNotFound', BEFORE_UPLOAD_SCRIPT));
                }

                const BEFORE_UPLOAD_MODULE = deploy_helpers.loadModule<FTPBeforeUploadModule>( BEFORE_UPLOAD_SCRIPT_PATH );
                if (BEFORE_UPLOAD_MODULE) {
                    beforeUpload = async (args) => {
                        const ARGS: FTPBeforeUploadModuleExecutorArguments = {
                            _: require('lodash'),
                            context: args,
                            deployEvent: deploy_contracts.DeployEvent.BeforeDeployFile,
                            deployOperation: deploy_contracts.DeployOperation.Deploy,
                            events: this._EVENTS,
                            extension: target.__workspace.context.extension,
                            folder: target.__workspace.folder,
                            globalEvents: deploy_helpers.EVENTS,
                            globals: target.__workspace.globals,
                            globalState: this._GLOBAL_STATE,
                            homeDir: deploy_helpers.getExtensionDirInHome(),
                            logger: target.__workspace.createLogger(),
                            options: deploy_helpers.cloneObject(target.beforeUploadOptions),
                            output: undefined,
                            replaceWithValues: function (val) {
                                return this.workspace
                                           .replaceWithValues(val);
                            },
                            require: (id) => {
                                return deploy_helpers.requireFromExtension(id);
                            },
                            sessionState: deploy_helpers.SESSION,
                            settingFolder: undefined,
                            state: undefined,
                            target: target,
                            workspace: undefined,
                            workspaceRoot: undefined,
                        };

                        // ARGS.output
                        Object.defineProperty(ARGS, 'output', {
                            enumerable: true,

                            get: function () {
                                return this.workspace.output;
                            }
                        });

                        // ARGS.settingFolder
                        Object.defineProperty(ARGS, 'settingFolder', {
                            enumerable: true,

                            get: function () {
                                return this.workspace.settingFolder;
                            }
                        });

                        // ARGS.state
                        Object.defineProperty(ARGS, 'state', {
                            enumerable: true,

                            get: () => {
                                return this._SCRIPT_STATES[SCRIPT_STATE_KEY];
                            },

                            set: (newValue) => {
                                this._SCRIPT_STATES[SCRIPT_STATE_KEY] = newValue;
                            }
                        });

                        // ARGS.workspace
                        Object.defineProperty(ARGS, 'workspace', {
                            enumerable: true,

                            get: function () {
                                return this.target.__workspace;
                            }
                        });

                        // ARGS.workspaceRoot
                        Object.defineProperty(ARGS, 'workspaceRoot', {
                            enumerable: true,

                            get: function () {
                                return this.workspace.rootPath;
                            }
                        });

                        if (BEFORE_UPLOAD_MODULE.execute) {
                            await Promise.resolve(
                                BEFORE_UPLOAD_MODULE.execute( ARGS )
                            );
                        }
                    };
                }
            }

            const UPLOADED_SCRIPT = WORKSPACE.replaceWithValues(target.uploaded);
            if (!deploy_helpers.isEmptyString(UPLOADED_SCRIPT)) {
                const UPLOADED_SCRIPT_PATH = await WORKSPACE.getExistingSettingPath(UPLOADED_SCRIPT);
                if (false === UPLOADED_SCRIPT_PATH) {
                    throw new Error(WORKSPACE.t('fileNotFound', UPLOADED_SCRIPT));
                }

                const UPLOADED_MODULE = deploy_helpers.loadModule<FTPBeforeUploadModule>( UPLOADED_SCRIPT_PATH );
                if (UPLOADED_MODULE) {
                    uploadCompleted = async (args) => {
                        const ARGS: FTPUploadedModuleExecutorArguments = {
                            _: require('lodash'),
                            context: args,
                            deployEvent: deploy_contracts.DeployEvent.FileDeployed,
                            deployOperation: deploy_contracts.DeployOperation.Deploy,
                            events: this._EVENTS,
                            extension: target.__workspace.context.extension,
                            folder: target.__workspace.folder,
                            globalEvents: deploy_helpers.EVENTS,
                            globals: target.__workspace.globals,
                            globalState: this._GLOBAL_STATE,
                            homeDir: deploy_helpers.getExtensionDirInHome(),
                            logger: target.__workspace.createLogger(),
                            options: deploy_helpers.cloneObject(target.uploadedOptions),
                            output: undefined,
                            replaceWithValues: function (val) {
                                return this.workspace
                                           .replaceWithValues(val);
                            },
                            require: (id) => {
                                return deploy_helpers.requireFromExtension(id);
                            },
                            sessionState: deploy_helpers.SESSION,
                            settingFolder: undefined,
                            state: undefined,
                            target: target,
                            workspace: undefined,
                            workspaceRoot: undefined,
                        };

                        // ARGS.output
                        Object.defineProperty(ARGS, 'output', {
                            enumerable: true,

                            get: function () {
                                return this.workspace.output;
                            }
                        });

                        // ARGS.settingFolder
                        Object.defineProperty(ARGS, 'settingFolder', {
                            enumerable: true,

                            get: function () {
                                return this.workspace.settingFolder;
                            }
                        });

                        // ARGS.state
                        Object.defineProperty(ARGS, 'state', {
                            enumerable: true,

                            get: () => {
                                return this._SCRIPT_STATES[SCRIPT_STATE_KEY];
                            },

                            set: (newValue) => {
                                this._SCRIPT_STATES[SCRIPT_STATE_KEY] = newValue;
                            }
                        });

                        // ARGS.workspace
                        Object.defineProperty(ARGS, 'workspace', {
                            enumerable: true,

                            get: function () {
                                return this.target.__workspace;
                            }
                        });

                        // ARGS.workspaceRoot
                        Object.defineProperty(ARGS, 'workspaceRoot', {
                            enumerable: true,

                            get: function () {
                                return this.workspace.rootPath;
                            }
                        });

                        if (UPLOADED_MODULE.execute) {
                            await Promise.resolve(
                                UPLOADED_MODULE.execute( ARGS )
                            );
                        }
                    };
                }                
            }
        }

        try {
            const CTX = {
                client: await deploy_clients_ftp.openConnection({
                    beforeUpload: beforeUpload,
                    commands: target.commands,
                    engine: this.replaceWithValues(target, target.engine),
                    host: this.replaceWithValues(target, target.host),
                    password: pwd,
                    port: parseInt(
                        deploy_helpers.toStringSafe(
                            this.replaceWithValues(target, target.port)
                        ).trim()
                    ),
                    supportsDeepDirectoryCreation: target.supportsDeepDirectoryCreation,
                    uploadCompleted: uploadCompleted,
                    user: user,
                    secure: target.secure,
                    rejectUnauthorized: deploy_helpers.toBooleanSafe(target.rejectUnauthorized),
                    valueProvider: () => WORKSPACE.getValues(),
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

    protected onDispose() {
        super.onDispose();

        this._EVENTS.removeAllListeners();
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
