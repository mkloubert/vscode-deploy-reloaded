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
import * as deploy_gui from './gui';
import * as deploy_log from './log';
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_targets from './targets';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as Path from 'path';
import * as vscode from 'vscode';


let nextCancelBtnCommandId = Number.MIN_SAFE_INTEGER;

/**
 * Deletes a file in a target.
 * 
 * @param {string} file The file to delete.
 * @param {deploy_targets.Target} target The target to delete in.
 * @param {number} [targetNr] The number of the target.
 * @param {boolean} [askForDeleteLocalFile] Also ask for deleting the local file or not.
 */
export async function deleteFileIn(file: string, target: deploy_targets.Target,
                                   askForDeleteLocalFile = true) {
    const ME: deploy_workspaces.Workspace = this;

    target = ME.prepareTarget(target);

    if (ME.isInFinalizeState) {
        return;
    }

    if (!target) {
        return;
    }

    if (!ME.canBeHandledByMe(target)) {
        throw new Error(ME.t('DELETE.errors.invalidWorkspace',
                             file, target.__workspace.name));
    }

    const BUTTONS: deploy_contracts.MessageItemWithValue[] = [
        {
            title: ME.t('no'),
            value: 1,
        },
        {
            title: ME.t('yes'),
            value: 2,
        },
        {
            isCloseAffordance: true,
            title: ME.t('cancel'),
            value: 0,
        }
    ];

    let deleteLocalFile = false;

    if (deploy_helpers.toBooleanSafe(askForDeleteLocalFile, true)) {
        const PRESSED_BTN: deploy_contracts.MessageItemWithValue = await vscode.window.showWarningMessage.apply(
            null,
            [ <any>ME.t('DELETE.askIfDeleteLocalFile'), {} ].concat(BUTTONS),
        );

        if (!PRESSED_BTN || 0 == PRESSED_BTN.value) {
            return;
        }

        deleteLocalFile = 2 === PRESSED_BTN.value;
    }

    await deleteFilesIn.apply(
        ME,
        [ [ file ], target, target.__index + 1, deleteLocalFile ]
    );
}

/**
 * Deletes files in a target.
 * 
 * @param {string[]} files The files to delete.
 * @param {deploy_targets.Target} target The target to delete in.
 * @param {boolean} [deleteLocalFiles] Also delete local files or not.
 */
export async function deleteFilesIn(files: string[],
                                    target: deploy_targets.Target,
                                    deleteLocalFiles?: boolean) {
    const ME: deploy_workspaces.Workspace = this;

    target = ME.prepareTarget(target);

    if (ME.isInFinalizeState) {
        return;
    }
    
    if (!files) {
        return;
    }

    files = files.filter(f => !ME.isFileIgnored(f));
    if (files.length < 1) {
        return;
    }

    if (!target) {
        return;
    }

    deleteLocalFiles = deploy_helpers.toBooleanSafe(deleteLocalFiles);

    const TARGET_NAME = deploy_targets.getTargetName(target);

    const PLUGINS = ME.getDeletePlugins(target);
    if (PLUGINS.length < 1) {
        ME.showWarningMessage(
            ME.t('targets.noPluginsFound')
        );

        return;
    }

    let cancelBtn: vscode.StatusBarItem;
    let cancelBtnCommand: vscode.Disposable;
    const DISPOSE_CANCEL_BTN = () => {
        deploy_helpers.tryDispose(cancelBtn);
        deploy_helpers.tryDispose(cancelBtnCommand);
    };

    const ALL_DIRS = await ME.getAllDirectories();

    const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();
    try {
        // cancel button
        let isCancelling = false;
        {
            cancelBtn = vscode.window.createStatusBarItem();
            const RESTORE_CANCEL_BTN_TEXT = () => {
                cancelBtn.text = ME.t('DELETE.buttons.cancel.text',
                                      TARGET_NAME);
                cancelBtn.tooltip = ME.t('DELETE.buttons.cancel.tooltip');
            };

            const CANCEL_BTN_COMMAND_ID = `extension.deploy.reloaded.buttons.cancelDeleteFilesIn${nextCancelBtnCommandId++}`;

            cancelBtnCommand = vscode.commands.registerCommand(CANCEL_BTN_COMMAND_ID, async () => {
                try {
                    isCancelling = true;

                    cancelBtn.command = undefined;
                    cancelBtn.text = ME.t('DELETE.cancelling');

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
                        [ <any>ME.t('DELETE.askForCancelOperation', TARGET_NAME) ].concat(
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
            RESTORE_CANCEL_BTN_TEXT();

            cancelBtn.show();
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
                ME.context.outputChannel.appendLine('');

                if (files.length > 1) {
                    ME.context.outputChannel.appendLine(
                        ME.t('DELETE.startOperation',
                             TARGET_NAME)
                    );
                }

                const FILES_TO_DELETE = files.map(f => {
                    const NAME_AND_PATH = ME.getNameAndPathForFileDeployment(target, f,
                                                                             ALL_DIRS);
                    if (false === NAME_AND_PATH) {
                        return null;
                    }

                    const SF = new deploy_plugins.SimpleFileToDelete(ME, f, NAME_AND_PATH);
                    SF.onBeforeDelete = async function (destination?: string) {
                        if (arguments.length < 1) {
                            destination = NAME_AND_PATH.path;
                        }
                        destination = `${deploy_helpers.toStringSafe(destination)} (${TARGET_NAME})`;

                        ME.context.outputChannel.append(
                            ME.t('DELETE.deletingFile',
                                 f, destination) + ' '
                        );

                        await WAIT_WHILE_CANCELLING();

                        if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                            ME.context.outputChannel.appendLine(`[${ME.t('canceled')}]`);
                        }
                    };
                    SF.onDeleteCompleted = async (err?: any, deleteLocal?: boolean) => {
                        if (err) {
                            ME.context.outputChannel.appendLine(`[${ME.t('error', err)}]`);
                        }
                        else {
                            try {
                                let doDeleteLocalFiles = deploy_helpers.toBooleanSafe(deleteLocalFiles);
                                if (doDeleteLocalFiles) {
                                    doDeleteLocalFiles = deploy_helpers.toBooleanSafe(deleteLocal, true);
                                }

                                if (doDeleteLocalFiles) {
                                    if (await deploy_helpers.exists(SF.file)) {
                                        await deploy_helpers.unlink(SF.file);
                                    }
                                }

                                ME.context.outputChannel.appendLine(`[${ME.t('ok')}]`);
                            }
                            catch (e) {
                                ME.context.outputChannel.appendLine(`[${ME.t('warning')}: ${deploy_helpers.toStringSafe(e)}]`);
                            }
                        }
                    };

                    return SF;
                }).filter(f => null !== f);

                const CTX: deploy_plugins.DeleteContext = {
                    cancellationToken: CANCELLATION_SOURCE.token,
                    files: FILES_TO_DELETE,
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
                    ME.context.outputChannel.appendLine(
                        ME.t('DELETE.canceledByOperation',
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

                // beforeDelete
                operationIndex = -1;
                ME.context.outputChannel.appendLine('');
                const BEFORE_DELETE_ABORTED = !deploy_helpers.toBooleanSafe(
                    await deploy_targets.executeTargetOperations({
                        files: FILES_TO_DELETE.map(ftu => {
                            return ftu.path + '/' + ftu.name;
                        }),
                        onBeforeExecute: async (operation) => {
                            ++operationIndex;

                            ME.context.outputChannel.append(
                                ME.t('targets.operations.runningBeforeDelete',
                                     GET_OPERATION_NAME(operation))
                            );
                        },
                        onExecutionCompleted: async (operation, err, doesContinue) => {
                            if (err) {
                                ME.context.outputChannel.appendLine(`[${ME.t('error', err)}]`);
                            }
                            else {
                                ME.context.outputChannel.appendLine(`[${ME.t('ok')}]`);
                            }
                        },
                        operation: deploy_targets.TargetOperationEvent.BeforeDelete,
                        target: target,
                    })
                , true);
                if (BEFORE_DELETE_ABORTED) {
                    SHOW_CANCELED_BY_OPERATIONS_MESSAGE();
                    continue;
                }

                await Promise.resolve(
                    PI.deleteFiles(CTX)
                );

                // deleted
                operationIndex = -1;
                const AFTER_DELETED_ABORTED = !deploy_helpers.toBooleanSafe(
                    await deploy_targets.executeTargetOperations({
                        files: FILES_TO_DELETE.map(ftu => {
                            return ftu.path + '/' + ftu.name;
                        }),
                        onBeforeExecute: async (operation) => {
                            ++operationIndex;

                            ME.context.outputChannel.append(
                                ME.t('targets.operations.runningAfterDeleted',
                                     GET_OPERATION_NAME(operation))
                            );
                        },
                        onExecutionCompleted: async (operation, err, doesContinue) => {
                            if (err) {
                                ME.context.outputChannel.appendLine(`[${ME.t('error', err)}]`);
                            }
                            else {
                                ME.context.outputChannel.appendLine(`[${ME.t('ok')}]`);
                            }
                        },
                        operation: deploy_targets.TargetOperationEvent.AfterDeleted,
                        target: target,
                    })
                , true);
                if (AFTER_DELETED_ABORTED) {
                    SHOW_CANCELED_BY_OPERATIONS_MESSAGE();
                    continue;
                }

                if (files.length > 1) {
                    ME.context.outputChannel.appendLine(
                        ME.t('DELETE.finishedOperation',
                             TARGET_NAME)
                    );
                }
            }
            catch (e) {
                ME.context.outputChannel.appendLine(
                    ME.t('DELETE.finishedOperationWithErrors',
                         TARGET_NAME, e)
                );
            }
        }
    }
    finally {
        DISPOSE_CANCEL_BTN();

        deploy_helpers.tryDispose(CANCELLATION_SOURCE);
    }
}

/**
 * Deletes a package.
 * 
 * @param {deploy_packages.Package} pkg The package to delete.
 * @param {boolean} [askForDeleteLocalFiles] Also ask for deleting the local files or not.
 */
export async function deletePackage(pkg: deploy_packages.Package,
                                    askForDeleteLocalFiles = true) {
    const ME: deploy_workspaces.Workspace = this;

    if (ME.isInFinalizeState) {
        return;
    }

    if (!pkg) {
        return;
    }

    if (!ME.canBeHandledByMe(pkg)) {
        throw new Error(ME.t('DELETE.errors.invalidWorkspaceForPackage',
                             deploy_packages.getPackageName(pkg), ME.name));
    }

    const FILES = deploy_helpers.asArray(pkg.files).filter(f => {
        return !deploy_helpers.isEmptyString(f);
    });

    let exclude = deploy_helpers.asArray(pkg.exclude).filter(f => {
        return !deploy_helpers.isEmptyString(f);
    });
    if (exclude.length < 1) {
        exclude = undefined;
    }

    const FILES_TO_DELETE = await ME.findFilesByFilter(pkg);
    if (FILES_TO_DELETE.length < 1) {
        ME.showWarningMessage(
            ME.t('noFiles')
        );

        return;
    }

    const BUTTONS: deploy_contracts.MessageItemWithValue[] = [
        {
            title: ME.t('no'),
            value: 1,
        },
        {
            title: ME.t('yes'),
            value: 2,
        },
        {
            isCloseAffordance: true,
            title: ME.t('cancel'),
            value: 0,
        }
    ];

    let deleteLocalFiles = false;

    if (deploy_helpers.toBooleanSafe(askForDeleteLocalFiles, true)) {
        const PRESSED_BTN: deploy_contracts.MessageItemWithValue = await vscode.window.showWarningMessage.apply(
            null,
            [ <any>ME.t('DELETE.askIfDeleteLocalFiles'), {} ].concat(BUTTONS),
        );

        if (!PRESSED_BTN || 0 == PRESSED_BTN.value) {
            return;
        }

        deleteLocalFiles = 2 === PRESSED_BTN.value;
    }

    const TARGETS = deploy_helpers.applyFuncFor(deploy_packages.getTargetsOfPackage, ME)(pkg);
    if (false === TARGETS) {
        return;
    }

    const SELECTED_TARGET = await deploy_targets.showTargetQuickPick(
        ME.context.extension,
        TARGETS.filter(t => deploy_targets.isVisibleForPackage(t, pkg)),
        {
            placeHolder: ME.t('DELETE.selectTarget'),
        }
    );
    if (!SELECTED_TARGET) {
        return;
    }

    await deploy_helpers.applyFuncFor(
        deleteFilesIn, ME
    )(FILES_TO_DELETE,
      SELECTED_TARGET,
      deleteLocalFiles);
}

/**
 * Handles a file for "remove on change" feature.
 * 
 * @param {string} file The file to check.
 */
export async function removeOnChange(file: string) {
    const ME: deploy_workspaces.Workspace = this;

    if (ME.isInFinalizeState) {
        return;
    }

    try {
        const TARGETS = await deploy_helpers.applyFuncFor(
            deploy_packages.findTargetsForFileOfPackage, ME
        )(file,
         (pkg) => pkg.removeOnChange,
         (filter, file) => {
             const FILE_LIST: string[] = [];
             const REL_PATH = ME.toRelativePath(file);
             if (false !== REL_PATH) {
                 const DOES_MATCH = deploy_helpers.checkIfDoesMatchByFileFilter('/' + REL_PATH,
                                                                                deploy_helpers.toMinimatchFileFilter(filter));
                 if (DOES_MATCH) {
                     FILE_LIST.push(file);
                 }
             }

             return FILE_LIST;
         });

        if (false === TARGETS) {
            return;
        }

        for (const T of Enumerable.from(TARGETS).distinct(true)) {
            const TARGET_NAME = deploy_targets.getTargetName(T);

            try {
                await ME.deleteFileIn(file, T, false);
            }
            catch (e) {
                ME.showErrorMessage(
                    ME.t('DELETE.onChange.failed',
                         file, TARGET_NAME, e)
                );
            }
        }
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'delete.removeOnChange()');
    }
}
