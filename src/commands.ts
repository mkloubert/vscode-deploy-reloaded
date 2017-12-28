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
import * as deploy_events from './events';
import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as deploy_values from './values';
import * as deploy_workspaces from './workspaces';
import * as vscode from 'vscode';


/**
 * A script command.
 */
export interface ScriptCommand {
    /**
     * A button for the command.
     */
    readonly button?: ScriptCommandButton;
    /**
     * Cache script module or not.
     */
    readonly cache?: boolean;
    /**
     * Do not submit a 'ScriptCommandExecutionContext' object as first argument.
     */
    readonly noFirstArgument?: boolean;
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
 * A button for a script button.
 */
export interface ScriptCommandButton extends deploy_contracts.Button {
    /**
     * Show button at beginning or not.
     */
    readonly show?: boolean;
}

/**
 * An execution context for a script command.
 */
export interface ScriptCommandExecutionContext extends deploy_contracts.ScriptArguments {
    /**
     * The underlying button, if defined.
     */
    readonly button: vscode.Disposable;
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
     * The button for this command.
     */
    readonly button: vscode.Disposable;
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

                deploy_helpers.tryDispose(CMD.button);
            }
        }
    }
}

/**
 * Reloads the commands of a workspace.
 * 
 * @param {deploy_contracts.Configuration} newCfg The new config.
 */
export async function reloadCommands(newCfg: deploy_contracts.Configuration) {
    const ME: deploy_workspaces.Workspace = this;

    if (!newCfg.commands) {
        return;
    }

    const GLOBAL_STATE: deploy_contracts.KeyValuePairs = {};

    const CREATE_ACTION = (id: string, sc: ScriptCommand, btn: vscode.Disposable) => {
        let cmdState: any;

        return async function() {
            const CACHE = deploy_helpers.toBooleanSafe(sc.cache);
            
            let script = deploy_helpers.toStringSafe(sc.script);
            if (deploy_helpers.isEmptyString(script)) {
                script = `./${id.trim()}.js`;
            }

            const SCRIPT_PATH = await ME.getExistingSettingPath(script);
            if (false === SCRIPT_PATH) {
                throw new Error(ME.t('commands.scriptNotFound', script));
            }

            const SCRIPT_MODULE = deploy_helpers.loadModule<ScriptCommandModule>(SCRIPT_PATH, CACHE);
            if (SCRIPT_MODULE) {
                const EXECUTE = SCRIPT_MODULE.execute;
                if (EXECUTE) {
                    const CTX: ScriptCommandExecutionContext = {
                        button: btn,
                        command: id,
                        globalEvents: deploy_events.EVENTS,
                        globals: ME.globals,
                        globalState: GLOBAL_STATE,
                        logger: deploy_log.CONSOLE,
                        options: deploy_helpers.cloneObject(sc.options),
                        replaceWithValues: (val) => {
                            return ME.replaceWithValues(val);
                        },
                        require: (moduleId) => {
                            return deploy_helpers.requireFromExtension(moduleId);
                        },
                        state: undefined,
                    };

                    // CTX.state
                    Object.defineProperty(CTX, 'state', {
                        enumerable: true,

                        get: () => {
                            return cmdState;
                        },

                        set: (newValue) => {
                            cmdState = newValue;
                        }
                    });

                    let args: any[] = [];
                    if (!deploy_helpers.toBooleanSafe(sc.noFirstArgument)) {
                        args.push(CTX);
                    }

                    return await Promise.resolve(
                        EXECUTE.apply(SCRIPT_MODULE,
                                        args.concat( deploy_helpers.toArray(arguments) ))
                    );
                }
                else {
                    deploy_log.CONSOLE
                              .warn(`'${SCRIPT_PATH}' contains NO 'execute()' function!`,
                                    'commands.reloadCommands()');
                }
            }
            else {
                deploy_log.CONSOLE
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
                        ME.showErrorMessage(
                            ME.t('commands.executionError', id, e)
                        );
                    }
                }

                return lastResult;
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, `commands.reloadCommands().REGISTER_NEW_COMMAND(${id}).1`);
            }
        });
    };

    for (const ID in newCfg.commands) {
        let newCommand: vscode.Disposable;
        let newCommandBtn: vscode.Disposable;
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

            let enableBtn = false;
            if (!deploy_helpers.isNullOrUndefined(scriptCmd.button)) {
                enableBtn = deploy_helpers.toBooleanSafe(scriptCmd.button.enabled, true);

                if (enableBtn) {
                    newCommandBtn = await deploy_helpers.createButton(scriptCmd.button, async (btn, opts) => {
                        const BTN_CMD = ID;

                        const VALUES: deploy_values.Value[] = [
                            new deploy_values.StaticValue({
                                    value: BTN_CMD
                                },
                                'command'
                            ),
                            new deploy_values.StaticValue({
                                    value: opts
                                },
                                'options'
                            ),
                            new deploy_values.FunctionValue(
                                () => ME.name,
                                'workspace'
                            ),
                            new deploy_values.FunctionValue(
                                () => ME.rootPath,
                                'workspace_folder'
                            )
                        ];

                        btn.text = ME.replaceWithValues(
                            deploy_helpers.toStringSafe(opts.text),
                            VALUES
                        );
                        if (deploy_helpers.isEmptyString(btn.text)) {
                            btn.text = `${BTN_CMD}`;
                        }

                        btn.tooltip = ME.replaceWithValues(
                            deploy_helpers.toStringSafe(opts.tooltip),
                            VALUES
                        );
                        if (deploy_helpers.isEmptyString(btn.tooltip)) {
                            btn.tooltip = `${ME.name}`;
                        }

                        btn.command = BTN_CMD;

                        if (deploy_helpers.toBooleanSafe(scriptCmd.button.show, true)) {
                            btn.show();
                        }
                    });
                }
            }

            ME.context.commands[ID].push(
                {
                    action: CREATE_ACTION(ID, scriptCmd, newCommandBtn),
                    button: newCommandBtn,
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
            deploy_helpers.tryDispose(newCommandBtn);
            deploy_helpers.tryDispose(newCommand);

            throw e;
        }
    }
}
