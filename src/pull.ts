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
import * as deploy_transformers from './transformers';
import * as deploy_workspaces from './workspaces';
import * as IsStream from 'is-stream';
import * as vscode from 'vscode';


let nextCancelBtnCommandId = Number.MIN_SAFE_INTEGER;

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

    await pullFilesFrom.apply(
        ME,
        [ [ file ], target, target.__index + 1 ]
    );
}

/**
 * Pulls files from a target.
 * 
 * @param {string[]} files The files to pull.
 * @param {deploy_targets.Target} target The target from where to pull from.
 * @param {number} [targetNr] The number of the target.
 */
export async function pullFilesFrom(files: string[],
                                    target: deploy_targets.Target, targetNr?: number) {
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

    if (isNaN(targetNr)) {
        targetNr = target.__index + 1;
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

    const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();
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
                await deploy_helpers.waitWhile(() => isCancelling);

                ME.context.outputChannel.appendLine('');

                if (files.length > 1) {
                    ME.context.outputChannel.appendLine(
                        ME.t('pull.startOperation',
                             TARGET_NAME)
                    );
                }

                const CTX: deploy_plugins.DownloadContext = {
                    cancellationToken: CANCELLATION_SOURCE.token,
                    files: files.map(f => {
                        const NAME_AND_PATH = ME.getNameAndPathForFileDeployment(f, target);
                        if (false === NAME_AND_PATH) {
                            return null;
                        }

                        const SF = new deploy_plugins.SimpleFileToDownload(ME, f, NAME_AND_PATH);
                        SF.onBeforeDownload = async function(source?) {
                            if (arguments.length < 1) {
                                source = `'${deploy_helpers.toDisplayablePath(NAME_AND_PATH.path)}' (${TARGET_NAME})`;
                            }
                            else {
                                source = `'${deploy_helpers.toStringSafe(source)}'`;
                            }
    
                            ME.context.outputChannel.append(
                                ME.t('pull.pullingFile',
                                     f, source) + ' '
                            );

                            await WAIT_WHILE_CANCELLING();

                            if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                                ME.context.outputChannel.appendLine(`[${ME.t('canceled')}]`);
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
                                            globals: ME.globals,
                                            globalState: ME.sessionState['pull']['states']['global'],
                                            logger: deploy_log.CONSOLE,
                                            mode: deploy_transformers.DataTransformerMode.Restore,
                                            options: TRANSFORMER_OPTIONS,
                                            require: (id) => {
                                                return deploy_helpers.requireFromExtension(id);
                                            },
                                            state: undefined,
                                        };

                                        // CONTEXT.state
                                        Object.defineProperty(CONTEXT, 'state', {
                                            enumerable: true,

                                            get: () => {
                                                return ME.sessionState['pull']['states']['data_transformers'][STATE_KEY];
                                            },

                                            set: (newValue) => {
                                                ME.sessionState['pull']['states']['data_transformers'][STATE_KEY] = newValue;
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

                                    ME.context.outputChannel.appendLine(`[${ME.t('ok')}]`);
                                }
                            }
                            catch (e) {
                                ME.context.outputChannel.appendLine(`[${ME.t('error', e)}]`);
                            }
                            finally {
                                if (disposeDownloadedFile) {
                                    deploy_helpers.tryDispose(<vscode.Disposable>downloadedFile);
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
                    PI.downloadFiles(CTX)
                );

                if (files.length > 1) {
                    ME.context.outputChannel.appendLine(
                        ME.t('pull.finishedOperation',
                             TARGET_NAME)
                    );
                }
            }
            catch (e) {
                ME.context.outputChannel.appendLine(
                    ME.t('pull.finishedOperationWithErrors',
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

    const FILES_TO_PULL = await ME.findFilesByFilter(pkg);
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

    const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = TARGETS.map((t, i) => {
        return {
            action: async () => {
                await pullFilesFrom.apply(ME,
                                          [ FILES_TO_PULL, t, i + 1 ]);
            },
            description: deploy_helpers.toStringSafe( t.description ).trim(),
            detail: t.__workspace.folder.uri.fsPath,
            label: deploy_targets.getTargetName(t),
            state: t,
        };
    }).filter(qp => deploy_targets.isVisibleForPackage(qp.state, pkg));

    if (QUICK_PICK_ITEMS.length < 1) {
        await ME.showWarningMessage(
            ME.t('targets.noneFound')
        );

        return;
    }

    let selectedItem: deploy_contracts.ActionQuickPick;
    if (1 === QUICK_PICK_ITEMS.length) {
        selectedItem = QUICK_PICK_ITEMS[0];
    }
    else {
        selectedItem = await vscode.window.showQuickPick(QUICK_PICK_ITEMS, {
            placeHolder: ME.t('pull.selectSource')
        });
    }

    if (selectedItem) {
        await Promise.resolve(
            selectedItem.action()
        );
    }
}
