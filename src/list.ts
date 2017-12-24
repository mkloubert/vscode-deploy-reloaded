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
import * as deploy_files from './files';
import * as deploy_helpers from './helpers';
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

    const TARGET_NAME = deploy_targets.getTargetName(target);

    dir = deploy_helpers.toStringSafe(dir);

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
