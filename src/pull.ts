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
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_session from './session';
import * as deploy_targets from './targets';
import * as deploy_transformers from './transformers';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as FS from 'fs';
import * as i18 from './i18';
import * as IsStream from 'is-stream';
import * as Path from 'path';
import * as vscode from 'vscode';


let nextCancelBtnCommandId = Number.MIN_SAFE_INTEGER;

/**
 * Pulls all opened files.
 * 
 * @param {deploy_workspaces.Workspace|deploy_workspaces.Workspace[]} workspaces The available workspaces.
 */
export async function pullAllOpenFiles(workspaces: deploy_workspaces.Workspace | deploy_workspaces.Workspace[]) {
    workspaces = deploy_helpers.asArray(workspaces);
    if (workspaces.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('workspaces.noneFound')
        );

        return;
    }

    const DOCUMENTS = deploy_helpers.asArray(vscode.workspace.textDocuments).filter(d => {
        return !d.isClosed &&
               !d.isUntitled;
    });
    if (DOCUMENTS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('editors.noOpen')
        );

        return;
    }

    const CREATE_FILE_LIST_RELOADER = (ws: deploy_workspaces.Workspace): () => string[] => {
        return () => {
            return DOCUMENTS.map(doc => {
                if (!deploy_helpers.isEmptyString(doc.fileName)) {
                    if (ws.isPathOf(doc.fileName)) {
                        return doc;
                    }
                }
    
                return false;
            }).filter(e => {
                return false !== e;
            }).map((doc: vscode.TextDocument) => {
                return Path.resolve(doc.fileName);
            }).filter(f => {
                return FS.existsSync(f) &&
                       FS.lstatSync(f).isFile();
            });
        };
    };

    for (const WS of workspaces) {
        const RELOADER = CREATE_FILE_LIST_RELOADER(WS);

        const FILES = RELOADER();
        if (FILES.length < 1) {
            continue;
        }

        const TARGET = await deploy_targets.showTargetQuickPick(
            WS.context.extension,
            WS.getDownloadTargets(),
            {
                placeHolder: WS.t('workspaces.selectSource',
                                  WS.name),
            },
        );
        if (!TARGET) {
            continue;
        }

        const TARGET_NAME = deploy_targets.getTargetName(TARGET);

        try {
            await deploy_helpers.applyFuncFor(
                pullFilesFrom,
                WS
            )(FILES, TARGET,
              RELOADER);
        }
        catch (e) {
            WS.showErrorMessage(
                WS.t('pull.errors.operationForSourceFailed',
                     TARGET_NAME, e),
            );
        }
    }
}

/**
 * Pulls a file from a target.
 * 
 * @param {string} file The file to pull.
 * @param {deploy_targets.Target} target The target from where to pull from.
 */
export async function pullFileFrom(file: string, target: deploy_targets.Target) {
    const ME: deploy_workspaces.Workspace = this;

    if (ME.isInFinalizeState) {
        return;
    }

    if (!target) {
        return;
    }

    if (!ME.canBeHandledByMe(target)) {
        throw new Error(ME.t('pull.errors.invalidWorkspace',
                             file, ME.name));
    }

    await deploy_helpers.applyFuncFor(
        pullFilesFrom,
        ME
    )([ file ], target,
      null);
}

/**
 * Pulls files from a target.
 * 
 * @param {string[]} files The files to pull.
 * @param {deploy_targets.Target} target The target from where to pull from.
 * @param {deploy_contracts.Reloader<string>} fileListReloader A function that reloads the list of files.
 */
export async function pullFilesFrom(files: string[],
                                    target: deploy_targets.Target,
                                    fileListReloader: deploy_contracts.Reloader<string>) {
    const ME: deploy_workspaces.Workspace = this;

    target = ME.prepareTarget(target);

    if (ME.isInFinalizeState) {
        return;
    }
    
    if (!files) {
        return;
    }

    const NORMALIZE_FILE_LIST = () => {
        files = files.filter(f => !ME.isFileIgnored(f));
    };

    if (!fileListReloader) {
        const INITIAL_LIST = files.map(f => f);

        fileListReloader = () => INITIAL_LIST;
    }

    NORMALIZE_FILE_LIST();

    // preparements
    let reloadFileList = false;
    const PREPARE_CANCELLED = !deploy_helpers.toBooleanSafe(
        await deploy_targets.executePrepareTargetOperations({
            files: files,
            deployOperation: deploy_contracts.DeployOperation.Pull,
            onReloadFileList: () => {
                reloadFileList = true;
            },
            target: target,
        }),
        true
    );
    if (PREPARE_CANCELLED) {
        return;
    }

    if (reloadFileList) {
        files = deploy_helpers.asArray(
            await Promise.resolve(
                fileListReloader()
            )
        );

        NORMALIZE_FILE_LIST();
    }

    if (files.length < 1) {
        return;
    }

    if (!target) {
        return;
    }

    const TARGET_NAME = deploy_targets.getTargetName(target);
    const STATE_KEY = deploy_helpers.toStringSafe(target.__id);

    const PLUGINS = ME.getDownloadPlugins(target);
    if (PLUGINS.length < 1) {
        ME.showWarningMessage(
            ME.t('targets.noPluginsFound')
        );

        return;
    }

    let transformer = await ME.loadDataTransformer(target);
    if (false === transformer) {
        throw new Error(ME.t('targets.errors.couldNotLoadDataTransformer',
                             TARGET_NAME));
    }

    transformer = deploy_transformers.toDataTransformerSafe(
        deploy_transformers.toPasswordTransformer(transformer, target)
    );

    const TRANSFORMER_OPTIONS = deploy_helpers.cloneObject(target.transformerOptions);

    let cancelBtn: vscode.StatusBarItem;
    let cancelBtnCommand: vscode.Disposable;
    const DISPOSE_CANCEL_BTN = () => {
        deploy_helpers.tryDispose(cancelBtn);
        deploy_helpers.tryDispose(cancelBtnCommand);
    };

    const ALL_DIRS = await ME.getAllDirectories();

    const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();
    let targetSession: symbol | false = false;
    try {
        // cancel button
        let isCancelling = false;
        {
            cancelBtn = vscode.window.createStatusBarItem();
            const RESTORE_CANCEL_BTN_TEXT = () => {
                cancelBtn.text = ME.t('pull.buttons.cancel.text',
                                      TARGET_NAME);
                cancelBtn.tooltip = ME.t('pull.buttons.cancel.tooltip');
            };

            const CANCEL_BTN_COMMAND_ID = `extension.deploy.reloaded.buttons.cancelPullFilesFrom${nextCancelBtnCommandId++}`;
            
            cancelBtnCommand = vscode.commands.registerCommand(CANCEL_BTN_COMMAND_ID, async () => {
                try {
                    isCancelling = true;

                    cancelBtn.command = undefined;
                    cancelBtn.text = ME.t('pull.cancelling');

                    const POPUP_BTNS: deploy_contracts.MessageItemWithValue[] = [
                        {
                            isCloseAffordance: true,
                            title: ME.t('no'),
                            value: 0,
                        },
                        {
                            title: ME.t('yes'),
                            value: 1,
                        }
                    ];

                    const PRESSED_BTN = await ME.showWarningMessage.apply(
                        null,
                        [ <any>ME.t('pull.askForCancelOperation', TARGET_NAME) ].concat(
                            POPUP_BTNS
                        )
                    );

                    if (PRESSED_BTN) {
                        if (1 === PRESSED_BTN) {
                            CANCELLATION_SOURCE.cancel();
                        }
                    }
                }
                finally {
                    if (!CANCELLATION_SOURCE.token.isCancellationRequested) {
                        RESTORE_CANCEL_BTN_TEXT();
                    }

                    isCancelling = false;
                }
            });
            
            cancelBtn.command = CANCEL_BTN_COMMAND_ID;

            cancelBtn.show();

            targetSession = await deploy_targets.waitForOtherTargets(
                target, cancelBtn,
            );
            RESTORE_CANCEL_BTN_TEXT();
        }

        const WAIT_WHILE_CANCELLING = async () => {
            await deploy_helpers.waitWhile(() => isCancelling);
        };

        while (PLUGINS.length > 0) {
            await WAIT_WHILE_CANCELLING();            

            if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                break;
            }

            const PI = PLUGINS.shift();

            try {
                await deploy_helpers.waitWhile(() => isCancelling);

                ME.output.appendLine('');

                if (files.length > 1) {
                    ME.output.appendLine(
                        ME.t('pull.startOperation',
                             TARGET_NAME)
                    );
                }

                const FILES_TO_PULL = files.map(f => {
                    const NAME_AND_PATH = ME.getNameAndPathForFileDeployment(target, f,
                                                                             ALL_DIRS);
                    if (false === NAME_AND_PATH) {
                        return null;
                    }

                    const SF = new deploy_plugins.SimpleFileToDownload(ME, f, NAME_AND_PATH);
                    SF.onBeforeDownload = async function(source?) {
                        if (arguments.length < 1) {
                            source = NAME_AND_PATH.path;
                        }
                        source = `${deploy_helpers.toStringSafe(source)} (${TARGET_NAME})`;

                        ME.output.append(
                            ME.t('pull.pullingFile',
                                 f, source) + ' '
                        );

                        await WAIT_WHILE_CANCELLING();

                        if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                            ME.output.appendLine(`[${ME.t('canceled')}]`);
                        }
                    };
                    SF.onDownloadCompleted = async (err?, downloadedFile?) => {
                        let disposeDownloadedFile = false;
                        try {
                            if (err) {
                                throw err;
                            }
                            else {
                                let dataToWrite: any;

                                if (downloadedFile) {
                                    if (Buffer.isBuffer(downloadedFile)) {
                                        dataToWrite = downloadedFile;
                                    }
                                    else if (IsStream(downloadedFile)) {
                                        dataToWrite = downloadedFile;
                                    }
                                    else if (deploy_helpers.isObject<deploy_plugins.DownloadedFile>(downloadedFile)) {
                                        disposeDownloadedFile = true;

                                        dataToWrite = await Promise.resolve(
                                            downloadedFile.read()
                                        );
                                    }
                                    else {
                                        dataToWrite = downloadedFile;
                                    }

                                    // keep sure we have a buffer here
                                    dataToWrite = await deploy_helpers.asBuffer(
                                        dataToWrite
                                    );

                                    const CONTEXT: deploy_transformers.DataTransformerContext = {
                                        context: {
                                            deployOperation: deploy_contracts.DeployOperation.Pull,
                                            file: f,
                                            remoteFile: deploy_helpers.normalizePath(
                                                NAME_AND_PATH.path + '/' + NAME_AND_PATH.name,
                                            ),
                                            target: target,
                                        },
                                        events: ME.workspaceSessionState['pull']['events'],
                                        extension: ME.context.extension,
                                        folder: ME.folder,
                                        globalEvents: deploy_events.EVENTS,
                                        globals: ME.globals,
                                        globalState: ME.workspaceSessionState['pull']['states']['global'],
                                        homeDir: deploy_helpers.getExtensionDirInHome(),
                                        logger: ME.createLogger(),
                                        mode: deploy_transformers.DataTransformerMode.Restore,
                                        options: TRANSFORMER_OPTIONS,
                                        output: ME.output,
                                        replaceWithValues: (val) => {
                                            return ME.replaceWithValues(val);
                                        },
                                        require: (id) => {
                                            return deploy_helpers.requireFromExtension(id);
                                        },
                                        sessionState: deploy_session.SESSION_STATE,
                                        settingFolder: ME.settingFolder,
                                        state: undefined,
                                        workspaceRoot: ME.rootPath,
                                    };

                                    // CONTEXT.state
                                    Object.defineProperty(CONTEXT, 'state', {
                                        enumerable: true,

                                        get: () => {
                                            return ME.workspaceSessionState['pull']['states']['data_transformers'][STATE_KEY];
                                        },

                                        set: (newValue) => {
                                            ME.workspaceSessionState['pull']['states']['data_transformers'][STATE_KEY] = newValue;
                                        }
                                    });

                                    dataToWrite = await (<deploy_transformers.DataTransformer>transformer)(
                                        dataToWrite, CONTEXT
                                    );
                                }

                                if (dataToWrite) {
                                    await deploy_helpers.writeFile(
                                        f, dataToWrite
                                    );
                                }

                                ME.output.appendLine(`[${ME.t('ok')}]`);
                            }
                        }
                        catch (e) {
                            ME.output.appendLine(`[${ME.t('error', e)}]`);
                        }
                        finally {
                            if (disposeDownloadedFile) {
                                deploy_helpers.tryDispose(<vscode.Disposable>downloadedFile);
                            }
                        }
                    };

                    return SF;
                }).filter(f => null !== f);

                const CTX: deploy_plugins.DownloadContext = {
                    cancellationToken: CANCELLATION_SOURCE.token,
                    files: FILES_TO_PULL,
                    isCancelling: undefined,
                    target: target,
                };

                // CTX.isCancelling
                Object.defineProperty(CTX, 'isCancelling', {
                    enumerable: true,

                    get: () => {
                        return CTX.cancellationToken.isCancellationRequested;
                    }
                });

                const SHOW_CANCELED_BY_OPERATIONS_MESSAGE = () => {
                    ME.output.appendLine(
                        ME.t('pull.canceledByOperation',
                             TARGET_NAME)
                    );
                };

                let operationIndex: number;

                const GET_OPERATION_NAME = (operation: deploy_targets.TargetOperation) => {
                    let operationName = deploy_helpers.toStringSafe(operation.name).trim();
                    if ('' === operationName) {
                        operationName = deploy_helpers.normalizeString(operation.type);
                        if ('' === operationName) {
                            operationName = deploy_targets.DEFAULT_OPERATION_TYPE;
                        }

                        operationName += ' #' + (operationIndex + 1);
                    }

                    return operationName;
                };

                // beforePull
                operationIndex = -1;
                ME.output.appendLine('');
                const BEFORE_PULL_ABORTED = !deploy_helpers.toBooleanSafe(
                    await deploy_targets.executeTargetOperations({
                        files: FILES_TO_PULL.map(ftu => {
                            return ftu.path + '/' + ftu.name;
                        }),
                        onBeforeExecute: async (operation) => {
                            ++operationIndex;

                            ME.output.append(
                                ME.t('targets.operations.runningBeforePull',
                                     GET_OPERATION_NAME(operation))
                            );
                        },
                        onExecutionCompleted: async (operation, err, doesContinue) => {
                            if (err) {
                                ME.output.appendLine(`[${ME.t('error', err)}]`);
                            }
                            else {
                                ME.output.appendLine(`[${ME.t('ok')}]`);
                            }
                        },
                        operation: deploy_targets.TargetOperationEvent.BeforePull,
                        target: target,
                    })
                , true);
                if (BEFORE_PULL_ABORTED) {
                    SHOW_CANCELED_BY_OPERATIONS_MESSAGE();
                    continue;
                }

                await Promise.resolve(
                    PI.downloadFiles(CTX)
                );

                // pulled
                operationIndex = -1;
                const AFTER_PULLED_ABORTED = !deploy_helpers.toBooleanSafe(
                    await deploy_targets.executeTargetOperations({
                        files: FILES_TO_PULL.map(ftu => {
                            return ftu.path + '/' + ftu.name;
                        }),
                        onBeforeExecute: async (operation) => {
                            ++operationIndex;

                            ME.output.append(
                                ME.t('targets.operations.runningAfterPulled',
                                     GET_OPERATION_NAME(operation))
                            );
                        },
                        onExecutionCompleted: async (operation, err, doesContinue) => {
                            if (err) {
                                ME.output.appendLine(`[${ME.t('error', err)}]`);
                            }
                            else {
                                ME.output.appendLine(`[${ME.t('ok')}]`);
                            }
                        },
                        operation: deploy_targets.TargetOperationEvent.AfterPulled,
                        target: target,
                    })
                , true);
                if (AFTER_PULLED_ABORTED) {
                    SHOW_CANCELED_BY_OPERATIONS_MESSAGE();
                    continue;
                }

                if (files.length > 1) {
                    ME.output.appendLine(
                        ME.t('pull.finishedOperation',
                             TARGET_NAME)
                    );
                }
            }
            catch (e) {
                ME.output.appendLine(
                    ME.t('pull.finishedOperationWithErrors',
                         TARGET_NAME, e)
                );
            }
        }
    }
    finally {
        DISPOSE_CANCEL_BTN();
        
        deploy_helpers.tryDispose(CANCELLATION_SOURCE);

        deploy_targets.unmarkTargetAsInProgress(
            target, targetSession
        );
    }
}

/**
 * Pulls a package.
 * 
 * @param {deploy_packages.Package} pkg The package to pull. 
 */
export async function pullPackage(pkg: deploy_packages.Package) {
    const ME: deploy_workspaces.Workspace = this;

    if (ME.isInFinalizeState) {
        return;
    }

    if (!pkg) {
        return;
    }

    if (!ME.canBeHandledByMe(pkg)) {
        throw new Error(ME.t('pull.errors.invalidWorkspaceForPackage',
                             deploy_packages.getPackageName(pkg), ME.name));
    }

    const RELOADER = async () => await ME.findFilesByFilter(pkg);

    const FILES_TO_PULL = await RELOADER();
    if (FILES_TO_PULL.length < 1) {
        ME.showWarningMessage(
            ME.t('noFiles')
        );

        return;
    }

    const TARGETS = deploy_helpers.applyFuncFor(deploy_packages.getTargetsOfPackage, ME)(pkg);
    if (false === TARGETS) {
        return;
    }

    const SELECTED_TARGET = await deploy_targets.showTargetQuickPick(
        ME.context.extension,
        TARGETS.filter(t => deploy_targets.isVisibleForPackage(t, pkg)),
        {
            placeHolder: ME.t('pull.selectSource'),
        }
    );
    if (!SELECTED_TARGET) {
        return;
    }

    await deploy_helpers.applyFuncFor(
        pullFilesFrom, ME
    )(FILES_TO_PULL,
      SELECTED_TARGET,
      RELOADER);
}
