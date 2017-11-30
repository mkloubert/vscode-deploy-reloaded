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
 * Pulls a file from a target.
 * 
 * @param {string} file The file to pull.
 * @param {deploy_targets.Target} target The target from where to pull from.
 */
export async function pullFileFrom(file: string, target: deploy_targets.Target) {
    const ME: deploy_workspaces.Workspace = this;

    if (!target) {
        return;
    }

    if (target.__workspace.FOLDER.uri.fsPath !== ME.FOLDER.uri.fsPath) {
        //TODO: translate
        throw new Error(`File '${file}' cannot be pulled to workspace '${ME.FOLDER.uri.fsPath}'!`);
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
               (TARGET_TYPE === pi.__type && pi.canDownload && pi.downloadFiles);
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
                ME.CONTEXT.outputChannel.appendLine(`Start pulling files from '${TARGET_NAME}'...`);
            }

            const CTX: deploy_plugins.DownloadContext = {
                files: files.map(f => {
                    const NAME_AND_PATH = ME.toNameAndPath(f);
                    if (false === NAME_AND_PATH) {
                        // TODO: translate
                        ME.CONTEXT.outputChannel.append(`Cannot detect path information for file '${f}'!`);

                        return null;
                    }

                    const SF = new deploy_plugins.SimpleFileToDownload(ME, f, NAME_AND_PATH);
                    SF.onBeforeDownload = async (destination?: string) => {
                        // TODO: translate
                        ME.CONTEXT.outputChannel.append(`Pulling file '${f}' from '${TARGET_NAME}'... `);
                    };
                    SF.onDownloadCompleted = async (err?: any, downloadedFile?: deploy_plugins.DownloadedFile) => {
                        // TODO: translate
                        try {
                            if (err) {
                                throw err;
                            }
                            else {
                                if (downloadedFile) {
                                    await deploy_helpers.writeFile(
                                        f,
                                        await Promise.resolve(
                                            downloadedFile.read()
                                        ),
                                    );
                                }

                                ME.CONTEXT.outputChannel.appendLine(`[OK]`);
                            }
                        }
                        catch (e) {
                            ME.CONTEXT.outputChannel.appendLine(`[ERROR: ${e}]`);
                        }
                    };

                    return SF;
                }).filter(f => null !== f),
                target: target,
            };

            await Promise.resolve(
                PI.downloadFiles(CTX)
            );

            if (files.length > 1) {
                // TODO: translate
                ME.CONTEXT.outputChannel.appendLine(`Pulling files from '${TARGET_NAME}' has been finished.`);
            }
        }
        catch (e) {
            // TODO: translate
            ME.CONTEXT.outputChannel.appendLine(`[ERROR] Pulling from '${TARGET_NAME}' failed: ${e}`);
        }
    }
}

/**
 * Pulls a package.
 * 
 * @param {deploy_packages.Package} pkg The package to pull. 
 */
export async function pullPackage(pkg: deploy_packages.Package) {
    const ME: deploy_workspaces.Workspace = this;

    if (!pkg) {
        return;
    }

    if (pkg.__workspace.FOLDER.uri.fsPath !== ME.FOLDER.uri.fsPath) {
        //TODO: translate
        throw new Error(`Package '${deploy_packages.getPackageName(pkg)}' cannot be pulled into workspace '${ME.FOLDER.uri.fsPath}'!`);
    }

    const FILES = deploy_helpers.asArray(pkg.files).filter(f => {
        return !deploy_helpers.isEmptyString(f);
    });

    const EXCLUDE = deploy_helpers.asArray(pkg.exclude).filter(f => {
        return !deploy_helpers.isEmptyString(f);
    });

    const ROOT_DIR = ME.FOLDER.uri.fsPath;

    const FILES_TO_PULL = await deploy_helpers.glob(FILES, {
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

    if (FILES_TO_PULL.length < 1) {
        //TODO: translate
        await deploy_helpers.showWarningMessage(
            `No FILES found!`
        );

        return;
    }

    const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = ME.getTargets().map((t, i) => {
        return {
            action: async () => {
                await pullFilesFrom.apply(ME,
                                          [ FILES_TO_PULL, t, i + 1 ]);
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
            placeHolder: 'Select the TARGET to pull from...',  //TODO: translate
        });
    }

    if (selectedItem) {
        await Promise.resolve(
            selectedItem.action()
        );
    }
}
