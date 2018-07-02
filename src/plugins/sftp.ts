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
import * as deploy_clients_sftp from '../clients/sftp';
import * as deploy_contracts from '../contracts';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as deploy_workspaces from '../workspaces';
import * as Events from 'events';
import * as i18 from '../i18';
import * as vscode from 'vscode';


/**
 * A module for an event that is raised BEFORE a file is going to be uploaded.
 */
export interface SFTPBeforeUploadModule {
    /**
     * The execution method.
     */
    readonly execute: SFTPBeforeUploadModuleExecutor;
}

/**
 * Describes an execution method of a module for an event that is raised BEFORE a file is going to be uploaded.
 * 
 * @param {SFTPBeforeUploadModuleExecutorArguments} args Arguments for the execution.
 * 
 * @return {any} The result.
 */
export type SFTPBeforeUploadModuleExecutor = (args: SFTPBeforeUploadModuleExecutorArguments) => any;

/**
 * Arguments of a module's method for an event that is raised BEFORE a file is going to be uploaded.
 */
export interface SFTPBeforeUploadModuleExecutorArguments extends SFTPUploadScriptArguments {
    /**
     * The underlying context.
     */
    readonly context: deploy_clients_sftp.SFTPBeforeUploadArguments;
}

interface SFTPContext extends deploy_plugins.AsyncFileClientPluginContext<SFTPTarget,
                                                                          deploy_clients_sftp.SFTPClient> {
}

/**
 * Script arguments for a deploy event.
 */
export interface SFTPDeployEventScriptArguments extends deploy_contracts.ScriptArguments {
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
    readonly target: SFTPTarget;
    /**
     * The underlying workspace.
     */
    readonly workspace: deploy_workspaces.Workspace;
}

/**
 * A 'sftp' target.
 */
export interface SFTPTarget extends deploy_targets.Target {
    /**
     * Name or path to ssh-agent for ssh-agent-based user authentication.
     */
    readonly agent?: string;
    /**
     * Set to (true) to use OpenSSH agent forwarding (auth-agent@openssh.com) for the life of the connection.
     * 'agent' property must also be set to use this feature.
     */
    readonly agentForward?: boolean;
    /**
     * Always ask for password and do not cache, if no password is defined.
     */
    readonly alwaysAskForPassword?: boolean;
    /**
     * Always ask for private key passphrase and do not cache.
     */
    readonly alwaysAskForPrivateKeyPassphrase?: boolean;
    /**
     * Always ask for uasername and do not cache, if no user is defined.
     */
    readonly alwaysAskForUser?: boolean;
    /**
     * Ask for private key passphrase.
     */
    readonly askForPrivateKeyPassphrase?: boolean;
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
    readonly commands?: deploy_clients_sftp.SFTPCommandSettings;
    /**
     * Show debug output or not.
     */
    readonly debug?: boolean;
    /**
     * The remote directory.
     */
    readonly dir?: string;
    /**
     * The algorithm to use to verify the fingerprint of a host.
     */
    readonly hashAlgorithm?: string;
    /**
     * One or more hashes to verify.
     */
    readonly hashes?: string | string[];
    /**
     * The hostname
     */
    readonly host?: string;
    /**
     * Defines the modes for files, after they have been uploaded.
     */
    readonly modes?: deploy_clients_sftp.SFTPFileModeSettings;
    /**
     * The password.
     */
    readonly password?: string;
    /**
     * The custom TCP port.
     */
    readonly port?: number;
    /**
     * Path to the private key file.
     */
    readonly privateKey?: string;
    /**
     * The passphrase for the key file, if needed.
     */
    readonly privateKeyPassphrase?: string;
    /**
     * How long (in milliseconds) to wait for the SSH handshake to complete.
     */
    readonly readyTimeout?: number;
    /**
     * Server supports deep directory creation or not.
     */
    readonly supportsDeepDirectoryCreation?: boolean;
    /**
     * Try keyboard-interactive user authentication if primary user authentication method fails.
     */
    readonly tryKeyboard?: boolean;
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
export interface SFTPUploadScriptArguments extends SFTPDeployEventScriptArguments {
    /**
     * The underlying target.
     */
    readonly target: SFTPTarget;
    /**
     * The underlying workspace.
     */
    readonly workspace: deploy_workspaces.Workspace;
}

/**
 * A module for an event that is raised AFTER a file has been uploaded or has trying to be uploaded.
 */
export interface SFTPUploadedModule {
    /**
     * The execution method.
     */
    readonly execute: SFTPUploadedModuleExecutor;
}

/**
 * Describes an execution method of a module for an event that is raised AFTER a file has been uploaded or has trying to be uploaded.
 * 
 * @param {SFTPUploadedModuleExecutorArguments} args Arguments for the execution.
 * 
 * @return {any} The result.
 */
export type SFTPUploadedModuleExecutor = (args: SFTPUploadedModuleExecutorArguments) => any;

/**
 * Arguments of a module's method for an event that is raised AFTER a file has been uploaded or has trying to be uploaded.
 */
export interface SFTPUploadedModuleExecutorArguments extends SFTPUploadScriptArguments {
    /**
     * The underlying context.
     */
    readonly context: deploy_clients_sftp.SFTPUploadCompletedArguments;
}


const CACHE_PASSWORD = 'password';
const CACHE_PRIV_KEY_PASSPHRASE = 'privateKeyPassphrase';
const CACHE_USER = 'user';

class SFTPPlugin extends deploy_plugins.AsyncFileClientPluginBase<SFTPTarget,
                                                                  deploy_clients_sftp.SFTPClient,
                                                                  SFTPContext> {
    private readonly _EVENTS = new Events.EventEmitter();
    private readonly _GLOBAL_STATE: deploy_contracts.KeyValuePairs = {};
    private readonly _SCRIPT_STATES: deploy_contracts.KeyValuePairs = {};

    protected async createContext(target: SFTPTarget): Promise<SFTPContext> {
        const CACHE = this.getCache( target );
        const WORKSPACE = target.__workspace;

        let agent = this.replaceWithValues(target, target.agent);
        if (deploy_helpers.isEmptyString(agent)) {
            agent = undefined;
        }
        else {
            const AGENT_PATH = await target.__workspace.getExistingSettingPath(agent);
            if (false !== AGENT_PATH) {
                agent = AGENT_PATH;
            }
        }

        let privateKeyFile: string | false = this.replaceWithValues(target, target.privateKey);
        if (deploy_helpers.isEmptyString(privateKeyFile)) {
            privateKeyFile = undefined;
        }
        else {
            privateKeyFile = await target.__workspace.getExistingSettingPath(privateKeyFile);
        }

        if (false === privateKeyFile) {
            throw new Error(i18.t('sftp.privateKeyNotFound',
                                  target.privateKey));
        }

        const IS_PRIVATE_KEY_DEFINED = !deploy_helpers.isEmptyString(privateKeyFile);

        const DIR = this.replaceWithValues(target, target.dir);

        let cachePassword = false;
        let cachePrivKeyPassphrase = false;
        let cacheUsername = false;

        const ALWAYS_ASK_FOR_USER = deploy_helpers.toBooleanSafe( target.alwaysAskForUser );
        let user = target.user;
        if (_.isNil(user) && !IS_PRIVATE_KEY_DEFINED) {
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
        if (_.isNil(pwd) && !IS_PRIVATE_KEY_DEFINED) {
            let askForPassword = ALWAYS_ASK_FOR_PASSWORD;
            if (!askForPassword) {
                askForPassword = !CACHE.has( CACHE_PASSWORD );
            }

            if (askForPassword) {
                pwd = await vscode.window.showInputBox({
                    ignoreFocusOut: true,
                    password: true,
                    prompt: this.t(target, 'credentials.enterPassword'),
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

        const ASK_FOR_PRIV_KEY_PASSPHRASE = deploy_helpers.toBooleanSafe( target.askForPrivateKeyPassphrase );
        const ALWAYS_ASK_FOR_PRIV_KEY_PASSPHRASE = deploy_helpers.toBooleanSafe( target.alwaysAskForPrivateKeyPassphrase );
        let privateKeyPassphrase = target.privateKeyPassphrase;
        if (IS_PRIVATE_KEY_DEFINED && ASK_FOR_PRIV_KEY_PASSPHRASE && _.isNil(privateKeyPassphrase)) {
            let askForPrivKeyPassphrase = ALWAYS_ASK_FOR_PRIV_KEY_PASSPHRASE;
            if (!askForPrivKeyPassphrase) {
                askForPrivKeyPassphrase = !CACHE.has( CACHE_PRIV_KEY_PASSPHRASE );
            }

            if (askForPrivKeyPassphrase) {
                privateKeyPassphrase = await vscode.window.showInputBox({
                    ignoreFocusOut: true,
                    password: true,
                    prompt: this.t(target, 'credentials.enterPassphrase'),
                });

                if (_.isNil(privateKeyPassphrase)) {
                    return;
                }
            }
            else {
                privateKeyPassphrase = CACHE.get( CACHE_PRIV_KEY_PASSPHRASE );
            }

            cachePrivKeyPassphrase = !ALWAYS_ASK_FOR_PRIV_KEY_PASSPHRASE;
        }

        let beforeUpload: deploy_clients_sftp.SFTPBeforeUpload;
        let uploadCompleted: deploy_clients_sftp.SFTPUploadCompleted;
        {
            const SCRIPT_STATE_KEY = deploy_helpers.toStringSafe(target.__id);

            const BEFORE_UPLOAD_SCRIPT = WORKSPACE.replaceWithValues(target.beforeUpload);
            if (!deploy_helpers.isEmptyString(BEFORE_UPLOAD_SCRIPT)) {
                const BEFORE_UPLOAD_SCRIPT_PATH = await WORKSPACE.getExistingSettingPath(BEFORE_UPLOAD_SCRIPT);
                if (false === BEFORE_UPLOAD_SCRIPT_PATH) {
                    throw new Error(WORKSPACE.t('fileNotFound', BEFORE_UPLOAD_SCRIPT));
                }

                const BEFORE_UPLOAD_MODULE = deploy_helpers.loadModule<SFTPBeforeUploadModule>( BEFORE_UPLOAD_SCRIPT_PATH );
                if (BEFORE_UPLOAD_MODULE) {
                    beforeUpload = async (args) => {
                        const ARGS: SFTPBeforeUploadModuleExecutorArguments = {
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

                const UPLOADED_MODULE = deploy_helpers.loadModule<SFTPBeforeUploadModule>( UPLOADED_SCRIPT_PATH );
                if (UPLOADED_MODULE) {
                    uploadCompleted = async (args) => {
                        const ARGS: SFTPUploadedModuleExecutorArguments = {
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
                client: await deploy_clients_sftp.openConnection({
                    agent: agent,
                    beforeUpload: beforeUpload,
                    commands: target.commands,
                    debug: target.debug,
                    hashAlgorithm: this.replaceWithValues(target, target.hashAlgorithm),
                    hashes: target.hashes,
                    host: this.replaceWithValues(target, target.host),
                    modes: target.modes,
                    password: pwd,
                    port: parseInt(
                        deploy_helpers.toStringSafe(
                            this.replaceWithValues(target, target.port)
                        ).trim()
                    ),
                    privateKey: privateKeyFile,
                    privateKeyPassphrase: privateKeyPassphrase,
                    readyTimeout: parseInt(
                        deploy_helpers.toStringSafe(
                            this.replaceWithValues(target, target.readyTimeout)
                        ).trim()
                    ),
                    supportsDeepDirectoryCreation: target.supportsDeepDirectoryCreation,
                    uploadCompleted: uploadCompleted,
                    user: user,
                    valueProvider: () => WORKSPACE.getValues(),
                }),
                getDir: (subDir) => {
                    return deploy_helpers.normalizePath(
                        deploy_helpers.normalizePath(DIR) + 
                        '/' + 
                        deploy_helpers.normalizePath(subDir)
                    );
                },
                target: target,
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
            
            if (cachePrivKeyPassphrase) {
                CACHE.set(CACHE_PRIV_KEY_PASSPHRASE, privateKeyPassphrase);
            }
            else {
                CACHE.unset(CACHE_PRIV_KEY_PASSPHRASE);
            }
    
            return CTX;
        }
        catch (e) {
            CACHE.unset(CACHE_USER)
                 .unset(CACHE_PASSWORD)
                 .unset(CACHE_PRIV_KEY_PASSPHRASE);

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
    return new SFTPPlugin(context);
}
