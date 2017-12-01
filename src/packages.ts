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
import * as deploy_targets from './targets';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as Path from 'path';


export type AutoDeploySettings = boolean | string | string[] | deploy_contracts.FileFilter;

/**
 * A package.
 */
export interface Package extends deploy_contracts.FileFilter, deploy_targets.TargetProvider, deploy_workspaces.WorkspaceItemFromSettings {
    /**
     * Settings for 'deploy on change' feature.
     */
    readonly deployOnChange?: AutoDeploySettings;
    /**
     * Settings for 'deploy on save' feature.
     */
    readonly deployOnSave?: AutoDeploySettings;
    /**
     * A description.
     */
    readonly description?: string;
    /**
     * The (display) name.
     */
    readonly name?: string;
    /**
     * Deletes a file of this package, if it has been deleted from a workspace.
     */
    readonly removeOnChange?: AutoDeploySettings;
}


/**
 * Handles an "auto deploy" of a file.
 * 
 * @param {string} file The file to check. 
 * @param {Function} settingsResolver The settings resolver.
 * @param {string} errorMsgTemplate The template for an error message.
 */
export async function autoDeployFile(file: string,
                                     settingsResolver: (pkg: Package) => AutoDeploySettings | PromiseLike<AutoDeploySettings>,
                                     errorMsgTemplate: string) {
    const ME: deploy_workspaces.Workspace = this;

    try {
        let relativePath = ME.toRelativePath(file);
        if (false === relativePath) {
            return;
        }

        file = Path.resolve(file);

        const KNOWN_TARGETS = ME.getTargets();

        const TARGETS: deploy_targets.Target[] = [];
        for (let pkg of ME.getPackages()) {
            let autoSettings: AutoDeploySettings;
            if (settingsResolver) {
                autoSettings = await Promise.resolve(
                    settingsResolver(pkg)
                );
            }
            
            if (deploy_helpers.isNullOrUndefined(autoSettings)) {
                continue;
            }

            let filter: deploy_contracts.FileFilter;
            let targetNames: string | string[] | false = false;
            let useMinimatch = false;

            if (deploy_helpers.isObject<deploy_contracts.FileFilter>(autoSettings)) {
                filter = autoSettings;
                targetNames = pkg.targets;
                useMinimatch = true;
            }
            else if (deploy_helpers.isBool(autoSettings)) {
                if (true === autoSettings) {
                    filter = pkg;
                    targetNames = pkg.targets;
                }
            }
            else {
                filter = pkg;
                targetNames = autoSettings;
            }

            if (false === targetNames) {
                continue;
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
                    await ME.deployFileTo(file, t);
                }
                catch (e) {
                    deploy_helpers.showErrorMessage(
                        deploy_helpers.format(
                            errorMsgTemplate,
                            file, TARGET_NAME, e,
                        )
                    );
                }
            });
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'packages.autoDeployFile()');
    }
}


/**
 * Returns the name for a package.
 * 
 * @param {Package} pkg The package.
 * 
 * @return {string} The name. 
 */
export function getPackageName(pkg: Package): string {
    if (!pkg) {
        return;
    }

    const TRANSLATOR: deploy_contracts.Translator = pkg.__workspace;

    if (!pkg) {
        return;
    }

    let name = deploy_helpers.toStringSafe(pkg.name).trim();
    if ('' === name) {
        name = TRANSLATOR.t('packages.defaultName', pkg.__index + 1);
    }

    return name;
}
