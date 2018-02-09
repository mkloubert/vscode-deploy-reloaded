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

import * as deploy_helpers from '../../helpers';
import * as deploy_targets from '../../targets';
import * as FSExtra from 'fs-extra';
import * as Path from 'path';


/**
 * An operation that cleansup a directory
 */
export interface CleanupTargetOperation extends deploy_targets.TargetOperation {
    /**
     * The directory to cleanup.
     */
    readonly dir: string;
    /**
     * One or more patterns of files to exclude.
     */
    readonly exclude?: string | string[];
    /**
     * One or more patterns of files to include.
     */
    readonly include?: string | string[];
    /**
     * Cleanup recursively or not.
     */
    readonly recursive?: boolean;
}


/** @inheritdoc */
export async function execute(context: deploy_targets.TargetOperationExecutionContext<CleanupTargetOperation>) {
    const OPERATION = context.operation;
    const WORKSPACE = context.target.__workspace;

    const INCLUDE = deploy_helpers.asArray(OPERATION.include).map(i => {
        return deploy_helpers.toStringSafe(i);
    }).filter(i => {
        return '' !== i.trim();
    });
    if (INCLUDE.length < 1) {
        INCLUDE.push('**');
    }

    const EXCLUDE = deploy_helpers.asArray(OPERATION.exclude).map(e => {
        return deploy_helpers.toStringSafe(e);
    }).filter(e => {
        return '' !== e.trim();
    });

    let dirToCleanup = deploy_helpers.toStringSafe(
        WORKSPACE.replaceWithValues(OPERATION.dir)
    );
    if (!Path.isAbsolute(dirToCleanup)) {
        dirToCleanup = Path.join(WORKSPACE.rootPath, dirToCleanup);
    }
    dirToCleanup = Path.resolve(dirToCleanup);

    const RECURSIVE = deploy_helpers.toBooleanSafe(OPERATION.recursive, true);

    const TO_MINIMATCH = (s: any): string => {
        s = deploy_helpers.toStringSafe(s);
        s = deploy_helpers.replaceAllStrings(s, Path.sep, '/');

        if (!s.trim().startsWith('/')) {
            s = '/' + s;
        }

        return s;
    };

    const CLEANUP_DIR = async (d: string, subDir?: string) => {
        if (!deploy_helpers.isEmptyString(subDir)) {
            d = Path.join(d, subDir);
        }
        d = Path.resolve(d);

        if (!d.startsWith(dirToCleanup)) {
            return;
        }

        for (const SD of (await deploy_helpers.readDir(d))) {
            const FULL_PATH = Path.resolve(
                Path.join(d, SD)
            );
            
            const RELATIVE_PATH = FULL_PATH.substr(dirToCleanup.length);

            const DOES_MATCH = deploy_helpers.checkIfDoesMatchByFileFilter(
                TO_MINIMATCH(RELATIVE_PATH),
                deploy_helpers.toMinimatchFileFilter({
                    files: INCLUDE,
                    exclude: EXCLUDE,
                }),
            );
            if (!DOES_MATCH) {
                continue;
            }

            let deleteItem = false;

            const STATS = await deploy_helpers.lstat(FULL_PATH);
            if (STATS.isDirectory()) {
                if (RECURSIVE) {
                    await CLEANUP_DIR(d, SD);

                    deleteItem = (await deploy_helpers.readDir(FULL_PATH)).length < 1;
                }
            }
            else {
                deleteItem = true;
            }

            if (deleteItem) {
                await FSExtra.remove(FULL_PATH);
            }
        }
    };

    await CLEANUP_DIR(dirToCleanup);
}
