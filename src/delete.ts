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
import * as vscode from 'vscode';


/**
 * Deletes a file in a target.
 * 
 * @param {string} file The file to delete.
 * @param {deploy_targets.Target} target The target to delete in.
 * @param {number} [targetNr] The number of the target.
 */
export async function deleteFileIn(file: string, target: deploy_targets.Target) {
    const ME: deploy_workspaces.Workspace = this;

    if (!target) {
        return;
    }

    if (target.__workspace.FOLDER.uri.fsPath !== ME.FOLDER.uri.fsPath) {
        //TODO: translate
        throw new Error(`File '${file}' cannot be deleted in workspace '${ME.FOLDER.uri.fsPath}'!`);
    }

    //TODO: translate
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

    //TODO: translate
    const PRESSED_BTN: deploy_contracts.MessageItemWithValue = await vscode.window.showWarningMessage.apply(
        null,
        [ <any>'Also delete local file?', {} ].concat(BUTTONS),
    );

    if (!PRESSED_BTN || 0 == PRESSED_BTN.value) {
        return;
    }

    const DELETE_LOCAL_FILE = 2 === PRESSED_BTN.value;

    await deleteFilesIn.apply(
        ME,
        [ [ file ], target, target.__index + 1, DELETE_LOCAL_FILE ]
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
    
    if (!files || files.length < 1) {
        return;
    }

    if (!target) {
        return;
    }

    if (isNaN(targetNr)) {
        targetNr = target.__index + 1;
    }

    const TARGET_NAME = deploy_targets.getTargetName(target);
    const TARGET_TYPE = deploy_helpers.normalizeString(target.type);

    const PLUGINS = ME.CONTEXT.plugins.filter(pi => {
        return '' === pi.__type || 
               (TARGET_TYPE === pi.__type && pi.canDelete && pi.deleteFiles);
    });

    if (PLUGINS.length < 1) {
        //TODO: translate
        await deploy_helpers.showWarningMessage(
            `No matching PLUGINS found!`
        );

        return;
    }

    while (PLUGINS.length > 0) {
        const PI = PLUGINS.shift();

        try {
            ME.CONTEXT.outputChannel.appendLine('');

            // TODO: translate
            if (files.length > 1) {
                ME.CONTEXT.outputChannel.appendLine(`Start deleting files in '${TARGET_NAME}'...`);
            }

            const CTX: deploy_plugins.DeleteContext = {
                files: files.map(f => {
                    const NAME_AND_PATH = ME.toNameAndPath(f);
                    if (false === NAME_AND_PATH) {
                        // TODO: translate
                        ME.CONTEXT.outputChannel.append(`Cannot detect path information for file '${f}'!`);

                        return null;
                    }

                    const SF = new deploy_plugins.SimpleFileToDelete(ME, f, NAME_AND_PATH);
                    SF.onBeforeDelete = async (destination?: string) => {
                        // TODO: translate
                        ME.CONTEXT.outputChannel.append(`Deleting file '${f}' in '${TARGET_NAME}'... `);
                    };
                    SF.onDeleteCompleted = async (err?: any, deleteLocal?: boolean) => {
                        // TODO: translate
                        if (err) {
                            ME.CONTEXT.outputChannel.appendLine(`[ERROR: ${err}]`);
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

                                ME.CONTEXT.outputChannel.appendLine(`[OK]`);
                            }
                            catch (e) {
                                ME.CONTEXT.outputChannel.appendLine(`[WARNING: ${e}]`);
                            }
                        }
                    };

                    return SF;
                }).filter(f => null !== f),
                target: target,
            };

            await Promise.resolve(
                PI.deleteFiles(CTX)
            );

            if (files.length > 1) {
                // TODO: translate
                ME.CONTEXT.outputChannel.appendLine(`Deleting files in '${TARGET_NAME}' has been finished.`);
            }
        }
        catch (e) {
            // TODO: translate
            ME.CONTEXT.outputChannel.appendLine(`[ERROR] Deleting files in '${TARGET_NAME}' failed: ${e}`);
        }
    }
}

/**
 * Deletes a package.
 * 
 * @param {deploy_packages.Package} pkg The package to delete. 
 */
export async function deletePackage(pkg: deploy_packages.Package) {
    const ME: deploy_workspaces.Workspace = this;

    if (!pkg) {
        return;
    }

    if (pkg.__workspace.FOLDER.uri.fsPath !== ME.FOLDER.uri.fsPath) {
        //TODO: translate
        throw new Error(`Package '${deploy_packages.getPackageName(pkg)}' cannot be deleted in workspace '${ME.FOLDER.uri.fsPath}'!`);
    }

    const FILES = deploy_helpers.asArray(pkg.files).filter(f => {
        return !deploy_helpers.isEmptyString(f);
    });

    const EXCLUDE = deploy_helpers.asArray(pkg.exclude).filter(f => {
        return !deploy_helpers.isEmptyString(f);
    });

    const ROOT_DIR = ME.FOLDER.uri.fsPath;

    const FILES_TO_DELETE = await deploy_helpers.glob(FILES, {
        absolute: true,
        cwd: ROOT_DIR,
        dot: false,
        ignore: EXCLUDE,
        nodir: true,
        nonull: true,
        nosort: false,
        root: ROOT_DIR,
        sync: false,
    });

    if (FILES_TO_DELETE.length < 1) {
        //TODO: translate
        await deploy_helpers.showWarningMessage(
            `No FILES found!`
        );

        return;
    }

    //TODO: translate
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

    //TODO: translate
    const PRESSED_BTN: deploy_contracts.MessageItemWithValue = await vscode.window.showWarningMessage.apply(
        null,
        [ <any>'Also delete local files?', {} ].concat(BUTTONS),
    );

    if (!PRESSED_BTN || 0 == PRESSED_BTN.value) {
        return;
    }

    const DELETE_LOCAL_FILES = 2 === PRESSED_BTN.value;

    const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = ME.getTargets().map((t, i) => {
        return {
            action: async () => {
                await deleteFilesIn.apply(ME,
                                          [ FILES_TO_DELETE, t, i + 1, DELETE_LOCAL_FILES ]);
            },
            description: deploy_helpers.toStringSafe( t.description ).trim(),
            detail: t.__workspace.FOLDER.uri.fsPath,
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
            placeHolder: 'Select the TARGET to delete files in...',  //TODO: translate
        });
    }

    if (selectedItem) {
        await Promise.resolve(
            selectedItem.action()
        );
    }
}
