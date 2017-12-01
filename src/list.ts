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

    const TARGET_NAME = deploy_targets.getTargetName(target);

    dir = deploy_helpers.toStringSafe(dir);

    const PLUGINS = ME.context.plugins.filter(pi => {
        const TARGET_TYPE = deploy_helpers.normalizeString(target.type);

        return '' === pi.__type || 
               (TARGET_TYPE === pi.__type && pi.canList && pi.listDirectory);
    });

    if (PLUGINS.length < 1) {
        //TODO: translate
        await deploy_helpers.showWarningMessage(
            `No matching PLUGINS found!`
        );

        return;
    }

    const FILES_AND_FILES: deploy_files.FileSystemInfo[] = [];

    while (PLUGINS.length > 0) {
        const PI = PLUGINS.shift();

        const ITEMS = await PI.listDirectory({
            dir: dir,
            target: target,
            workspace: ME,
        });

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

            FILES_AND_FILES.push
                           .apply(FILES_AND_FILES, LOADED_ITEMS);
        }
    }

    const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = [];

    const LIST_DIRECTORY = async (d: string) => {
        await listDirectory.apply(
            ME,
            [ target, d ]
        );
    };

    FILES_AND_FILES.sort((x, y) => {
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

        // then by name
        return deploy_helpers.compareValuesBy(x, y, (f) => {
            return deploy_helpers.normalizeString(f.name);
        });
    }).forEach(f => {
        let label = deploy_helpers.toStringSafe(f.name).trim();
        if ('' === label) {
            label = '<NO NAME>';  //TODO: translate
        }

        const DETAIL_ITEMS: string[] = [];

        let action: () => any;
        if (deploy_files.FileSystemType.Directory == f.type) {
            // directory

            label = '$(file-directory)  ' + label;

            action = async () => {
                LIST_DIRECTORY(
                    dir + '/' + f.name
                );
            };
        }
        else if (deploy_files.FileSystemType.File == f.type) {
            // file

            label = '$(file-binary)  ' + label;
            
            action = createSelectFileAction(
                <deploy_files.FileInfo>f
            );
        }
        else {
            label = '$(question)  ' + label;
        }

        if (deploy_files.FileSystemType.Directory != f.type) {
            if (!isNaN(f.size)) {
                //TODO: translate

                DETAIL_ITEMS.push(
                    `Size: ${FileSize(f.size, {round: 2})}`
                );
            }
        }

        if (f.time && f.time.isValid()) {
            //TODO: translate

            DETAIL_ITEMS.push(
                `Last modified: ${f.time.format('YYYY-MM-DD HH:mm:ss')}`
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
            detail: '(parent)',  //TODO: translate

            action: async () => {
                LIST_DIRECTORY(
                    parentDir
                );
            }
        });
    }

    if (QUICK_PICK_ITEMS.length < 1) {
        //TODO: translate
        QUICK_PICK_ITEMS.push({
            label: '(the directory is empty)',
            description: '',
        });
    }

    let placeHolder = dir.trim();
    if (!placeHolder.startsWith('/')) {
        placeHolder = '/' + placeHolder;
    }

    //TODO: translate
    const SELECTED_ITEM = await vscode.window.showQuickPick(QUICK_PICK_ITEMS, {
        placeHolder: `Current directory: '${placeHolder}' (${TARGET_NAME})`,
    });
    if (SELECTED_ITEM) {
        if (SELECTED_ITEM.action) {
            await Promise.resolve(
                SELECTED_ITEM.action()
            );
        }
    }
}
