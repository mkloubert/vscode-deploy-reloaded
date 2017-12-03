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
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_targets from './targets';
import * as deploy_workspaces from './workspaces';
import * as Path from 'path';
import * as vscode from 'vscode';


let nextCancelBtnCommandId = Number.MIN_SAFE_INTEGER;

/**
 * Deploys files to a target.
 * 
 * @param {string[]} files The files to deploy.
 * @param {deploy_targets.Target} target The target to deploy to.
 * @param {number} [targetNr] The number of the target.
 */
export async function deployFilesTo(files: string[],
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
    const TARGET_TYPE = deploy_targets.normalizeTargetType(target);

    const PLUGINS = ME.context.plugins.filter(pi => {
        return '' === pi.__type || 
               (TARGET_TYPE === pi.__type && pi.canUpload && pi.uploadFiles);
    });

    if (PLUGINS.length < 1) {
        //TODO: translate
        await deploy_helpers.showWarningMessage(
            `No matching PLUGINS found!`
        );

        return;
    }

    const TRANSFORMER = await ME.loadDataTransformer(target);
    if (false === TRANSFORMER) {
        // TODO: translate
        throw new Error(`Could not load data transformer for target '${TARGET_NAME}'!`);
    }

    const SYNC_WHEN_STATES = ME.syncWhenOpenStates;

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

            const CANCEL_BTN_COMMAND_ID = `extension.deploy.reloaded.buttons.cancelDeployFilesTo${nextCancelBtnCommandId++}`;
            
            cancelBtnCommand = vscode.commands.registerCommand(CANCEL_BTN_COMMAND_ID, async () => {
                try {
                    isCancelling = true;

                    cancelBtn.command = undefined;
                    cancelBtn.text = `Cancelling deploy operation...`;  //TODO: translate

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
                        [ <any>`You are about to cancel the deploy operation to '${TARGET_NAME}'. Are you sure?` ].concat(
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
            cancelBtn.text = `Deploying files to '${TARGET_NAME}'...`;
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

                // TODO: translate
                if (files.length > 1) {
                    ME.context.outputChannel.appendLine(`Start deploying files to '${TARGET_NAME}'...`);
                }

                const FILES_TO_UPLOAD: deploy_plugins.LocalFileToUpload[] = [];
                for (const F of files) {
                    const NAME_AND_PATH = ME.toNameAndPath(F);
                    if (false === NAME_AND_PATH) {
                        // TODO: translate
                        ME.context.outputChannel.append(`Cannot detect path information for file '${F}'!`);
                        continue;
                    }

                    const LF = new deploy_plugins.LocalFileToUpload(ME, F, NAME_AND_PATH);
                    LF.onBeforeUpload = async (destination?: string) => {
                        // TODO: translate
                        ME.context.outputChannel.append(`Deploying file '${F}' to '${TARGET_NAME}'... `);

                        await WAIT_WHILE_CANCELLING();

                        if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                            ME.context.outputChannel.appendLine(`[Canceled]`);  //TODO: translate
                        }
                    };
                    LF.onUploadCompleted = async (err?: any) => {
                        // TODO: translate
                        if (err) {
                            ME.context.outputChannel.appendLine(`[ERROR: ${err}]`);
                        }
                        else {
                            const SYNC_WHEN_OPEN_ID = ME.getSyncWhenOpenKey(target);
                            if (false !== SYNC_WHEN_OPEN_ID) {
                                // reset 'sync when open' state
                                delete SYNC_WHEN_STATES[SYNC_WHEN_OPEN_ID];
                            }

                            ME.context.outputChannel.appendLine(`[OK]`);
                        }
                    };

                    LF.transformer = TRANSFORMER;
                    LF.transformerOptions = deploy_helpers.cloneObject(target.transformerOptions);

                    FILES_TO_UPLOAD.push(LF);
                }

                const CTX: deploy_plugins.UploadContext = {
                    cancellationToken: CANCELLATION_SOURCE.token,
                    files: FILES_TO_UPLOAD,
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
                    // TODO: translate
                    ME.context.outputChannel.appendLine(`Deploying files to '${TARGET_NAME}' has been cancelled by target operation.`);
                };

                // beforeDeploy
                if (!(await deploy_targets.executeTargetOperations(target, deploy_targets.TargetOperationEvent.BeforeDeploy))) {
                    SHOW_CANCELED_BY_OPERATIONS_MESSAGE();
                    continue;
                }

                await Promise.resolve(
                    PI.uploadFiles(CTX)
                );

                // deployed
                if (!(await deploy_targets.executeTargetOperations(target, deploy_targets.TargetOperationEvent.AfterDeployed))) {
                    SHOW_CANCELED_BY_OPERATIONS_MESSAGE();
                    continue;
                }

                if (files.length > 1) {
                    // TODO: translate
                    ME.context.outputChannel.appendLine(`Deploying files to '${TARGET_NAME}' has been finished.`);
                }
            }
            catch (e) {
                // TODO: translate
                ME.context.outputChannel.appendLine(`[ERROR] Deploying to '${TARGET_NAME}' failed: ${e}`);
            }
        }
    }
    finally {
        DISPOSE_CANCEL_BTN();

        deploy_helpers.tryDispose(CANCELLATION_SOURCE);
    }
}

/**
 * Deploys a file to a target.
 * 
 * @param {string} file The file to deploy.
 * @param {deploy_targets.Target} target The target to deploy to.
 */
export async function deployFileTo(file: string, target: deploy_targets.Target) {
    const ME: deploy_workspaces.Workspace = this;

    if (ME.isInFinalizeState) {
        return;
    }

    if (!target) {
        return;
    }

    if (!ME.canBeHandledByMe(target)) {
        //TODO: translate
        throw new Error(`File '${file}' cannot be deployed from workspace '${ME.folder.uri.fsPath}'!`);
    }

    file = Path.resolve(file);

    await deployFilesTo.apply(
        ME,
        [ [ file ], target, target.__index + 1 ]
    );
}

/**
 * Deploys a package.
 * 
 * @param {deploy_packages.Package} pkg The package to deploy. 
 */
export async function deployPackage(pkg: deploy_packages.Package) {
    const ME: deploy_workspaces.Workspace = this;

    if (ME.isInFinalizeState) {
        return;
    }

    if (!pkg) {
        return;
    }

    if (!ME.canBeHandledByMe(pkg)) {
        //TODO: translate
        throw new Error(`Package '${deploy_packages.getPackageName(pkg)}' cannot be deployed from workspace '${ME.folder.uri.fsPath}'!`);
    }

    const FILES_TO_DEPLOY = await ME.findFilesByFilter(pkg);
    if (FILES_TO_DEPLOY.length < 1) {
        //TODO: translate
        await deploy_helpers.showWarningMessage(
            `No FILES found!`
        );

        return;
    }

    const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = ME.getTargets().map((t, i) => {
        return {
            action: async () => {
                await deployFilesTo.apply(ME,
                                          [ FILES_TO_DEPLOY, t, i + 1 ]);
            },
            description: deploy_helpers.toStringSafe( t.description ).trim(),
            detail: t.__workspace.folder.uri.fsPath,
            label: deploy_targets.getTargetName(t),
        };
    });

    if (QUICK_PICK_ITEMS.length < 1) {
        //TODO: translate
        await deploy_helpers.showWarningMessage(
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
            placeHolder: 'Select the TARGET to deploy to...',  //TODO: translate
        });
    }

    if (selectedItem) {
        await Promise.resolve(
            selectedItem.action()
        );
    }
}

/**
 * Deploys a file when is has been changed.
 * 
 * @param {string} file The file to check. 
 */
export async function deployOnChange(file: string) {
    const ME: deploy_workspaces.Workspace = this;

    //TODO: translate
    const ARGS = [
        file,
        async (pkg: deploy_packages.Package) => {
            return pkg.deployOnChange;
        },
        "Deploy ON CHANGE from '{0}' to '{1}' failed: '{2}'",
    ];

    return await deploy_packages.autoDeployFile
                                .apply(ME, ARGS);
}

/**
 * Deploys a file when is has been saved.
 * 
 * @param {string} file The file to check. 
 */
export async function deployOnSave(file: string) {
    const ME: deploy_workspaces.Workspace = this;

    //TODO: translate
    const ARGS = [
        file,
        async (pkg: deploy_packages.Package) => {
            return pkg.deployOnSave;
        },
        "Deploy ON SAVE from '{0}' to '{1}' failed: '{2}'",
    ];

    return await deploy_packages.autoDeployFile
                                .apply(ME, ARGS);
}
