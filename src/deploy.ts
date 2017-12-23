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
import * as deploy_transformers from './transformers';
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
    const STATE_KEY = deploy_helpers.toStringSafe(target.__id);

    const PLUGINS = ME.getUploadPlugins(target);
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
            const RESTORE_CANCEL_BTN_TEXT = () => {
                cancelBtn.text = ME.t('deploy.buttons.cancel.text',
                                      TARGET_NAME);
                cancelBtn.tooltip = ME.t('deploy.buttons.cancel.tooltip');
            };

            const CANCEL_BTN_COMMAND_ID = `extension.deploy.reloaded.buttons.cancelDeployFilesTo${nextCancelBtnCommandId++}`;
            
            cancelBtnCommand = vscode.commands.registerCommand(CANCEL_BTN_COMMAND_ID, async () => {
                try {
                    isCancelling = true;

                    cancelBtn.command = undefined;
                    cancelBtn.text = ME.t('deploy.cancelling');

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
                        [ <any>ME.t('deploy.askForCancelOperation', TARGET_NAME) ].concat(
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

                // TODO: translate
                if (files.length > 1) {
                    ME.context.outputChannel.appendLine(`Start deploying files to '${TARGET_NAME}'...`);
                }

                const FILES_TO_UPLOAD: deploy_plugins.LocalFileToUpload[] = [];
                for (const F of files) {
                    const NAME_AND_PATH = ME.getNameAndPathForFileDeployment(F, target);
                    if (false === NAME_AND_PATH) {
                        return null;
                    }

                    const LF = new deploy_plugins.LocalFileToUpload(ME, F, NAME_AND_PATH);
                    LF.onBeforeUpload = async function(destination?: string) {
                        if (arguments.length < 1) {
                            destination = `'${deploy_helpers.toDisplayablePath(NAME_AND_PATH.path)}' (${TARGET_NAME})`;
                        }
                        else {
                            destination = `'${deploy_helpers.toStringSafe(destination)}'`;
                        }

                        // TODO: translate
                        ME.context.outputChannel.append(`Deploying file '${F}' to ${destination}... `);

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

                    LF.transformer = transformer;
                    LF.transformerOptions = TRANSFORMER_OPTIONS;
                    LF.transformerStateKeyProvider = () => {
                        return STATE_KEY;
                    };

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

                // beforeDeploy
                operationIndex = -1;
                ME.context.outputChannel.appendLine('');
                const BEFORE_DEPLOY_ABORTED = !deploy_helpers.toBooleanSafe(
                    await deploy_targets.executeTargetOperations({
                        deployOperation: deploy_contracts.DeployOperation.Deploy,
                        files: FILES_TO_UPLOAD.map(ftu => {
                            return ftu.path + '/' + ftu.name;
                        }),
                        onBeforeExecute: async (operation) => {
                            ++operationIndex;

                            //TODO: translate
                            ME.context.outputChannel.append(`Running BEFORE DEPLOY operation '${GET_OPERATION_NAME(operation)}'... `);
                        },
                        onExecutionCompleted: async (operation, err, doesContinue) => {
                            //TODO: translate
                            if (err) {
                                ME.context.outputChannel.appendLine(`[FAILED: '${deploy_helpers.toStringSafe(err)}']`);
                            }
                            else {
                                ME.context.outputChannel.appendLine('[OK]');
                            }
                        },
                        operation: deploy_targets.TargetOperationEvent.BeforeDeploy,
                        target: target,
                    })
                , true);
                if (BEFORE_DEPLOY_ABORTED) {
                    SHOW_CANCELED_BY_OPERATIONS_MESSAGE();
                    continue;
                }

                await Promise.resolve(
                    PI.uploadFiles(CTX)
                );

                // deployed
                operationIndex = -1;
                const AFTER_DEPLOY_ABORTED = !deploy_helpers.toBooleanSafe(
                    await deploy_targets.executeTargetOperations({
                        deployOperation: deploy_contracts.DeployOperation.Deploy,
                        files: FILES_TO_UPLOAD.map(ftu => {
                            return ftu.path + '/' + ftu.name;
                        }),
                        onBeforeExecute: async (operation) => {
                            ++operationIndex;

                            //TODO: translate
                            ME.context.outputChannel.append(`Running AFTER DEPLOYED operation '${GET_OPERATION_NAME(operation)}'... `);
                        },
                        onExecutionCompleted: async (operation, err, doesContinue) => {
                            //TODO: translate
                            if (err) {
                                ME.context.outputChannel.appendLine(`[FAILED: '${deploy_helpers.toStringSafe(err)}']`);
                            }
                            else {
                                ME.context.outputChannel.appendLine('[OK]');
                            }
                        },
                        operation: deploy_targets.TargetOperationEvent.AfterDeployed,
                        target: target,
                    })
                , true);
                if (AFTER_DEPLOY_ABORTED) {
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

    const PACKAGE_BTN = pkg.__button;
    try {
        if (PACKAGE_BTN) {
            PACKAGE_BTN.hide();
        }

        if (!ME.canBeHandledByMe(pkg)) {
            //TODO: translate
            throw new Error(`Package '${deploy_packages.getPackageName(pkg)}' cannot be deployed from workspace '${ME.folder.uri.fsPath}'!`);
        }

        const FILES_TO_DEPLOY = await ME.findFilesByFilter(pkg);
        if (FILES_TO_DEPLOY.length < 1) {
            //TODO: translate
            await ME.showWarningMessage(
                `No FILES found!`
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
                    await deployFilesTo.apply(ME,
                                            [ FILES_TO_DEPLOY, t, i + 1 ]);
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
                placeHolder: 'Select the TARGET to deploy to...',  //TODO: translate
            });
        }

        if (selectedItem) {
            await Promise.resolve(
                selectedItem.action()
            );
        }
    }
    finally {
        if (PACKAGE_BTN) {
            PACKAGE_BTN.show();
        }
    }
}

/**
 * Deploys a file when is has been changed.
 * 
 * @param {string} file The file to check. 
 */
export async function deployOnChange(file: string) {
    const ME: deploy_workspaces.Workspace = this;

    const ARGS = [
        file,
        (pkg: deploy_packages.Package) => pkg.deployOnChange,
        "deploy.onChange.failed",
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

    const ARGS = [
        file,
        (pkg: deploy_packages.Package) => pkg.deployOnSave,
        "deploy.onSave.failed",
    ];

    return await deploy_packages.autoDeployFile
                                .apply(ME, ARGS);
}
