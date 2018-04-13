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
import * as deploy_helpers from './helpers';
import * as deploy_list from './list';
import * as deploy_log from './log';
import * as deploy_plugins from './plugins';
import * as deploy_pull from './pull';
import * as deploy_targets from './targets';
import * as deploy_values from './values';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as FSExtra from 'fs-extra';
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
 * Executes Visual Studio Code commands on startup for the underlying workspace.
 */
export async function executeStartupCommands() {
    const WORKSPACE: deploy_workspaces.Workspace = this;

    const CFG = WORKSPACE.config;
    if (!CFG) {
        return;
    }

    try {
        for (let cmd of deploy_helpers.asArray(CFG.startupCommands)) {
            if (!deploy_helpers.isObject<deploy_contracts.StartupCommand>(cmd)) {
                cmd = {
                    command: cmd,
                };
            }

            const CMD_ID = deploy_helpers.toStringSafe(cmd.command);
            if (deploy_helpers.isEmptyString(CMD_ID)) {
                continue;
            }

            try {
                let args: any[];
                if (deploy_helpers.isNullOrUndefined(cmd.arguments)) {
                    args = [];
                }
                else {
                    args = deploy_helpers.asArray(cmd.arguments, false);
                }

                await vscode.commands.executeCommand
                                     .apply(null, [ <any>CMD_ID ].concat(args));
            }
            catch (e) {
                await WORKSPACE.showErrorMessage(
                    WORKSPACE.t('commands.executionError',
                                CMD_ID, e)
                );
            }
        }
    }
    catch (e) {
        WORKSPACE.logger
                 .trace(e, 'commands.executeStartupCommands()');
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
                        _: require('lodash'),
                        button: btn,
                        command: id,
                        events: ME.workspaceSessionState['commands']['events'],
                        extension: ME.context.extension,
                        folder: ME.folder,
                        globalEvents: deploy_helpers.EVENTS,
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
                        sessionState: deploy_helpers.SESSION,
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

                    const ARGS: any[] = [];
                    if (!deploy_helpers.toBooleanSafe(sc.noFirstArgument)) {
                        ARGS.push(CTX);
                    }

                    return await Promise.resolve(
                        EXECUTE.apply(SCRIPT_MODULE,
                                      ARGS.concat( deploy_helpers.toArray(arguments) ))
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
 * Handles files and folders.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {vscode.Uri} u The URI of the current file / folder.
 * @param {vscode.Uri[]} allItems The URI of all (selected) items.
 */
export async function handleFilesAndFolders(
    context: vscode.ExtensionContext,
    u: vscode.Uri, allItems: vscode.Uri[],
) {
    allItems = deploy_helpers.asArray(allItems);
    if (allItems.length < 1) {
        allItems.push(u);
    }
    allItems = deploy_helpers.asArray(allItems);

    let filesAndFolders: string[];
    if (allItems.length < 1) {
        // try get active editor document

        const ACTIVE_EDITOR = vscode.window.activeTextEditor;
        if (ACTIVE_EDITOR) {
            const DOC = ACTIVE_EDITOR.document;
            if (DOC) {
                filesAndFolders = [ DOC.fileName ];
            }
        }
    }
    else {
        filesAndFolders = allItems.map(u => u.fsPath);
    }
    filesAndFolders = Enumerable.from( deploy_helpers.asArray(filesAndFolders) )
                                .where(ff => !deploy_helpers.isEmptyString(ff))
                                .toArray();

    if (filesAndFolders.length < 1) {
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
        let uriType: 'file' | 'folder' | 'items' = 'items';
        if (1 === filesAndFolders.length) {
            const STATS = await deploy_helpers.lstat( filesAndFolders[0] );

            uriType = STATS.isDirectory() ? 'folder' : 'file';
        }

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
            for (const FF of filesAndFolders) {
                const STATS = await deploy_helpers.lstat(FF);

                if (STATS.isFile()) {
                    filesToHandle.push(FF);
                }
                else {
                    Enumerable.from(await deploy_helpers.glob('**', {
                        cwd: FF,
                        dot: true,
                        nosort: true,
                        nounique: false,
                        root: FF,                        
                    })).pushTo(filesToHandle);
                }
            }

            filesToHandle = Enumerable.from(filesToHandle).select(f => {
                return Path.resolve(f);
            }).distinct().where(f => {
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
            }).toArray();
            
            if (filesToHandle.length > 0) {
                await Promise.resolve(
                    action(SELECTED_TARGET, filesToHandle)
                );
            }
        };

        const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [];
        const SHOW_QUICK_PICKS = async () => {
            const SELECTED_ITEM = await vscode.window.showQuickPick(
                QUICK_PICKS
            );

            if (SELECTED_ITEM) {
                await Promise.resolve(
                    SELECTED_ITEM.action()
                );
            }
        };

        const ADD_SEPARATOR = () => {
            QUICK_PICKS.push({
                action: () => {
                    SHOW_QUICK_PICKS();
                },
                label: '-',
                description: '',
            });
        };

        QUICK_PICKS.push(
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
                label: '$(rocket)  ' + i18.t(`deploy.currentFileOrFolder.${uriType}.label`),
                description: i18.t(`deploy.currentFileOrFolder.${uriType}.description`),
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
                label: '$(cloud-download)  ' + i18.t(`pull.currentFileOrFolder.${uriType}.label`),
                description: i18.t(`pull.currentFileOrFolder.${uriType}.description`),
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
                label: '$(trashcan)  ' + i18.t(`DELETE.currentFileOrFolder.${uriType}.label`),
                description: i18.t(`DELETE.currentFileOrFolder.${uriType}.description`),
            },
        );

        if (1 === filesAndFolders.length) {
            const LOCAL_ITEM = filesAndFolders[0];

            if ('folder' === uriType) {
                const TARGETS_CAN_LIST = deploy_helpers.from( ACTIVE_TARGETS ).where(t => {
                    return t.__workspace
                            .getListPlugins(t).length > 0;
                }).toArray();
                const TARGETS_CAN_REMOVE_FOLDER = deploy_helpers.from( ACTIVE_TARGETS ).where(t => {
                    return t.__workspace
                            .getRemoveFolderPlugins(t).length > 0;
                }).toArray();

                if (TARGETS_CAN_LIST.length > 0 || TARGETS_CAN_REMOVE_FOLDER.length > 0) {
                    ADD_SEPARATOR();
                }

                if (TARGETS_CAN_LIST.length > 0) {
                    QUICK_PICKS.push(
                        // list directory
                        {
                            action: async () => {
                                const SELECTED_TARGET = await deploy_targets.showTargetQuickPick(
                                    context, TARGETS_CAN_LIST,
                                    {
                                        placeHolder: i18.t('targets.selectTarget'),
                                    }
                                );

                                if (SELECTED_TARGET) {
                                    const WORKSPACE = SELECTED_TARGET.__workspace;

                                    const RELATIVE_PATH = WORKSPACE.toRelativePath(LOCAL_ITEM);
                                    if (false !== RELATIVE_PATH) {
                                        await deploy_helpers.applyFuncFor(
                                            deploy_list.listDirectory, WORKSPACE
                                        )(SELECTED_TARGET,
                                          deploy_helpers.normalizePath(RELATIVE_PATH));
                                    }                            
                                }
                            },
                            label: '$(list-ordered)  ' + i18.t(`listDirectory.currentFileOrFolder.label`),
                            description: i18.t(`listDirectory.currentFileOrFolder.description`),
                        }
                    );
                }

                if (TARGETS_CAN_REMOVE_FOLDER.length > 0) {
                    QUICK_PICKS.push(
                        // remove folder
                        {
                            action: async () => {
                                const SELECTED_TARGET = await deploy_targets.showTargetQuickPick(
                                    context, TARGETS_CAN_REMOVE_FOLDER,
                                    {
                                        placeHolder: i18.t('targets.selectTarget'),
                                    }
                                );

                                if (!SELECTED_TARGET) {
                                    return;
                                }

                                const MAPPING_SCOPE_DIRS = await deploy_targets.getScopeDirectoriesForTargetFolderMappings(
                                    SELECTED_TARGET
                                );
                                const TARGET_NAME = deploy_targets.getTargetName(SELECTED_TARGET);
                                const WORKSPACE = SELECTED_TARGET.__workspace;

                                const NAME_AND_PATH = deploy_targets.getNameAndPathForFileDeployment(SELECTED_TARGET, LOCAL_ITEM,
                                                                                                     MAPPING_SCOPE_DIRS);
                                if (false === NAME_AND_PATH) {
                                    return;
                                }

                                const PLUGINS = WORKSPACE.getRemoveFolderPlugins(SELECTED_TARGET);

                                if (PLUGINS.length < 1) {
                                    return;
                                }

                                const MAPPED_PATH = '/' + deploy_helpers.normalizePath(
                                    deploy_helpers.normalizePath(NAME_AND_PATH.path) + 
                                    '/' + 
                                    deploy_helpers.normalizePath(NAME_AND_PATH.name)
                                );

                                const SELECTED_ITEM = await vscode.window.showWarningMessage<deploy_contracts.MessageItemWithValue>(
                                    WORKSPACE.t('listDirectory.currentFileOrFolder.removeFolder.askBeforeRemove',
                                    MAPPED_PATH
                                ),
                                    {
                                        isCloseAffordance: true,
                                        title: WORKSPACE.t('no'),
                                        value: 0,
                                    },
                                    {                                
                                        title: WORKSPACE.t('yes'),
                                        value: 1,
                                    },
                                    {                                
                                        title: WORKSPACE.t('listDirectory.currentFileOrFolder.removeFolder.yesWithLocalFolder'),
                                        value: 2,
                                    }
                                );
    
                                if (!SELECTED_ITEM || 0 === SELECTED_ITEM.value) {
                                    return;
                                }

                                WORKSPACE.output.appendLine('');

                                const WITH_LOCAL_FOLDER = 2 === SELECTED_ITEM.value;

                                await deploy_helpers.withProgress(async (progress) => {
                                    let watch: deploy_helpers.StopWatch;
                                    const START_WATCH = () => watch = deploy_helpers.startWatch();
                                    const STOP_WATCH = () => {
                                        if (watch) {
                                            WORKSPACE.output.appendLine(` [${watch.stop()} ms]`);
                                        }

                                        watch = null;
                                    };

                                    while (PLUGINS.length > 0) {
                                        const PI = PLUGINS.shift();

                                        const FOLDER_TO_REMOVE = new deploy_plugins.SimpleFolderToRemove(
                                            WORKSPACE,
                                            LOCAL_ITEM,
                                            NAME_AND_PATH,
                                        );

                                        FOLDER_TO_REMOVE.onBeforeRemove = async (destination?) => {
                                            const NOW = deploy_helpers.now();

                                            if (arguments.length < 1) {
                                                destination = NAME_AND_PATH.path;
                                            }
                                            destination = `${deploy_helpers.toStringSafe(destination)} (${TARGET_NAME})`;

                                            const PROGRESS_MSG = `💣 ` +
                                                                 WORKSPACE.t('listDirectory.currentFileOrFolder.removeFolder.removing',
                                                                             MAPPED_PATH);

                                            WORKSPACE.output.append(
                                                `[${NOW.format( WORKSPACE.t('time.timeWithSeconds') )}] ` + 
                                                PROGRESS_MSG + ' '
                                            );

                                            if (progress.cancellationToken.isCancellationRequested) {
                                                WORKSPACE.output.appendLine(`✖️`);
                                            }
                                            else {
                                                START_WATCH();
                                            }
                                        };
                                        FOLDER_TO_REMOVE.onRemoveCompleted = async (err?, deleteLocal?) => {
                                            if (err) {
                                                WORKSPACE.output.append(`🔥: '${ deploy_helpers.toStringSafe(err) }'`);
                                            }
                                            else {
                                                let showOK = true;

                                                if (WITH_LOCAL_FOLDER) {
                                                    if (deploy_helpers.toBooleanSafe(deleteLocal, true)) {
                                                        try {
                                                            await FSExtra.remove( LOCAL_ITEM );
                                                        }
                                                        catch (e) {
                                                            showOK = false;

                                                            WORKSPACE.output.append(`⚠️: '${deploy_helpers.toStringSafe(e)}'`);
                                                        }
                                                    }
                                                }

                                                if (showOK) {
                                                    WORKSPACE.output.append(`✅`);
                                                }
                                            }

                                            STOP_WATCH();
                                        };

                                        const CTX: deploy_plugins.RemoveFoldersContext = {
                                            cancellationToken: null,                                            
                                            isCancelling: null,
                                            folders: [
                                                FOLDER_TO_REMOVE
                                            ],
                                            target: SELECTED_TARGET,
                                        };

                                        await PI.removeFolders(CTX);
                                    }                                    
                                }, {
                                    cancellable: true,
                                    location: vscode.ProgressLocation.Notification,
                                    title: `💣 ` + WORKSPACE.t('listDirectory.currentFileOrFolder.removeFolder.removing',
                                                               MAPPED_PATH),
                                });
                            },
                            label: '$(trashcan)  ' + i18.t(`listDirectory.currentFileOrFolder.removeFolder.label`),
                            description: i18.t(`listDirectory.currentFileOrFolder.removeFolder.description`),
                        }
                    );
                }
            }
        }

        await SHOW_QUICK_PICKS();
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'extension.deploy.reloaded.currentFileOrFolder');
    }
}
