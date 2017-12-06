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

import * as deploy_contracts from './contracts';
import * as deploy_helpers from './helpers';
import * as deploy_logs from './log';
import * as deploy_workspaces from './workspaces';
import * as vscode from 'vscode';


/**
 * A script command.
 */
export interface ScriptCommand {
    /**
     * Cache script module or not.
     */
    readonly cache?: boolean;
    /**
     * The options for the script.
     */
    readonly options?: any;
    /**
     * The path to the script.
     */
    readonly script?: string;
}

/**
 * An execution context for a script command.
 */
export interface ScriptCommandExecutionContext extends deploy_contracts.ScriptArguments {
    /**
     * The ID of the underling command.
     */
    readonly command: string;
}

/**
 * A function method that holds the logic for a script command.
 * 
 * @param {ScriptCommandExecutionContext} context The execution context.
 * @param {...any} [args] One or more additional argument, submitted by 'vscode.commands.executeCommand'.
 * 
 * @return {any} The result of the execution.
 */
export type ScriptCommandExecutor = (context: ScriptCommandExecutionContext, ...args: any[]) => any;

/**
 * A module of a script command.
 */
export interface ScriptCommandModule {
    /**
     * The execution method.
     */
    readonly execute: ScriptCommandExecutor;
}

/**
 * A workspace command.
 */
export interface WorkspaceCommand {
    /**
     * The function for the command.
     */
    readonly action: Function;
    /**
     * The command (ID).
     */
    readonly command: string;
    /**
     * The object / value that should be applied to 'action'.
     */
    readonly thisArgs: any;
    /**
     * The workspace, the command belongs to.
     */
    readonly workspace: deploy_workspaces.Workspace;
}

/**
 * A repository of workspace commands.
 */
export type WorkspaceCommandRepository = { [command: string]: WorkspaceCommand[] };


/**
 * Cleans up all commands of a workspace.
 */
export function cleanupCommands() {
    const ME: deploy_workspaces.Workspace = this;

    for (const ID in ME.context.commands) {
        const COMMANDS = ME.context.commands[ID];
        if (!COMMANDS) {
            continue;
        }

        for (let i = 0; i < COMMANDS.length; i++) {
            const CMD = COMMANDS[i];

            if (CMD.workspace.id === ME.id) {
                COMMANDS.splice(i, 1);
            }
        }
    }
}

/**
 * Reloads the commands of a workspace.
 * 
 * @param {deploy_contracts.Configuration} newCfg The new config.
 */
export function reloadCommands(newCfg: deploy_contracts.Configuration) {
    const ME: deploy_workspaces.Workspace = this;

    if (!newCfg.commands) {
        return;
    }

    const CREATE_ACTION = (id: string, sc: ScriptCommand) => {
        return async function() {
            const CACHE = deploy_helpers.toBooleanSafe(sc.cache);
            
            let script = deploy_helpers.toStringSafe(sc.script);
            if (deploy_helpers.isEmptyString(script)) {
                script = `./${id.trim()}.js`;
            }

            const SCRIPT_PATH = await ME.getExistingSettingPath(script);
            if (false === SCRIPT_PATH) {
                //TODO: translate
                throw new Error(`'${script}' script not found!`);
            }

            const SCRIPT_MODULE = deploy_helpers.loadModule<ScriptCommandModule>(SCRIPT_PATH, CACHE);
            if (SCRIPT_MODULE) {
                const EXECUTE = SCRIPT_MODULE.execute;
                if (EXECUTE) {
                    const CTX: ScriptCommandExecutionContext = {
                        command: id,
                        globals: ME.globals,
                        options: deploy_helpers.cloneObject(sc.options),
                        require: (moduleId) => {
                            return deploy_helpers.requireFromExtension(moduleId);
                        }
                    };

                    let args: any[] = [];
                    args.push(CTX);

                    return await Promise.resolve(
                        EXECUTE.apply(SCRIPT_MODULE,
                                      args.concat( deploy_helpers.toArray(arguments) ))
                    );
                }
                else {
                    deploy_logs.CONSOLE
                               .warn(`'${SCRIPT_PATH}' contains NO 'execute()' function!`,
                                     'commands.reloadCommands()');
                }
            }
            else {
                deploy_logs.CONSOLE
                           .warn(`'${SCRIPT_PATH}' contains NO module!`,
                                 'commands.reloadCommands()');
            }
        };
    };

    const REGISTER_NEW_COMMAND = (id: string) => {
        ME.context.commands[id] = [];
        
        return vscode.commands.registerCommand(id, async function() {
            try {
                let lastResult: any;

                for (const CMD of ME.context.commands[id]) {
                    try {
                        lastResult = await Promise.resolve(
                            CMD.action
                               .apply(CMD.thisArgs, arguments)                                           
                        );
                    }
                    catch (e) {
                        // TODO: translate
                        ME.showErrorMessage(`Could not execute command '${id}'! '${deploy_helpers.toStringSafe(e)}'`).then(() => {
                        }).catch((err) => {
                            deploy_logs.CONSOLE
                                       .trace(err, `commands.reloadCommands().REGISTER_NEW_COMMAND(${id}).2`);
                        });
                    }
                }

                return lastResult;
            }
            catch (e) {
                deploy_logs.CONSOLE
                           .trace(e, `commands.reloadCommands().REGISTER_NEW_COMMAND(${id}).1`);
            }
        });
    };

    for (const ID in newCfg.commands) {
        let newCommand: vscode.Disposable;
        try {
            const CMD = newCfg.commands[ID];

            let scriptCmd: ScriptCommand;
            if (deploy_helpers.isObject<ScriptCommand>(CMD)) {
                scriptCmd = CMD;
            }
            else {
                scriptCmd = {
                    script: deploy_helpers.toStringSafe(CMD)
                };
            }

            if (!ME.context.commands[ID]) {
                newCommand = REGISTER_NEW_COMMAND(ID);
            }

            ME.context.commands[ID].push(
                {
                    action: CREATE_ACTION(ID, scriptCmd),
                    command: ID,
                    thisArgs: ME,
                    workspace: ME,
                }
            );

            if (newCommand) {
                ME.context.extension
                          .subscriptions.push(newCommand);
            }
        }
        catch (e) {
            deploy_helpers.tryDispose(newCommand);

            throw e;
        }
    }
}
