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
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_log from '../log';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as deploy_workspaces from '../workspaces';


/**
 * Arguments for a script.
 */
export interface ScriptArguments extends deploy_contracts.ScriptArguments, deploy_contracts.Cancelable {
    /**
     * The directory to list.
     */
    readonly dir?: string;
    /**
     * The files to delete / download or upload. 
     */
    readonly files?: deploy_workspaces.WorkspaceFile[];
    /**
     * The operation (type).
     */
    readonly operation: deploy_contracts.DeployOperation;
    /**
     * The underlying target.
     */
    readonly target: ScriptTarget;
    /**
     * The underlying workspace.
     */
    readonly workspace: deploy_workspaces.Workspace;
}

/**
 * The function / method that contains the logic for the script.
 * 
 * @param {ScriptArguments} args The arguments for the script.
 * 
 * @return {ScriptExecutorResult|PromiseLike<ScriptExecutorResult>} The result.
 */
export type ScriptExecutor = (args: ScriptArguments) => ScriptExecutorResult | PromiseLike<ScriptExecutorResult>;

/**
 * Possible result values for a 'script executor'.
 */
export type ScriptExecutorResult = void | undefined | null | deploy_files.FileInfo | deploy_files.FileInfo[];

/**
 * A script module.
 */
export interface ScriptModule {
    /**
     * The execution method.
     */
    readonly execute: ScriptExecutor;
}

 /**
 * A 'script' target.
 */
export interface ScriptTarget extends deploy_targets.Target {
    /**
     * Load script from cache or not.
     */
    readonly cache?: boolean;
    /**
     * Options for the script.
     */
    readonly options?: any;
    /**
     * The script to execute.
     */
    readonly script: string;
}


class ScriptPlugin extends deploy_plugins.PluginBase<ScriptTarget> {
    public get canDelete() {
        return true;
    }

    public get canDownload() {
        return true;
    }

    public get canList() {
        return true;
    }

    private async createScriptArgsFromContext(context: deploy_plugins.TargetContext<ScriptTarget>,
                                              operation: deploy_contracts.DeployOperation): Promise<ScriptArguments> {
        const ARGS: ScriptArguments = {
            cancellationToken: undefined,
            dir: context['dir'],
            files: context['files'],
            globals: context.target.__workspace.globals,
            isCancelling: undefined,
            logger: deploy_log.CONSOLE,
            operation: operation,
            options: deploy_helpers.cloneObject(context.target.options),
            require: (id) => {
                return deploy_helpers.requireFromExtension(id);
            },
            target: context.target,
            workspace: undefined,
        };

        // ARGS.cancellationToken
        Object.defineProperty(ARGS, 'cancellationToken', {
            enumerable: true,

            get: () => {
                return context.cancellationToken;
            }
        });

        // ARGS.isCancelling
        Object.defineProperty(ARGS, 'isCancelling', {
            enumerable: true,

            get: () => {
                return context.isCancelling;
            }
        });

        // ARGS.workspace
        Object.defineProperty(ARGS, 'workspace', {
            enumerable: true,

            get: function () {
                return this.target.__workspace;
            }
        });

        return ARGS;
    }

    private async executeScript(args: ScriptArguments): Promise<any> {
        let script = deploy_helpers.toStringSafe(args.target.script);
        if (deploy_helpers.isEmptyString(script)) {
            script = './deploy.js';
        }

        const SCRIPT_FILE = await args.target.__workspace.getExistingSettingPath(
            script
        );

        if (false === SCRIPT_FILE) {
            //TODO: translate
            throw new Error(`Deploy script '${script}' not found!`);
        }

        const SCRIPT_MODULE = await deploy_helpers.loadModule<ScriptModule>(SCRIPT_FILE, args.target.cache);
        if (SCRIPT_MODULE) {
            const EXECUTE = SCRIPT_MODULE.execute;
            if (EXECUTE) {
                return await Promise.resolve(
                    deploy_helpers.applyFuncFor(EXECUTE, SCRIPT_MODULE)(args)
                );
            }
            else {
                //TODO: translate
                deploy_log.CONSOLE
                          .warn(`Deploy script '${SCRIPT_FILE}' contains no 'execute()' method!`,
                                'plugins.script.executeScript(2)');
            }
        }
        else {
            //TODO: translate
            deploy_log.CONSOLE
                      .warn(`Deploy script '${SCRIPT_FILE}' contains no module!`,
                            'plugins.script.executeScript(1)');
        }
    }

    public async deleteFiles(context: deploy_plugins.DeleteContext<ScriptTarget>): Promise<void> {
        const ARGS = await this.createScriptArgsFromContext(context,
                                                            deploy_contracts.DeployOperation.Delete);

        await this.executeScript(ARGS);
    }

    public async downloadFiles(context: deploy_plugins.DownloadContext<ScriptTarget>): Promise<void> {
        const ARGS = await this.createScriptArgsFromContext(context,
                                                            deploy_contracts.DeployOperation.Pull);

        await this.executeScript(ARGS);
    }

    public async listDirectory(context: deploy_plugins.ListDirectoryContext<ScriptTarget>): Promise<deploy_plugins.ListDirectoryResult<ScriptTarget>> {
        const ARGS = await this.createScriptArgsFromContext(context,
                                                            deploy_contracts.DeployOperation.ListDirectory);

        const EXEC_RES: deploy_files.FileSystemInfo[] = await deploy_helpers.asArray(
            await this.executeScript(ARGS)
        );

        const RESULT: deploy_plugins.ListDirectoryResult<ScriptTarget> = {
            dirs: [],
            files: [],
            others: [],
            target: context.target,
        };

        for (const FSI of EXEC_RES) {
            switch (FSI.type) {
                case deploy_files.FileSystemType.Directory:
                    RESULT.dirs.push( <deploy_files.DirectoryInfo>FSI );
                    break;

                case deploy_files.FileSystemType.File:
                    RESULT.files.push( <deploy_files.FileInfo>FSI );
                    break;

                default:
                    RESULT.others.push( FSI );
                    break;
            }
        }

        return RESULT;
    }

    public async uploadFiles(context: deploy_plugins.UploadContext<ScriptTarget>): Promise<void> {
        const ARGS = await this.createScriptArgsFromContext(context,
                                                            deploy_contracts.DeployOperation.Deploy);

        await this.executeScript(ARGS);
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
    return new ScriptPlugin(context);
}
