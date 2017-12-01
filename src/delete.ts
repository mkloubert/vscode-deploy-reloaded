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

    if (!target) {
        return;
    }

    if (!ME.canBeHandledByMe(target)) {
        //TODO: translate
        throw new Error(`File '${file}' cannot be deleted in workspace '${ME.folder.uri.fsPath}'!`);
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
    
    if (!files || files.length < 1) {
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
    const TARGET_TYPE = deploy_helpers.normalizeString(target.type);

    const PLUGINS = ME.context.plugins.filter(pi => {
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
            ME.context.outputChannel.appendLine('');

            // TODO: translate
            if (files.length > 1) {
                ME.context.outputChannel.appendLine(`Start deleting files in '${TARGET_NAME}'...`);
            }

            const CTX: deploy_plugins.DeleteContext = {
                files: files.map(f => {
                    const NAME_AND_PATH = ME.toNameAndPath(f);
                    if (false === NAME_AND_PATH) {
                        // TODO: translate
                        ME.context.outputChannel.append(`Cannot detect path information for file '${f}'!`);

                        return null;
                    }

                    const SF = new deploy_plugins.SimpleFileToDelete(ME, f, NAME_AND_PATH);
                    SF.onBeforeDelete = async (destination?: string) => {
                        // TODO: translate
                        ME.context.outputChannel.append(`Deleting file '${f}' in '${TARGET_NAME}'... `);
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

                                ME.context.outputChannel.appendLine(`[OK]`);
                            }
                            catch (e) {
                                ME.context.outputChannel.appendLine(`[WARNING: ${e}]`);
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
                ME.context.outputChannel.appendLine(`Deleting files in '${TARGET_NAME}' has been finished.`);
            }
        }
        catch (e) {
            // TODO: translate
            ME.context.outputChannel.appendLine(`[ERROR] Deleting files in '${TARGET_NAME}' failed: ${e}`);
        }
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

    if (!pkg) {
        return;
    }

    if (!ME.canBeHandledByMe(pkg)) {
        //TODO: translate
        throw new Error(`Package '${deploy_packages.getPackageName(pkg)}' cannot be deleted in workspace '${ME.folder.uri.fsPath}'!`);
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

    const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = ME.getTargets().map((t, i) => {
        return {
            action: async () => {
                await deleteFilesIn.apply(ME,
                                          [ FILES_TO_DELETE, t, i + 1, deleteLocalFiles ]);
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

    try {
        let relativePath = ME.toRelativePath(file);
        if (false === relativePath) {
            return;
        }

        const KNOWN_TARGETS = ME.getTargets();

        const TARGETS: deploy_targets.Target[] = [];
        for (let pkg of ME.getPackages()) {
            const REMOVE_ON_CHANGE = pkg.removeOnChange;

            if (deploy_helpers.isNullOrUndefined(REMOVE_ON_CHANGE)) {
                continue;
            }

            let filter: deploy_contracts.FileFilter;
            let targetNames: string | string[] | false = false;
            let useMinimatch = false;

            if (deploy_helpers.isObject<deploy_contracts.FileFilter>(REMOVE_ON_CHANGE)) {
                filter = REMOVE_ON_CHANGE;
                targetNames = pkg.targets;
            }
            else if (deploy_helpers.isBool(REMOVE_ON_CHANGE)) {
                if (true === REMOVE_ON_CHANGE) {
                    filter = pkg;
                    targetNames = pkg.targets;
                    useMinimatch = true;
                }
            }
            else {
                filter = pkg;
                targetNames = REMOVE_ON_CHANGE;
            }

            if (false === targetNames) {
                continue;
            }

            if (!filter) {
                filter = {
                    files: '**'
                };
            }

            const MATCHING_TARGETS = deploy_targets.getTargetsByName(
                targetNames,
                KNOWN_TARGETS
            );
            if (false === MATCHING_TARGETS) {
                return;
            }

            let fileList: string[];
            if (useMinimatch) {
                // filter all files of that package
                // by 'minimatch'
                fileList = (await ME.findFilesByFilter(pkg)).filter(f => {
                    let relPath = ME.toRelativePath(f);
                    if (false !== relPath) {
                        return deploy_helpers.checkIfDoesMatchByFileFilter('/' + relPath,
                                                                           deploy_helpers.toMinimatchFileFilter(filter));
                    }

                    return false;
                });
            }
            else {
                fileList = await ME.findFilesByFilter(filter);
            }

            const DOES_MATCH = Enumerable.from( fileList ).select(f => {
                return Path.resolve(f);
            }).contains(file);

            if (DOES_MATCH) {
                TARGETS.push
                       .apply(TARGETS, MATCHING_TARGETS);
            }
        };

        if (TARGETS.length < 1) {
            return;
        }

        await deploy_helpers.forEachAsync(Enumerable.from(TARGETS)
                                                    .distinct(true),
            async (t) => {
                const TARGET_NAME = deploy_targets.getTargetName(t);

                try {
                    await ME.deleteFileIn(file, t, false);
                }
                catch (e) {
                    //TODO: translate

                    deploy_helpers.showErrorMessage(
                        `Auto removing file '${file}' in '${TARGET_NAME}' failed: ${e}`
                    );
                }
            });
    }
    catch (e) {
        deploy_log.CONSOLE
                    .trace(e, 'delete.removeOnChange()');
    }
}
