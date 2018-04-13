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

import * as _ from 'lodash';
import * as deploy_contracts from './contracts';
import * as deploy_gui from './gui';
import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_targets from './targets';
import * as deploy_workspaces from './workspaces';
import * as i18 from './i18';
import * as vscode from 'vscode';


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
        const PRESSED_BTN: deploy_contracts.MessageItemWithValue = await vscode.window.showWarningMessage.apply(
            null,
            [ <any>ME.t('DELETE.askIfDeleteLocalFile'), {} ].concat(BUTTONS),
        );

        if (!PRESSED_BTN || 0 == PRESSED_BTN.value) {
            return;
        }

        deleteLocalFile = 2 === PRESSED_BTN.value;
    }

    await deploy_helpers.applyFuncFor(
        deleteFilesIn,
        ME
    )([ file ], target,
      null,
      deleteLocalFile);
}

/**
 * Deletes a files from a file list of the active text editor.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export async function deleteFileList(context: vscode.ExtensionContext) {
    const WORKSPACE = await deploy_workspaces.showWorkspaceQuickPick(
        context,
        deploy_workspaces.getAllWorkspaces(),
        {
            placeHolder: i18.t('workspaces.selectWorkspace'),
        }
    );
    if (!WORKSPACE) {
        return;
    }

    const BUTTONS: deploy_contracts.MessageItemWithValue[] = [
        {
            title: WORKSPACE.t('no'),
            value: 1,
        },
        {
            title: WORKSPACE.t('yes'),
            value: 2,
        },
        {
            isCloseAffordance: true,
            title: WORKSPACE.t('cancel'),
            value: 0,
        }
    ];

    const PRESSED_BTN: deploy_contracts.MessageItemWithValue = await vscode.window.showWarningMessage.apply(
        null,
        [ <any>WORKSPACE.t('DELETE.askIfDeleteLocalFiles'), {} ].concat(BUTTONS),
    );

    if (!PRESSED_BTN || 0 == PRESSED_BTN.value) {
        return;
    }

    const DELETE_LOCAL_FILES = 2 === PRESSED_BTN.value;

    await WORKSPACE.startDeploymentOfFilesFromActiveDocument(
        async (target, files) => {
            await deploy_helpers.applyFuncFor(
                deleteFilesIn,
                target.__workspace,
            )(files, target,
              () => files,
              DELETE_LOCAL_FILES);
        }
    );
}

/**
 * Deletes files in a target.
 * 
 * @param {string[]} files The files to delete.
 * @param {deploy_targets.Target} target The target to delete in.
 * @param {deploy_contracts.Reloader<string>} fileListReloader A function that reloads the list of files.
 * @param {boolean} [deleteLocalFiles] Also delete local files or not.
 */
export async function deleteFilesIn(files: string[],
                                    target: deploy_targets.Target,
                                    fileListReloader: deploy_contracts.Reloader<string>,
                                    deleteLocalFiles?: boolean) {
    const ME: deploy_workspaces.Workspace = this;

    await deploy_helpers.withProgress(async (progress) => {
        await deploy_helpers.applyFuncFor(
            deleteFilesInWithProgress,
            ME,
        )(progress,
          files,
          target,
          fileListReloader,
          deleteLocalFiles);
    }, {
        location: vscode.ProgressLocation.Notification,
        cancellable: true,
        title: `🗑️ ` + ME.t('DELETE.deletingFiles'),        
    });
}

async function deleteFilesInWithProgress(progress: deploy_helpers.ProgressContext,
                                         files: string[],
                                         target: deploy_targets.Target,
                                         fileListReloader: deploy_contracts.Reloader<string>,
                                         deleteLocalFiles: boolean) {
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
            cancellationToken: progress.cancellationToken,
            files: files,
            deployOperation: deploy_contracts.DeployOperation.Delete,
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

    deleteLocalFiles = deploy_helpers.toBooleanSafe(deleteLocalFiles);

    const TARGET_NAME = deploy_targets.getTargetName(target);

    const PLUGINS = ME.getDeletePlugins(target);
    if (PLUGINS.length < 1) {
        ME.showWarningMessage(
            ME.t('targets.noPluginsFound')
        );

        return;
    }

    const MAPPING_SCOPE_DIRS = await deploy_targets.getScopeDirectoriesForTargetFolderMappings(target);

    const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();

    progress.cancellationToken.onCancellationRequested(() => {
        try {
            CANCELLATION_SOURCE.cancel();
        }
        catch (e) {
            ME.logger
              .trace(e, 'delete.deleteFilesInWithProgress().progressCancelToken.onCancellationRequested()');
        }
    });    
    if (progress.cancellationToken.isCancellationRequested) {
        CANCELLATION_SOURCE.cancel();
    }

    const IS_MULTI_ROOT = deploy_workspaces.getAllWorkspaces().length > 1;
    const GET_FILE_PATH_FOR_DISPLAY = (f: string) => {
        if (!IS_MULTI_ROOT) {
            const RELATIVE_PATH = ME.toRelativePath(f);
            if (false !== RELATIVE_PATH) {
                return deploy_helpers.toDisplayablePath(RELATIVE_PATH);
            }
        }

        return f;
    };

    const TARGET_SESSION = await deploy_targets.waitForOtherTargets(target);
    try {
        const ITEMS_FOR_PROGRESS: any[] = [];
        const TOTAL_COUNT = files.length * PLUGINS.length;
        const INCREMENT = TOTAL_COUNT > 0 ? (1.0 / TOTAL_COUNT * 100.0)
                                          : 0;
        const UPDATE_PROGRESS = (item: any, msg: string) => {
            let inc: number;
            if (ITEMS_FOR_PROGRESS.indexOf(item) < 0) {
                ITEMS_FOR_PROGRESS.push(item);
                inc = INCREMENT;
            }

            progress.baseContext.report({
                // increment: inc,
                message: msg,
            });
        };

        while (PLUGINS.length > 0) {
            if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                break;
            }

            const PI = PLUGINS.shift();

            const POPUP_STATS: deploy_gui.ShowPopupWhenFinishedStats = {
                failed: [],
                operation: deploy_contracts.DeployOperation.Delete,
                succeeded: [],
            };

            const OVERALL_WATCH = deploy_helpers.startWatch();

            // "finished button"
            await ME.invokeForFinishedButton(
                deploy_contracts.DeployOperation.Delete,
                (btn) => btn.hide(),
            );
            const UPDATE_FINISHED_BTN = async (err: any) => {
                await ME.invokeForFinishedButton(
                    deploy_contracts.DeployOperation.Delete,
                    async (btn) => {
                        const NOW = deploy_helpers.now();

                        let icon = `🗑️`;
                        let color: string = 'statusBar.foreground';
                        if (err) {
                            color = 'errorForeground';
                            icon = `🔥`;
                        }
                        else {
                            if (POPUP_STATS.failed.length > 0) {
                                if (POPUP_STATS.succeeded.length < 1) {
                                    color = 'errorForeground';
                                    icon = `🔥`;
                                }
                                else {
                                    color = 'editorWarning.foreground';
                                    icon = `⚠️`;
                                }
                            }
                        }                        

                        btn.color = new vscode.ThemeColor(color);
                        btn.text = `${icon} ` +
                                   `[${NOW.format( ME.t('time.timeWithSeconds') )}] ` + 
                                   ME.t('DELETE.finishedButton.text',
                                        OVERALL_WATCH.stop());
                        btn.tooltip = ME.t('DELETE.finishedButton.tooltip');

                        ME.showFinishedButton(deploy_contracts.DeployOperation.Delete);
                    }
                );
            };

            try {
                ME.output.appendLine('');

                if (files.length > 1) {
                    ME.output.appendLine(
                        `🗑️ ` + ME.t('DELETE.startOperation',
                                     TARGET_NAME)
                    );
                }

                let watch: deploy_helpers.StopWatch;
                const START_WATCH = () => watch = deploy_helpers.startWatch();
                const STOP_WATCH = () => {
                    if (watch) {
                        ME.output.appendLine(` [${watch.stop()} ms]`);
                    }

                    watch = null;
                };

                const FILES_TO_DELETE = deploy_helpers.from(files.map(f => {
                    const NAME_AND_PATH = deploy_targets.getNameAndPathForFileDeployment(target, f,
                                                                                         MAPPING_SCOPE_DIRS);
                    if (false === NAME_AND_PATH) {
                        return null;
                    }

                    const SF = new deploy_plugins.SimpleFileToDelete(ME, f, NAME_AND_PATH);
                    SF.onBeforeDelete = async function (destination?: string) {
                        const NOW = deploy_helpers.now();

                        if (arguments.length < 1) {
                            destination = NAME_AND_PATH.path;
                        }
                        destination = `${deploy_helpers.toStringSafe(destination)} (${TARGET_NAME})`;

                        const PROGRESS_MSG = `🗑️ ` +
                                             (TOTAL_COUNT > 1 ? `(${(ITEMS_FOR_PROGRESS.length + 1)} / ${TOTAL_COUNT}) ` : '') + 
                                             ME.t('DELETE.deletingFile',
                                                  GET_FILE_PATH_FOR_DISPLAY(f), destination);

                        ME.output.append(
                            `[${NOW.format( ME.t('time.timeWithSeconds') )}] ` + 
                            PROGRESS_MSG
                        );

                        UPDATE_PROGRESS(SF, PROGRESS_MSG);

                        if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                            ME.output.appendLine(`✖️`);
                        }
                        else {
                            START_WATCH();
                        }
                    };
                    SF.onDeleteCompleted = async (err?: any, deleteLocal?: boolean) => {
                        if (err) {
                            ME.output.append(`🔥: '${ deploy_helpers.toStringSafe(err) }'`);

                            POPUP_STATS.failed.push( f );
                        }
                        else {
                            POPUP_STATS.succeeded.push( f );

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

                                ME.output.append(`✅`);
                            }
                            catch (e) {
                                ME.output.append(`⚠️: '${deploy_helpers.toStringSafe(e)}'`);
                            }                            
                        }

                        STOP_WATCH();
                    };

                    return SF;
                })).where(f => !_.isNil(f)).orderBy(f => {
                   return deploy_helpers.normalizeString(f.path).length;
                }).thenBy(f => {
                    return deploy_helpers.normalizeString(f.path);
                }).thenBy(f => {
                    return deploy_helpers.normalizeString(f.name).length;
                }).thenBy(f => {
                    return deploy_helpers.normalizeString(f.name);
                }).toArray();

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
                    ME.output.appendLine(
                        `✖️ ` + ME.t('DELETE.canceledByOperation',
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
                ME.output.appendLine('');
                const BEFORE_DELETE_ABORTED = !deploy_helpers.toBooleanSafe(
                    await deploy_targets.executeTargetOperations({
                        cancellationToken: progress.cancellationToken,
                        files: FILES_TO_DELETE.map(ftu => {
                            return ftu.path + '/' + ftu.name;
                        }),
                        onBeforeExecute: async (operation) => {
                            ++operationIndex;

                            ME.output.append(
                                `⚡ ` + ME.t('targets.operations.runningBeforeDelete',
                                            GET_OPERATION_NAME(operation))
                            );

                            if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                                ME.output.appendLine(`✖️`);
                            }
                            else {
                                START_WATCH();
                            }
                        },
                        onExecutionCompleted: async (operation, err, doesContinue) => {
                            if (err) {
                                ME.output.append(`🔥: '${ deploy_helpers.toStringSafe(err) }'`);
                            }
                            else {
                                ME.output.append(`✅`);
                            }

                            STOP_WATCH();
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
                        cancellationToken: progress.cancellationToken,
                        files: FILES_TO_DELETE.map(ftu => {
                            return ftu.path + '/' + ftu.name;
                        }),
                        onBeforeExecute: async (operation) => {
                            ++operationIndex;

                            ME.output.append(
                                `⚡ ` + ME.t('targets.operations.runningAfterDeleted',
                                            GET_OPERATION_NAME(operation))
                            );

                            if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                                ME.output.appendLine(`✖️`);
                            }
                            else {
                                START_WATCH();
                            }
                        },
                        onExecutionCompleted: async (operation, err, doesContinue) => {
                            if (err) {
                                ME.output.append(`🔥: '${ deploy_helpers.toStringSafe(err) }'`);
                            }
                            else {
                                ME.output.append(`✅`);
                            }

                            STOP_WATCH();
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
                    ME.output.appendLine('');
                    ME.output.appendLine(
                        `🗑️ ` +
                        ME.t('DELETE.finishedOperation',
                             TARGET_NAME)
                    );
                }

                UPDATE_FINISHED_BTN(null);
            }
            catch (e) {
                ME.output.appendLine(
                    `🔥 ` + 
                    ME.t('DELETE.finishedOperationWithErrors',
                         TARGET_NAME, e)
                );

                POPUP_STATS.failed = files;
                POPUP_STATS.succeeded = [];

                UPDATE_FINISHED_BTN(e);
            }
            finally {
                deploy_helpers.applyFuncFor(
                    deploy_gui.showPopupWhenFinished,
                    ME
                )( POPUP_STATS );
            }
        }
    }
    finally {
        deploy_helpers.tryDispose(CANCELLATION_SOURCE);

        deploy_targets.unmarkTargetAsInProgress(
            target, TARGET_SESSION
        );
    }
}

/**
 * Deletes a package.
 * 
 * @param {deploy_packages.Package} pkg The package to delete.
 * @param {deploy_targets.TargetResolver} targetResolver A function to receive optional targets.
 * @param {boolean} [askForDeleteLocalFiles] Also ask for deleting the local files or not.
 */
export async function deletePackage(pkg: deploy_packages.Package, targetResolver: deploy_targets.TargetResolver,
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

    let exclude = deploy_helpers.asArray(pkg.exclude).filter(f => {
        return !deploy_helpers.isEmptyString(f);
    });
    if (exclude.length < 1) {
        exclude = undefined;
    }

    const RELOADER = async () => {
        const FILES_FROM_FILTER = await ME.findFilesByFilter(
            deploy_packages.preparePackageForFileFilter(pkg)
        );
        
        await deploy_packages.importPackageFilesFromGit(
            pkg,
            deploy_contracts.DeployOperation.Delete,
            FILES_FROM_FILTER,
        );

        return FILES_FROM_FILTER;
    };

    const FILES_TO_DELETE = await RELOADER();
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

    const TARGETS = deploy_helpers.applyFuncFor(deploy_packages.getTargetsOfPackage, ME)(
        pkg, targetResolver
    );
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
      RELOADER,
      deleteLocalFiles);
}

/**
 * Registers commands for delete operations.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function registerDeleteCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        // delete
        vscode.commands.registerCommand('extension.deploy.reloaded.delete', async () => {
            try {
                const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
                    {
                        action: async () => {
                            await vscode.commands.executeCommand('extension.deploy.reloaded.deleteFile');
                        },
                        label: '$(trashcan)  ' + i18.t('DELETE.currentFile.label'),
                        description: i18.t('DELETE.currentFile.description'),
                    },
                    {
                        action: async () => {
                            await vscode.commands.executeCommand('extension.deploy.reloaded.deletePackage');
                        },
                        label: '$(trashcan)  ' + i18.t('DELETE.package.label'),
                        description: i18.t('DELETE.package.description'),
                    },
                    {
                        action: async () => {
                            await vscode.commands.executeCommand('extension.deploy.reloaded.deleteFileList');
                        },
                        label: '$(list-ordered)  ' + i18.t('DELETE.fileList.label'),
                        description: i18.t('DELETE.fileList.description'),
                    }
                ];

                const SELECTED_ITEM = await vscode.window.showQuickPick(QUICK_PICKS);
                if (SELECTED_ITEM) {
                    await Promise.resolve(
                        SELECTED_ITEM.action()
                    );
                }
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.delete');

                deploy_helpers.showErrorMessage(
                    i18.t('DELETE.errors.operationFailed')
                );
            }
        }),

        // delete file list
        vscode.commands.registerCommand('extension.deploy.reloaded.deleteFileList', async () => {
            try {
                await deleteFileList(context);
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.deleteFileList');
                
                deploy_helpers.showErrorMessage(
                    i18.t('DELETE.errors.operationFailed')
                );
            }
        }),

        // delete package
        vscode.commands.registerCommand('extension.deploy.reloaded.deletePackage', async () => {
            try {
                const PKG = await deploy_packages.showPackageQuickPick(
                    context,
                    deploy_packages.getAllPackagesSorted(),
                    {
                        placeHolder: i18.t('packages.selectPackage'),
                    }
                );

                if (PKG) {
                    await PKG.__workspace
                             .deletePackage(PKG);
                }
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.deletePackage');

                deploy_helpers.showErrorMessage(
                    i18.t('DELETE.errors.operationFailed')
                );
            }
        }),

        // delete current file
        vscode.commands.registerCommand('extension.deploy.reloaded.deleteFile', async () => {
            try {
                await deploy_targets.invokeForActiveEditorAndTarget(
                    i18.t('targets.selectTarget'),
                    async (file, target) => {
                        await target.__workspace
                                    .deleteFileIn(file, target);
                    }
                );
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.deleteFile');
                
                deploy_helpers.showErrorMessage(
                    i18.t('DELETE.errors.operationFailed')
                );
            }
        }),

        // delete package files
        vscode.commands.registerCommand('extension.deploy.reloaded.deletePackageFiles', async (packageNames: string | string[], targetNames: string | string[]) => {
            packageNames = deploy_helpers.asArray( packageNames ).map(p => {
                return deploy_helpers.normalizeString(p);
            }).filter(p => '' !== p);

            targetNames = deploy_helpers.asArray( targetNames ).map(t => {
                return deploy_helpers.normalizeString(t);
            }).filter(t => '' !== t);

            const ALL_WORKSPACES = deploy_workspaces.getAllWorkspaces();

            for (const PN of packageNames) {
                const MATCHING_PACKAGES = deploy_helpers.from( ALL_WORKSPACES ).selectMany(ws => {
                    return ws.getPackages();
                }).where(p => {
                    return PN === deploy_helpers.normalizeString(p.name);
                });

                for (const MP of MATCHING_PACKAGES) {
                    try {
                        await deploy_helpers.applyFuncFor(
                            deletePackage, MP.__workspace
                        )(MP, () => targetNames);
                    }
                    catch (e) {
                        deploy_log.CONSOLE
                                  .trace(e, 'extension.deploy.reloaded.deletePackageFiles(1)');
                    }
                }
            }
        }),
    );
}
