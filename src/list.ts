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

import * as CopyPaste from 'copy-paste';
import * as Crypto from 'crypto';
import * as deploy_contracts from './contracts';
import * as deploy_files from './files';
import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as deploy_plugins from './plugins';
import * as deploy_targets from './targets';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as FileSize from 'filesize';
import * as Path from 'path';
import * as vscode from 'vscode';


function createSelectFileAction(file: deploy_files.FileInfo) {
    if (!file) {
        return;
    }

    return async () => {
        if (file.download) {
            const EXT = Path.extname(file.name);

            await deploy_helpers.invokeForTempFile(
                async (tempFile) => {
                    await deploy_helpers.writeFile(
                        tempFile,
                        await Promise.resolve(
                            file.download()
                        ),
                    );

                    const EDITOR = await vscode.workspace.openTextDocument(tempFile);

                    await vscode.window.showTextDocument(EDITOR);
                }, {
                    keep: true,
                    postfix: EXT,
                    prefix: Path.basename(file.name, EXT) + '-',
                }
            );
        }
    };
}

/**
 * List a directory of a target.
 * 
 * @param {deploy_targets.Target} target The target. 
 * @param {string} [dir] The path to the sub directory.
 */
export async function listDirectory(target: deploy_targets.Target, dir?: string) {
    const ME: deploy_workspaces.Workspace = this;

    target = ME.prepareTarget(target);

    if (ME.isInFinalizeState) {
        return;
    }

    let fromCache = false;

    const LAST_DIR_CACHE = ME.workspaceSessionState['list']['lastDirectories'];

    const TARGET_NAME = deploy_targets.getTargetName(target);
    const TARGET_CACHE_KEY = target.__index + '::' + Crypto.createHash('sha256')
                                                           .update( new Buffer(deploy_helpers.toStringSafe(target.__id), 'utf8') )
                                                           .digest('hex');

    if (arguments.length < 2) {
        // try to get last directory
        // from cache

        const LAST_DIR = LAST_DIR_CACHE[TARGET_CACHE_KEY];
        if (!deploy_helpers.isEmptyString(LAST_DIR)) {
            fromCache = true;

            dir = LAST_DIR;
        }
    }

    dir = deploy_helpers.toStringSafe(dir);

    let wholeOperationHasFailed = false;
    try {
        const PLUGINS = ME.getListPlugins(target);
        if (PLUGINS.length < 1) {
            ME.showWarningMessage(
                ME.t('targets.noPluginsFound')
            );

            return;
        }

        let displayDir = dir;
        if (deploy_helpers.isEmptyString(displayDir)) {
            displayDir = '/';
        }

        let selfInfo: deploy_files.DirectoryInfo;
        const FILES_AND_FOLDERS = await deploy_helpers.withProgress(async (ctx) => {
            const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();
            try {
                const LOADED_FILES_AND_FILES: deploy_files.FileSystemInfo[] = [];

                let index = -1;
                const TOTAL_COUNT = PLUGINS.length;
                while (PLUGINS.length > 0) {
                    ++index;

                    if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                        return false;
                    }

                    const PI = PLUGINS.shift();

                    ctx.message = ME.t('listDirectory.loading',
                                       displayDir, index + 1, TOTAL_COUNT);

                    const CTX: deploy_plugins.ListDirectoryContext = {
                        cancellationToken: CANCELLATION_SOURCE.token,
                        dir: dir,
                        isCancelling: undefined,
                        target: target,
                        workspace: ME,
                    };

                    // CTX.isCancelling
                    Object.defineProperty(CTX, 'isCancelling', {
                        enumerable: true,

                        get: () => {
                            return CTX.cancellationToken.isCancellationRequested;
                        }
                    });

                    const ITEMS = await PI.listDirectory(CTX);
                    if (ITEMS) {
                        selfInfo = ITEMS.info;

                        const LOADED_ITEMS: deploy_files.FileSystemInfo[] = deploy_helpers.asArray(
                            <any>ITEMS.dirs,
                        ).concat(
                            <any>deploy_helpers.asArray(
                                ITEMS.files
                            )
                        ).concat(
                            <any>deploy_helpers.asArray(
                                ITEMS.others
                            )
                        );

                        LOADED_FILES_AND_FILES.push
                                              .apply(LOADED_FILES_AND_FILES, LOADED_ITEMS);
                    }
                }

                return LOADED_FILES_AND_FILES;
            }
            finally {
                deploy_helpers.tryDispose(CANCELLATION_SOURCE);
            }
        }, {
            title: `[${TARGET_NAME}]`,
        });

        if (false === FILES_AND_FOLDERS) {
            return;
        }

        const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = [];

        const LIST_DIRECTORY = async (d: string) => {
            listDirectory.apply(
                ME,
                [ target, d ]
            );
        };

        FILES_AND_FOLDERS.sort((x, y) => {
            // first by type:
            // 
            // 1. directories
            // 2. others
            const COMP0 = deploy_helpers.compareValuesBy(x, y, (f) => {
                return deploy_files.FileSystemType.Directory == f.type ? 0 : 1; 
            });
            if (0 !== COMP0) {
                return COMP0;
            }

            // custom comparer?
            if (x.type == y.type) {
                if (x.compareTo) {
                    const COMP1 = x.compareTo(y);
                    if (0 != COMP1) {
                        return COMP1;
                    }
                }
            }

            // then by name
            const COMP2 = deploy_helpers.compareValuesBy(x, y, (f) => {
                return deploy_helpers.normalizeString(f.name);
            });
            if (0 !== COMP2) {
                return COMP2;
            }

            // then by timestamp (DESC)
            return deploy_helpers.compareValuesBy(y, x, (f) => {
                const LT = deploy_helpers.asLocalTime(f.time);
                if (LT) {
                    return LT.unix();
                }
            });
        }).forEach(f => {
            let label = deploy_helpers.toStringSafe(f.name).trim();
            if ('' === label) {
                label = ME.t('listDirectory.noName');
            }

            const DETAIL_ITEMS: string[] = [];

            const GET_ICON_SAFE = (defaultIcon: string) => {
                let icon = deploy_helpers.toStringSafe(f.icon).trim();
                if ('' === icon) {
                    icon = defaultIcon;
                }

                return '$(' + icon + ')  ';
            };

            let action: () => any;
            if (deploy_files.FileSystemType.Directory == f.type) {
                // directory

                label = GET_ICON_SAFE('file-directory') + label;

                action = async () => {
                    let pathPart = f.internal_name;
                    if (deploy_helpers.isEmptyString(pathPart)) {
                        pathPart = f.name;
                    }

                    LIST_DIRECTORY(
                        dir + '/' + pathPart,
                    );
                };
            }
            else if (deploy_files.FileSystemType.File == f.type) {
                // file

                label = GET_ICON_SAFE('file-binary') + label;
                
                action = createSelectFileAction(
                    <deploy_files.FileInfo>f
                );
            }
            else {
                label = GET_ICON_SAFE('question') + label;
            }

            if (deploy_files.FileSystemType.Directory != f.type) {
                if (!isNaN(f.size)) {
                    DETAIL_ITEMS.push(
                        ME.t('listDirectory.size',
                             FileSize(f.size, {round: 2}))
                    );
                }
            }

            const LOCAL_TIME = deploy_helpers.asLocalTime(f.time);
            if (LOCAL_TIME && LOCAL_TIME.isValid()) {
                DETAIL_ITEMS.push(
                    ME.t('listDirectory.lastModified',
                         LOCAL_TIME.format( ME.t('time.dateTimeWithSeconds') ))
                );
            }

            QUICK_PICK_ITEMS.push({
                label: label,
                description: '',
                detail: DETAIL_ITEMS.join(', '),
                action: action,
            });
        });

        if (!deploy_helpers.isEmptyString(dir)) {
            let parentDir = Enumerable.from(
                dir.split('/')
            ).skipLast()
             .joinToString('/');

            QUICK_PICK_ITEMS.unshift({
                label: '..',
                description: '',
                detail: ME.t('listDirectory.parentDirectory'),

                action: async () => {
                    LIST_DIRECTORY(
                        parentDir
                    );
                }
            });
        }

        if (QUICK_PICK_ITEMS.length < 1) {
            QUICK_PICK_ITEMS.push({
                label: ME.t('listDirectory.directoryIsEmpty'),
                description: '',
            });
        }

        // functions
        {
            if (deploy_helpers.isObject(selfInfo)) {
                let exportPath = deploy_helpers.toStringSafe(selfInfo.exportPath);
                if (deploy_helpers.isEmptyString(exportPath)) {
                    exportPath = dir;
                }

                if (!deploy_helpers.isEmptyString(exportPath)) {
                    // copy path to clipboard
                    QUICK_PICK_ITEMS.push({
                        action: async () => {
                            try {
                                await Promise.resolve(
                                    CopyPaste.copy(exportPath)
                                );
                            }
                            catch (e) {
                                deploy_log.CONSOLE
                                          .trace(e, 'list.listDirectory(1)');

                                ME.showWarningMessage(
                                    ME.t('listDirectory.copyPathToClipboard.errors.failed',
                                         exportPath)
                                );
                            }
                        },

                        label: '$(clippy)  ' + ME.t('listDirectory.copyPathToClipboard.label'),
                        description: ME.t('listDirectory.copyPathToClipboard.description'),
                    });
                }
            }
        }

        let placeHolder = dir.trim();
        if (!placeHolder.startsWith('/')) {
            placeHolder = '/' + placeHolder;
        }

        const SELECTED_ITEM = await vscode.window.showQuickPick(QUICK_PICK_ITEMS, {
            placeHolder: ME.t('listDirectory.currentDirectory',
                              placeHolder, TARGET_NAME),
        });
        if (SELECTED_ITEM) {
            if (SELECTED_ITEM.action) {
                await Promise.resolve(
                    SELECTED_ITEM.action()
                );
            }
        }
    }
    catch (e) {
        wholeOperationHasFailed = true;

        if (fromCache) {
            // reset and retry

            delete LAST_DIR_CACHE[TARGET_CACHE_KEY];

            await listDirectory.apply(this, arguments);
        }
        else {
            throw e;
        }
    }
    finally {
        if (!wholeOperationHasFailed) {
            // cache
            LAST_DIR_CACHE[TARGET_CACHE_KEY] = dir;
        }
    }
}
