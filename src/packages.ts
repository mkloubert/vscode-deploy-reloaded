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
import * as Moment from 'moment';
import * as Path from 'path';
import * as UUID from 'uuid';
import * as vscode from 'vscode';


/**
 * A package.
 */
export interface Package extends deploy_contracts.ConditionalItem,
                                 deploy_contracts.FileFilter,
                                 deploy_contracts.WithOptionalName,
                                 deploy_targets.TargetProvider,
                                 deploy_workspaces.WorkspaceItemFromSettings {
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * The optional status bar button.
     */
    readonly __button: vscode.StatusBarItem;

    /**
     * Deines a package button for the status bar.
     */
    readonly button?: PackageButton | boolean;
    /**
     * Settings for 'deploy on change' feature.
     */
    readonly deployOnChange?: PackageDeploySettings;
    /**
     * Settings for 'deploy on save' feature.
     */
    readonly deployOnSave?: PackageDeploySettings;
    /**
     * A description.
     */
    readonly description?: string;
    /**
     * Deletes a file of this package, if it has been deleted from a workspace.
     */
    readonly removeOnChange?: PackageDeploySettings;
    /**
     * Activates or deactivates "sync when open" feature for that package.
     */
    readonly syncWhenOpen?: boolean | string | SyncWhenOpenSetting;
}

/**
 * A package button.
 */
export interface PackageButton extends deploy_contracts.ButtonWithCustomCommand {
}

/**
 * Types of a package deploy setting value.
 */
export type PackageDeploySettings = boolean | string | string[] | deploy_contracts.FileFilter;

/**
 * A function that resolves deploy settings for a package.
 * 
 * @param {Package} pkg The underlying package.
 * 
 * @return {PackageDeploySettings} The result with the settings.
 */
export type PackageDeploySettingsResolver = (pkg: Package) => PackageDeploySettings;

/**
 * Stores settings for 'sync when open' feature.
 */
export interface SyncWhenOpenSetting extends deploy_contracts.FileFilter {
}


/**
 * Handles an "auto deploy" of a file.
 * 
 * @param {string} file The file to check. 
 * @param {PackageDeploySettingsResolver} settingsResolver The settings resolver.
 * @param {string} errorMsgTemplate The template for an error message.
 */
export async function autoDeployFile(file: string,
                                     settingsResolver: PackageDeploySettingsResolver,
                                     errorMsgTemplate: string) {
    const ME: deploy_workspaces.Workspace = this;

    try {
        const TARGETS = await findTargetsForFileOfPackage(file,
                                                          settingsResolver);

        if (false === TARGETS) {
            return;
        }

        for (const T of Enumerable.from(TARGETS).distinct(true)) {
            const TARGET_NAME = deploy_targets.getTargetName(T);

            try {
                await ME.deployFileTo(file, T);
            }
            catch (e) {
                ME.showErrorMessage(
                    deploy_helpers.format(
                        errorMsgTemplate,
                        file, TARGET_NAME, e,
                    )
                );
            }
        }
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'packages.autoDeployFile()');
    }
}

/**
 * Finds targets for a file of a package.
 * 
 * @param {string} file The path to the file.
 * @param {PackageDeploySettingsResolver} settingsResolver The resolver for the settings.
 * 
 * @return {Promise<deploy_targets.Target[]>|false} The List of targets or (false) if at least one target name could not be resolved.
 */
export async function findTargetsForFileOfPackage(
    file: string,
    settingsResolver: PackageDeploySettingsResolver
): Promise<deploy_targets.Target[] | false> {
    const ME: deploy_workspaces.Workspace = this;
    
    file = deploy_helpers.toStringSafe(file);
    file = Path.resolve(file);
    
    if (ME.isFileIgnored(file)) {
        return false;
    }

    const KNOWN_TARGETS = ME.getTargets();

    const TARGETS: deploy_targets.Target[] = [];
    for (let pkg of ME.getPackages()) {
        let settings: PackageDeploySettings;
        if (settingsResolver) {
            settings = await Promise.resolve(
                settingsResolver(pkg)
            );
        }

        if (deploy_helpers.isNullOrUndefined(settings)) {
            continue;
        }

        let filter: deploy_contracts.FileFilter;
        let targetNames: string | string[] | false = false;
        let useMinimatch = false;

        if (deploy_helpers.isObject<deploy_contracts.FileFilter>(settings)) {
            filter = settings;
            targetNames = pkg.targets;
        }
        else if (deploy_helpers.isBool(settings)) {
            if (true === settings) {
                filter = pkg;
                targetNames = pkg.targets;
                useMinimatch = true;
            }
        }
        else {
            filter = pkg;
            targetNames = settings;
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
            return false;
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
    }

    return TARGETS;
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

/**
 * Returns the targets of a package.
 * 
 * @param {pkg: Package} pkg The package.
 * 
 * @return {deploy_targets.Target[] | false} The targets or (false) if at least one target could not be found.
 */
export function getTargetsOfPackage(pkg: Package): deploy_targets.Target[] | false {
    const ME: deploy_workspaces.Workspace = this;

    if (!pkg) {
        return;
    }

    let targets = ME.getTargetsOfPackage(pkg);

    if (false !== targets) {
        if (targets.length < 1) {
            targets = ME.getTargets();
        }
        else if (targets.length > 1) {
            const ID = `${pkg.__id}\n` + 
                       `${UUID.v4()}\n` + 
                       `${Moment.utc().unix()}`;

            //TODO: translate
            const BATCH_TARGET = {
                __id: ID,
                __index: -1,
                __searchValue: deploy_helpers.normalizeString(ID),
                __workspace: ME,

                name: `Virtual target for package '${getPackageName(pkg)}'`,
                type: 'batch',
                targets: targets.map(t => t.name),
            };
            
            targets = [ BATCH_TARGET ];
        }
    }

    return targets;
}
