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
import * as deploy_delete from './delete';
import * as deploy_deploy from './deploy';
import * as deploy_events from './events';
import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as deploy_pull from './pull';
import * as deploy_session from './session';
import * as deploy_targets from './targets';
import * as deploy_values from './values';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as Events from 'events';
import * as i18 from './i18';
import * as Path from 'path';
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
                        events: ME.workspaceSessionState['commands']['events'],
                        extension: ME.context.extension,
                        folder: ME.folder,
                        globalEvents: deploy_events.EVENTS,
                        globals: ME.globals,
                        globalState: GLOBAL_STATE,
                        homeDir: deploy_helpers.getExtensionDirInHome(),
                        logger: ME.createLogger(),
                        options: deploy_helpers.cloneObject(sc.options),
                        output: ME.output,
                        replaceWithValues: (val) => {
                            return ME.replaceWithValues(val);
                        },
                        require: (moduleId) => {
                            return deploy_helpers.requireFromExtension(moduleId);
                        },
                        sessionState: deploy_session.SESSION_STATE,
                        settingFolder: ME.settingFolder,
                        state: undefined,
                        workspaceRoot: ME.rootPath,
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

/**
 * Handles a current file or folder.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {vscode.Uri} u The URI of the current file / folder.
 */
export async function handleCurrentFileOrFolder(context: vscode.ExtensionContext, u: vscode.Uri) {
    let fileOrFolder: string;
    if (deploy_helpers.isNullOrUndefined(u)) {
        // try get active editor document

        const ACTIVE_EDITOR = vscode.window.activeTextEditor;
        if (ACTIVE_EDITOR) {
            const DOC = ACTIVE_EDITOR.document;
            if (DOC) {
                fileOrFolder = DOC.fileName;
            }
        }
    }
    else {
        fileOrFolder = u.fsPath;
    }

    if (deploy_helpers.isEmptyString(fileOrFolder)) {
        deploy_helpers.showWarningMessage(
            i18.t('currentFileOrFolder.noneSelected')
        );

        return;
    }

    const ACTIVE_WORKSPACES = deploy_workspaces.getActiveWorkspaces();
    const ACTIVE_TARGETS = Enumerable.from(ACTIVE_WORKSPACES).selectMany(aws => {
        return aws.getTargets();
    }).toArray();
    if (ACTIVE_TARGETS.length < 1) {
        vscode.window.showWarningMessage(
            i18.t('workspaces.active.noneFound')
        );

        return;
    }

    try {
        const STATS = await deploy_helpers.lstat(fileOrFolder);
        
        const URI_TYPE: 'file' | 'folder' = STATS.isDirectory() ? 'folder' : 'file';

        const INVOKE_TARGET_ACTION = async (action: (target: deploy_targets.Target, files: string[]) => any,
                                            promptId: string) => {
            const SELECTED_TARGET = await deploy_targets.showTargetQuickPick(
                context,
                ACTIVE_TARGETS,
                {
                    placeHolder: i18.t(promptId)
                }
            );
            if (!SELECTED_TARGET) {
                return;
            }

            const WORKSPACE = SELECTED_TARGET.__workspace;

            let filesToHandle: string[] = [];
            if ('file' === URI_TYPE) {
                filesToHandle.push(u.fsPath);
            }
            else {
                Enumerable.from(await deploy_helpers.glob('**', {
                    cwd: fileOrFolder,
                    dot: true,
                    nosort: true,
                    nounique: false,
                    root: fileOrFolder,                    
                })).pushTo(filesToHandle);
            }

            filesToHandle = Enumerable.from(filesToHandle).distinct().where(f => {
                return WORKSPACE.isPathOf(f) &&
                       !WORKSPACE.isFileIgnored(f);
            }).orderBy(f => {
                return Path.dirname(f).length;
            }).thenBy(f => {
                return deploy_helpers.normalizeString(Path.dirname(f));
            }).thenBy(f => {
                return Path.basename(f).length;
            }).thenBy(f => {
                return deploy_helpers.normalizeString(Path.basename(f));
            }).distinct()
              .toArray();
            
            if (filesToHandle.length > 0) {
                await Promise.resolve(
                    action(SELECTED_TARGET, filesToHandle)
                );
            }
        };

        const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
            {
                action: async () => {
                    await INVOKE_TARGET_ACTION(async (target, files) => {
                        await deploy_helpers.applyFuncFor(
                            deploy_deploy.deployFilesTo,
                            target.__workspace
                        )(files,
                          target,
                          () => files);
                    }, 'deploy.selectTarget');
                },
                label: '$(rocket)  ' + i18.t(`deploy.currentFileOrFolder.${URI_TYPE}.label`),
                description: i18.t(`deploy.currentFileOrFolder.${URI_TYPE}.description`),
            },
            {
                action: async () => {
                    await INVOKE_TARGET_ACTION(async (target, files) => {
                        await deploy_helpers.applyFuncFor(
                            deploy_pull.pullFilesFrom,
                            target.__workspace
                        )(files,
                          target,
                          () => files);
                    }, 'pull.selectSource');
                },
                label: '$(cloud-download)  ' + i18.t(`pull.currentFileOrFolder.${URI_TYPE}.label`),
                description: i18.t(`pull.currentFileOrFolder.${URI_TYPE}.description`),
            },
            {
                action: async () => {
                    await INVOKE_TARGET_ACTION(async (target, files) => {
                        const WS = target.__workspace;

                        const BUTTONS: deploy_contracts.MessageItemWithValue[] = [
                            {
                                title: WS.t('no'),
                                value: 1,
                            },
                            {
                                title: WS.t('yes'),
                                value: 2,
                            },
                            {
                                isCloseAffordance: true,
                                title: WS.t('cancel'),
                                value: 0,
                            }
                        ];

                        let deleteLocalFiles = false;
                        {
                            const PRESSED_BTN: deploy_contracts.MessageItemWithValue = await vscode.window.showWarningMessage.apply(
                                null,
                                [ <any>WS.t('DELETE.askIfDeleteLocalFiles'), {} ].concat(BUTTONS),
                            );

                            if (!PRESSED_BTN || 0 == PRESSED_BTN.value) {
                                return;
                            }

                            deleteLocalFiles = 2 === PRESSED_BTN.value;
                        }

                        await deploy_helpers.applyFuncFor(
                            deploy_delete.deleteFilesIn,
                            WS
                        )(files,
                          target,
                          () => files,
                          deleteLocalFiles);
                    }, 'DELETE.selectTarget');
                },
                label: '$(trashcan)  ' + i18.t(`DELETE.currentFileOrFolder.${URI_TYPE}.label`),
                description: i18.t(`DELETE.currentFileOrFolder.${URI_TYPE}.description`),
            },
        ];

        const SELECTED_ITEM = await vscode.window.showQuickPick(
            QUICK_PICKS,
            {
                ignoreFocusOut: true
            }
        );
        if (SELECTED_ITEM) {
            await Promise.resolve(
                SELECTED_ITEM.action()
            ); 
        }
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'extension.deploy.reloaded.currentFileOrFolder');
    }
}
