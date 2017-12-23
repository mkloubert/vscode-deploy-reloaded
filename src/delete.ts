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
        //TODO: translate
        const PRESSED_BTN: deploy_contracts.MessageItemWithValue = await vscode.window.showWarningMessage.apply(
            null,
            [ <any>'Also delete local file?', {} ].concat(BUTTONS),
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
                                    target: deploy_targets.Target, targetNr?: number,
                                    deleteLocalFiles?: boolean) {
    const ME: deploy_workspaces.Workspace = this;

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

    if (isNaN(targetNr)) {
        targetNr = target.__index + 1;
    }

    const TARGET_NAME = deploy_targets.getTargetName(target);

    const PLUGINS = ME.getDeletePlugins(target);
    if (PLUGINS.length < 1) {
        //TODO: translate
        await ME.showWarningMessage(
            `No matching PLUGINS found!`
        );

        return;
    }

    let cancelBtn: vscode.StatusBarItem;
    let cancelBtnCommand: vscode.Disposable;
    const DISPOSE_CANCEL_BTN = () => {
        deploy_helpers.tryDispose(cancelBtn);
        deploy_helpers.tryDispose(cancelBtnCommand);
    };

    const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();
    try {
        // cancel button
        let isCancelling = false;
        {
            cancelBtn = vscode.window.createStatusBarItem();

            const CANCEL_BTN_COMMAND_ID = `extension.deploy.reloaded.buttons.cancelDeleteFilesIn${nextCancelBtnCommandId++}`;

            cancelBtnCommand = vscode.commands.registerCommand(CANCEL_BTN_COMMAND_ID, async () => {
                try {
                    isCancelling = true;

                    cancelBtn.command = undefined;
                    cancelBtn.text = `Cancelling delete operation...`;  //TODO: translate

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

                    //TODO: translate
                    const PRESSED_BTN = await ME.showWarningMessage.apply(
                        null,
                        [ <any>`You are about to cancel the delete operation in '${TARGET_NAME}'. Are you sure?` ].concat(
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
                    isCancelling = false;
                }
            });
            
            cancelBtn.command = CANCEL_BTN_COMMAND_ID;
            //TODO: translate
            cancelBtn.text = `Deleting files in '${TARGET_NAME}'...`;
            cancelBtn.tooltip = 'Click here to cancel...';

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

                const CTX: deploy_plugins.DeleteContext = {
                    cancellationToken: CANCELLATION_SOURCE.token,
                    files: files.map(f => {
                        const NAME_AND_PATH = ME.getNameAndPathForFileDeployment(f, target);
                        if (false === NAME_AND_PATH) {
                            return null;
                        }

                        const SF = new deploy_plugins.SimpleFileToDelete(ME, f, NAME_AND_PATH);
                        SF.onBeforeDelete = async function (destination?: string) {
                            if (arguments.length < 1) {
                                destination = `'${deploy_helpers.toDisplayablePath(NAME_AND_PATH.path)}' (${TARGET_NAME})`;
                            }
                            else {
                                destination = `'${deploy_helpers.toStringSafe(destination)}'`;
                            }
    
                            // TODO: translate
                            ME.context.outputChannel.append(`Deleting file '${f}' in ${destination}... `);

                            await WAIT_WHILE_CANCELLING();

                            if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                                ME.context.outputChannel.appendLine(`[Canceled]`);  //TODO: translate
                            }
                        };
                        SF.onDeleteCompleted = async (err?: any, deleteLocal?: boolean) => {
                            // TODO: translate
                            if (err) {
                                ME.context.outputChannel.appendLine(`[ERROR: ${err}]`);
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

                                    ME.context.outputChannel.appendLine(`[OK]`);  //TODO: translate
                                }
                                catch (e) {
                                    ME.context.outputChannel.appendLine(`[WARNING: ${e}]`);  //TODO: translate
                                }
                            }
                        };

                        return SF;
                    }).filter(f => null !== f),
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

                await Promise.resolve(
                    PI.deleteFiles(CTX)
                );

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
    const ROOT_DIR = ME.folder.uri.fsPath;

    const FILES_TO_DELETE = await ME.findFilesByFilter(pkg);
    if (FILES_TO_DELETE.length < 1) {
        //TODO: translate
        await ME.showWarningMessage(
            `No FILES found!`
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
        //TODO: translate
        const PRESSED_BTN: deploy_contracts.MessageItemWithValue = await vscode.window.showWarningMessage.apply(
            null,
            [ <any>'Also delete local files?', {} ].concat(BUTTONS),
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

    const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = TARGETS.map((t, i) => {
        return {
            action: async () => {
                await deleteFilesIn.apply(ME,
                                          [ FILES_TO_DELETE, t, i + 1, deleteLocalFiles ]);
            },
            description: deploy_helpers.toStringSafe( t.description ).trim(),
            detail: t.__workspace.folder.uri.fsPath,
            label: deploy_targets.getTargetName(t),
            state: t,
        };
    }).filter(qp => deploy_targets.isVisibleForPackage(qp.state, pkg));

    if (QUICK_PICK_ITEMS.length < 1) {
        //TODO: translate
        await ME.showWarningMessage(
            `No TARGETS found!`
        );

        return;
    }

    let selectedItem: deploy_contracts.ActionQuickPick;
    if (1 === QUICK_PICK_ITEMS.length) {
        selectedItem = QUICK_PICK_ITEMS[0];
    }
    else {
        selectedItem = await vscode.window.showQuickPick(QUICK_PICK_ITEMS, {
            placeHolder: 'Select the TARGET to delete files in...',  //TODO: translate
        });
    }

    if (selectedItem) {
        await Promise.resolve(
            selectedItem.action()
        );
    }
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
        const KNOWN_TARGETS = ME.getTargets();

        const TARGETS = await deploy_packages.findTargetsForFileOfPackage(file,
                                                                          (pkg) => pkg.removeOnChange);

        if (false === TARGETS) {
            return;
        }

        for (const T of Enumerable.from(TARGETS).distinct(true)) {
            const TARGET_NAME = deploy_targets.getTargetName(T);

            try {
                await ME.deleteFileIn(file, T);
            }
            catch (e) {
                ME.showErrorMessage(
                    `Auto removing file '${file}' in '${TARGET_NAME}' failed: ${e}`
                );
            }
        }
    }
    catch (e) {
        deploy_log.CONSOLE
                    .trace(e, 'delete.removeOnChange()');
    }
}
