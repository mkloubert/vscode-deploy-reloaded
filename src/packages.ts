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
import * as Crypto from 'crypto';
import * as deploy_contracts from './contracts';
import * as deploy_git from './git';
import * as deploy_gui from './gui';
import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as deploy_scm from './scm';
import * as deploy_targets from './targets';
import * as deploy_values from './values';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as i18 from './i18';
import * as Moment from 'moment';
import * as Path from 'path';
import * as UUID from 'uuid';
import * as vscode from 'vscode';


/**
 * A package.
 */
export interface Package extends deploy_values.Applyable,
                                 deploy_contracts.ConditionalItem,
                                 deploy_contracts.FileFilter,
                                 deploy_contracts.PlatformItem,
                                 deploy_contracts.WithOptionalName,
                                 deploy_targets.TargetProvider,
                                 WithFastFileCheckSettings, 
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
    readonly button?: PackageButton | boolean | string;
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
     * Settings for importing files via git.
     */
    readonly git?: PackageDeploySettingValue;
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
export interface PackageButton extends deploy_contracts.ButtonWithCustomCommand, deploy_targets.TargetProvider {
    /**
     * Ask before start deploy operation or not.
     */
    readonly showPrompt?: boolean;
    /**
     * The type of deploy operation.
     */
    readonly type?: string;
}

/**
 * A file filter for package deploy settings.
 */
export interface PackageDeployFileFilter extends deploy_contracts.FileFilter,
                                                 deploy_targets.TargetProvider {
}

/**
 * Types of a package deploy setting value.
 */
export type PackageDeploySettings = boolean | string | string[] | PackageDeployFileFilter;

/**
 * A function that resolves the package flag, which indicates, if a "fast file check"
 * should be made or not.
 * 
 * @param {Package} pkg The underlying package.
 * 
 * @return {boolean|PromiseLike<boolean>} The result with the flag.
 */
export type PackageFastFileCheckFlagResolver = (pkg: Package) => boolean | PromiseLike<boolean>;

/**
 * A function that resolves deploy settings for a package.
 * 
 * @param {Package} pkg The underlying package.
 * 
 * @return {PackageDeploySettings} The result with the settings.
 */
export type PackageDeploySettingsResolver = (pkg: Package) => PackageDeploySettings;

type PackageFileListResolver = (filter: deploy_contracts.FileFilter, file: string) => PackageFileListResolverResult |
                                                                                      PromiseLike<PackageFileListResolverResult>;

/**
 * Possible results of a package file list resolver.
 */
export type PackageFileListResolverResult = string | string[];

/**
 * git settings for a package.
 */
export interface PackageGitSettings extends deploy_contracts.FileFilter {
    /**
     * The custom branch.
     */
    readonly branch?: string;
    /**
     * The first (youngest) commit.
     */
    readonly from?: string;
    /**
     * Only use files from git or not.
     */
    readonly gitFilesOnly?: boolean;
    /**
     * The first (oldest) commit.
     */
    readonly to?: string;
}

/**
 * Possible git setting values for a package.
 */
export type PackageDeploySettingValue = string | PackageGitSettings;

/**
 * Stores settings for 'sync when open' feature.
 */
export interface SyncWhenOpenSetting extends deploy_contracts.FileFilter {
}

/**
 * Object that contains settings for "fast file checks".
 */
export interface WithFastFileCheckSettings {
    /**
     * Indicates if 'fast file check' should be used for 'deploy on change' in that package. 
     */
    readonly fastCheckOnChange?: boolean;
    /**
     * Indicates if 'fast file check' should be used for 'deploy on save' in that package. 
     */
    readonly fastCheckOnSave?: boolean;
    /**
     * Indicates if 'fast file check' should be used for 'sync when open' in that package. 
     */
    readonly fastCheckOnSync?: boolean;
    /**
     * Default value for other, not-set "fast file check" settings. 
     */
    readonly fastFileCheck?: boolean;
}

const AUTO_DEPLOY_STATES: deploy_contracts.KeyValuePairs<deploy_targets.Target> = {};
const KEY_PACKAGE_USAGE = 'vscdrLastExecutedPackageActions';

/**
 * Handles an "auto deploy" of a file.
 * 
 * @param {string} file The file to check. 
 * @param {PackageDeploySettingsResolver} settingsResolver The settings resolver.
 * @param {PackageFastFileCheckFlagResolver} fastFileCheckFlagResolver A custom "fast file check" resolver.
 * @param {string} errorMsgTemplate The template for an error message.
 */
export async function autoDeployFile(file: string,
                                     settingsResolver: PackageDeploySettingsResolver,
                                     fastFileCheckFlagResolver: PackageFastFileCheckFlagResolver,
                                     errorMsgTemplate: string) {
    const ME: deploy_workspaces.Workspace = this;

    try {
        const TARGETS = await deploy_helpers.applyFuncFor(
            findTargetsForFileOfPackage, ME
        )(file,
          settingsResolver,
          fastFileCheckFlagResolver);
        if (false === TARGETS) {
            return;
        }

        for (const T of Enumerable.from(TARGETS).distinct(true)) {
            await invokeForAutoTargetOperation(T, async (target) => {
                const TARGET_NAME = deploy_targets.getTargetName(target);
                
                try {
                    await ME.deployFileTo(file, target);
                }
                catch (e) {
                    ME.showErrorMessage(
                        ME.t(errorMsgTemplate,
                             file, TARGET_NAME, e)
                    );
                }
            });
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
 * @param {PackageFastFileCheckFlagResolver} fastFileCheckFlagResolver A custom "fast file check" resolver.
 * 
 * @return {Promise<deploy_targets.Target[]>|false} The List of targets or (false) if at least one target name could not be resolved.
 */
export async function findTargetsForFileOfPackage(
    file: string,
    settingsResolver: PackageDeploySettingsResolver,
    fastFileCheckFlagResolver: PackageFastFileCheckFlagResolver,
): Promise<deploy_targets.Target[] | false>
{
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

        if (deploy_helpers.isObject<PackageDeployFileFilter>(settings)) {
            filter = settings;

            targetNames = deploy_helpers.asArray(settings.targets);
            if (targetNames.length < 1) {
                // nothing defined => take from package
                targetNames = deploy_helpers.asArray(pkg.targets);
            }
        }
        else if (deploy_helpers.isBool(settings)) {
            if (true === settings) {
                filter = pkg;
                targetNames = pkg.targets;
            }
        }
        else {
            filter = pkg;
            targetNames = settings;
        }

        if (false === targetNames) {
            continue;
        }

        if (deploy_helpers.isNullOrUndefined(filter)) {
            filter = {};
        }
        if (deploy_helpers.isNullOrUndefined(filter.files)) {
            (<any>filter).files = [ '**' ];
        }

        const MATCHING_TARGETS = deploy_targets.getTargetsByName(
            targetNames,
            KNOWN_TARGETS
        );
        if (false === MATCHING_TARGETS) {
            return false;
        }

        const FAST_FILE_CHECK = deploy_helpers.toBooleanSafe(
            await Promise.resolve(
                fastFileCheckFlagResolver(pkg)
            )
        );

        let fileListResolver: PackageFileListResolver;
        if (FAST_FILE_CHECK) {
            fileListResolver = () => {
                const FILE_LIST: string[] = [];
                const REL_PATH = ME.toRelativePath(file);
                if (false !== REL_PATH) {
                    const DOES_MATCH = deploy_helpers.checkIfDoesMatchByFileFilter('/' + REL_PATH,
                                                                                   deploy_helpers.toMinimatchFileFilter(filter));
                    if (DOES_MATCH) {
                        FILE_LIST.push(file);
                    }
                }

                return FILE_LIST;
            };
        }
        else {
            fileListResolver = async () => {
                let fileList = await ME.findFilesByFilter(pkg);
                if (filter !== pkg) {
                    fileList = fileList.filter(f => {
                        const REL_PATH = ME.toRelativePath(f);
                        if (false !== REL_PATH) {
                            return deploy_helpers.checkIfDoesMatchByFileFilter('/' + REL_PATH,
                                                                               deploy_helpers.toMinimatchFileFilter(filter));
                        }

                        return false;
                    });
                }

                return fileList;
            };
        }

        const FILE_LIST = deploy_helpers.asArray(
            await Promise.resolve(
                fileListResolver(filter, file)
            )
        );

        if (FILE_LIST.indexOf(file) > -1) {
            TARGETS.push
                   .apply(TARGETS, MATCHING_TARGETS);
        }
    }

    return TARGETS;
}

/**
 * Returns a sorted list of all available packages of all opened workspaces.
 * 
 * @return {Package[]} The list of all sorted packages.
 */
export function getAllPackagesSorted() {
    return deploy_helpers.from( deploy_workspaces.getAllWorkspaces() ).orderBy(ws => {
        return ws.isActive ? 0 : 1;
    }).selectMany(ws => {
        return Enumerable.from( ws.getPackages() ).orderBy(pkg => {
            return deploy_helpers.normalizeString(
                getPackageName(pkg)
            );
        }).thenBy(pkg => {
            return pkg.__index;
        });
    }).toArray();
}

/**
 * Detects a "fast file check" flag value.
 * 
 * @param {TObj} obj The child object.
 * @param {Function} flagResolver The function that detects the flag value from the child object.
 * @param {TParentObj} parentObj The parent object.
 * @param {Function} parentFlagResolver The function that detects the flag value from the parent object.
 * 
 * @return {boolean} The detected flag.
 */
export function getFastFileCheckFlag<TObj extends WithFastFileCheckSettings = WithFastFileCheckSettings,
                                     TParentObj extends WithFastFileCheckSettings = WithFastFileCheckSettings>
(
    obj: TObj, flagResolver: (o: TObj) => boolean,
    parentObj: TParentObj, parentFlagResolver: (po: TParentObj) => boolean 
)
{
    if (!obj) {
        obj = <any>{};
    }

    if (!flagResolver) {
        flagResolver = () => undefined;
    }

    if (!parentObj) {
        parentObj = <any>{};
    }

    if (!parentFlagResolver) {
        parentFlagResolver = () => undefined;
    }

    const FAST_FILE_CHECK = deploy_helpers.toBooleanSafe(
        flagResolver(obj),
        deploy_helpers.toBooleanSafe(obj.fastFileCheck),
    );

    const PARENT_FAST_FILE_CHECK = deploy_helpers.toBooleanSafe(
        parentFlagResolver(parentObj),
        deploy_helpers.toBooleanSafe(parentObj.fastFileCheck),
    );

    return deploy_helpers.toBooleanSafe(FAST_FILE_CHECK,
                                        PARENT_FAST_FILE_CHECK);
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
 * @param {deploy_targets.TargetResolver} targetResolver A function to receive optional targets.
 * 
 * @return {deploy_targets.Target[] | false} The targets or (false) if at least one target could not be found.
 */
export function getTargetsOfPackage(pkg: Package, targetResolver: deploy_targets.TargetResolver): deploy_targets.Target[] | false {
    const ME: deploy_workspaces.Workspace = this;

    if (!pkg) {
        return;
    }

    let targets = ME.getTargetsOfPackage(pkg, targetResolver);

    if (false !== targets) {
        if (targets.length < 1) {
            targets = ME.getTargets();
        }
        else if (targets.length > 1) {
            const ID = `${pkg.__id}\n` + 
                       `${UUID.v4()}\n` + 
                       `${Moment.utc().unix()}`;

            const BATCH_TARGET = {
                __cache: new deploy_helpers.MemoryCache(),
                __id: ID,
                __index: -1,
                __searchValue: deploy_helpers.normalizeString(ID),
                __workspace: ME,

                name: ME.t('packages.virtualTarget',
                           getPackageName(pkg)),
                type: 'batch',
                targets: targets.map(t => t.name),
            };
            
            targets = [ BATCH_TARGET ];
        }
    }

    return targets;
}

async function invokeForAutoTargetOperation(target: deploy_targets.Target, action: (t: deploy_targets.Target) => any) {
    if (!target) {
        return;
    }

    await waitForOtherAutoTargetOperations(target);

    try {
        AUTO_DEPLOY_STATES[ target.__id ] = target;

        if (action) {
            await Promise.resolve(
                action(target)
            );
        }
    }
    finally {
        delete AUTO_DEPLOY_STATES[ target.__id ];
    }
}

/**
 * Import files from git to a package.
 * 
 * @param {Package} pkg The package.
 * @param {deploy_contracts.DeployOperation} operation The operation.
 * @param {string[]} files The file storage.
 * 
 * @return {Promise<string[]>} The promise with the new list.
 */
export async function importPackageFilesFromGit(pkg: Package, operation: deploy_contracts.DeployOperation, files: string[]): Promise<string[]> {
    if (!files) {
        files = [];
    }
    
    if (!pkg) {
        return;
    }

    if (deploy_helpers.isNullOrUndefined(pkg.git)) {
        return;
    }

    let gitSettings = pkg.git;
    if (!deploy_helpers.isObject<PackageGitSettings>(gitSettings)) {
        gitSettings = deploy_helpers.normalizeString(gitSettings);

        let branch: string;
        let from: string;
        let to: string;

        const PARTS = gitSettings.split(':');
        if (PARTS.length > 2) {
            // [BRANCH]:[FROM]:[TO]

            branch = PARTS[0];
            from = PARTS[1];
            to = Enumerable.from(PARTS).skip(2)
                                       .joinToString(':');
        }
        else if (PARTS.length > 1) {
            // [BRANCH]:[FROM] --or--
            // [FROM]:[TO]

            if (deploy_helpers.isHex(PARTS[0])) {
                from = PARTS[0];
                to = PARTS[1];
            }
            else {
                branch = PARTS[0];
                from = PARTS[1];
            }
        }
        else {
            // [BRANCH] --or--
            // [FROM]

            if (deploy_helpers.isHex(PARTS[0])) {
                from = PARTS[0];
            }
            else {
                branch = PARTS[0];
            }
        }

        if (deploy_helpers.isEmptyString(branch)) {
            branch = undefined;
        }
        if (deploy_helpers.isEmptyString(from)) {
            from = undefined;
        }
        if (deploy_helpers.isEmptyString(to)) {
            to = undefined;
        }
        
        gitSettings = {
            branch: branch,
            from: from,
            to: to,
        };
    }

    if (deploy_helpers.toBooleanSafe(gitSettings.gitFilesOnly, true)) {
        while (files.length > 0) {
            files.pop();
        }
    }

    const WORKSPACE = pkg.__workspace;

    const NORMALIZED_INPUT_FILES = deploy_helpers.asArray(files).map(f => {
        return deploy_helpers.toStringSafe(f);
    }).filter(f => {
        return !deploy_helpers.isEmptyString(f);
    }).map(f => {
        if (!Path.isAbsolute(f)) {
            f = Path.join(WORKSPACE.rootPath, f);
        }

        return Path.resolve(f);
    });

    const CLIENT = await WORKSPACE.createGitClient();
    if (false === CLIENT) {
        throw new Error(
            WORKSPACE.t('workspaces.errors.cannotDetectGitClient',
                        WORKSPACE.name)
        );
    }

    let rootFolderForGitFiles = WORKSPACE.gitFolder;
    if (false === rootFolderForGitFiles) {
        throw new Error(
            WORKSPACE.t('workspaces.errors.cannotDetectGitFolder',
                        WORKSPACE.name)
        );
    }

    rootFolderForGitFiles = Path.resolve(
        Path.join(
            rootFolderForGitFiles,
            '..' 
        )
    );

    let branchName = deploy_helpers.normalizeString(gitSettings.branch);
    if ('' === branchName) {
        branchName = 'master';
    }

    const FROM_HASH = deploy_git.normalizeGitHash(gitSettings.from);
    const TO_HASH = deploy_git.normalizeGitHash(gitSettings.to);

    const BRANCH = Enumerable.from(
        await CLIENT.branches()
    ).singleOrDefault(b => {
        return branchName === deploy_helpers.normalizeString(b.id);
    });

    if (deploy_helpers.isSymbol(BRANCH)) {
        throw new Error(
            WORKSPACE.t('workspaces.errors.cannotFindBranch',
                        branchName, WORKSPACE.name)
        );
    }

    const FIND_COMMIT = async (hash: string): Promise<deploy_scm.Commit | false> => {
        hash = deploy_git.normalizeGitHash(hash);

        // take first hash
        let page = 0;
        do
        {
            ++page;
            const COMMITS = await (<deploy_scm.Branch>BRANCH).commits(page);
            if (COMMITS.length < 1) {
                break;
            }

            for (const C of COMMITS) {
                if (hash === deploy_git.normalizeGitHash(C.id)) {
                    return C;  // found
                }
            }
        }
        while (true);

        return false;
    };

    let firstCommit: deploy_scm.Commit | false = false;
    if (null === FROM_HASH) {
        // latest
        const COMMITS = await (<deploy_scm.Branch>BRANCH).commits();
        if (COMMITS.length > 0) {
            firstCommit = COMMITS[0];
        }
    }
    else {
        firstCommit = await FIND_COMMIT(FROM_HASH);
    }

    if (!firstCommit) {
        throw new Error(
            WORKSPACE.t('workspaces.errors.cannotFindScmHash',
                        FROM_HASH, WORKSPACE.name)
        );
    }

    let lastCommit: deploy_scm.Commit | false = firstCommit;
    if (null !== TO_HASH) {
        lastCommit = await FIND_COMMIT(TO_HASH);
    }

    if (!lastCommit) {
        throw new Error(
            WORKSPACE.t('workspaces.errors.cannotFindScmHash',
                        TO_HASH, WORKSPACE.name)
        );
    }

    // load all commits between first and last commit
    let commitWindow: deploy_scm.Commit[] = [];
    {
        // find and add first commit
        let page = 0;
        let run = true;
        do
        {
            ++page;
            const COMMITS = await (<deploy_scm.Branch>BRANCH).commits(page);
            if (COMMITS.length < 1) {
                break;
            }

            for (const C of COMMITS) {
                if (deploy_git.normalizeGitHash(firstCommit.id) === deploy_git.normalizeGitHash(C.id)) {
                    commitWindow.push(C);

                    run = false;
                    break;
                }
            }
        }
        while (run);

        // add all after first and until last commit
        if (commitWindow.length > 0) {
            if (lastCommit.id !== firstCommit.id) {
                let page = 0;
                let run = true;
                let startAdd = false;
                do
                {
                    ++page;
                    const COMMITS = await (<deploy_scm.Branch>BRANCH).commits(page);
                    if (COMMITS.length < 1) {
                        break;
                    }

                    for (const C of COMMITS) {
                        if (startAdd) {
                            commitWindow.push(C);
                        }

                        if (deploy_git.normalizeGitHash(lastCommit.id) === deploy_git.normalizeGitHash(C.id)) {
                            run = false;  // last commit
                            break;
                        }
                        else if (deploy_git.normalizeGitHash(firstCommit.id) === deploy_git.normalizeGitHash(C.id)) {
                            startAdd = true;  // now start adding commits between first and last
                        }
                    }
                }
                while (run);
            }
        }
    }

    // sort ascending
    commitWindow = commitWindow.sort((x, y) => {
        return deploy_helpers.compareValuesBy(x, y, c => {
            const UTC_DATE = deploy_helpers.asUTC(c.date);
            if (UTC_DATE) {
                return UTC_DATE.unix();
            }

            return Number.MIN_VALUE;
        });
    });

    let filesFromGit: string[] = [];
    const ADD_FILE = (f: string) => {
        if (filesFromGit.indexOf(f) < 0) {
            filesFromGit.push(f);
        }
    };
    const REMOVE_FILE = (f: string) => {
        filesFromGit = filesFromGit.filter(ffg => {
            return ffg !== f;
        });
    };

    const TO_MINIMATCH = (str: string) => {
        str = deploy_helpers.toStringSafe(str);
        if (!str.startsWith('/')) {
            str = '/' + str;
        }

        return str;
    };

    const TO_MINIMATCH_PATTERNS = (patterns: string | string[]) => {
        return deploy_helpers.asArray(
            patterns
        ).map(p => {
            return deploy_helpers.toStringSafe(p);
        }).filter(p => {
            return !deploy_helpers.isEmptyString(p);
        }).map(p => TO_MINIMATCH(p));
    };

    const DOES_FILE_MATCH = (f: string): boolean => {
        const REL_PATH = WORKSPACE.toRelativePath(f);
        if (false === REL_PATH) {
            return false;
        }

        const FILE_FILTER: deploy_contracts.FileFilter = deploy_helpers.cloneObject(<PackageGitSettings>gitSettings) || <any>{};
        
        if (deploy_helpers.isNullOrUndefined(FILE_FILTER.files)) {
            (<any>FILE_FILTER).files = pkg.files;
        }

        if (deploy_helpers.isNullOrUndefined(FILE_FILTER.exclude)) {
            (<any>FILE_FILTER).exclude = pkg.exclude;
        }

        let filePatterns = TO_MINIMATCH_PATTERNS(FILE_FILTER.files);
        if (filePatterns.length < 1) {
            filePatterns = [ '/**' ];
        }

        let exludePatterns = TO_MINIMATCH_PATTERNS(FILE_FILTER.exclude);
        if (exludePatterns.length < 1) {
            exludePatterns = undefined;
        }

        return deploy_helpers.checkIfDoesMatchByFileFilter(
            TO_MINIMATCH(REL_PATH),
            {
                files: filePatterns,
                exclude: exludePatterns,
            }
        );
    };

    // collect files
    for (const C of commitWindow) {
        const CHANGES = await C.changes();

        for (const CHG of CHANGES) {
            let f = CHG.file;
            if (!Path.isAbsolute(f)) {
                f = Path.join(rootFolderForGitFiles, f);
            }
            f = Path.resolve(f);

            if (!DOES_FILE_MATCH(f)) {
                continue;
            }

            if (WORKSPACE.isFileIgnored(f)) {
                continue;  // ignored
            }

            switch (operation) {
                case deploy_contracts.DeployOperation.Delete:
                    switch (CHG.type) {
                        case deploy_scm.FileChangeType.Added:
                        case deploy_scm.FileChangeType.Modified:
                            REMOVE_FILE(f);
                            break;

                        case deploy_scm.FileChangeType.Deleted:
                            ADD_FILE(f);
                            break;
                    }
                    break;

                case deploy_contracts.DeployOperation.Deploy:
                case deploy_contracts.DeployOperation.Pull:
                    switch (CHG.type) {
                        case deploy_scm.FileChangeType.Added:
                        case deploy_scm.FileChangeType.Modified:
                            ADD_FILE(f);
                            break;

                        case deploy_scm.FileChangeType.Deleted:
                            REMOVE_FILE(f);
                            break;
                    }
                    break;
            }
        }
    }

    // write to storage
    for (const F of filesFromGit) {
        if (NORMALIZED_INPUT_FILES.indexOf(F) < 0) {
            files.push(F);  // only if not in list yet
        }
    }

    return files;
}

/**
 * Prepares a package for use as file filter.
 * 
 * @param {TPackage} pkg The package to prepare.
 * 
 * @return {TPackage} The prepared package.
 */
export function preparePackageForFileFilter<TPackage extends Package = Package>(pkg: TPackage): TPackage {
    if (_.isNil(pkg)) {
        return pkg;
    }

    pkg = deploy_helpers.cloneObjectFlat(pkg);
    if (_.isNil(pkg.files)) {
        (<any>pkg).files = [ '**' ];
    }

    return pkg;
}

/**
 * Handles a file for "remove on change" feature.
 * 
 * @param {string} file The file to check.
 */
export async function removeOnChange(file: string) {
    const ME: deploy_workspaces.Workspace = this;

    if (ME.isInFinalizeState) {
        return;
    }

    try {
        const TARGETS = await deploy_helpers.applyFuncFor(
            findTargetsForFileOfPackage, ME
        )(file,
          (pkg) => pkg.removeOnChange,
          (pkg) => true);

        if (false === TARGETS) {
            return;
        }

        for (const T of Enumerable.from(TARGETS).distinct(true)) {
            await invokeForAutoTargetOperation(T, async (target) => {
                const TARGET_NAME = deploy_targets.getTargetName(target);

                try {
                    await ME.deleteFileIn(file, target, false);
                }
                catch (e) {
                    ME.showErrorMessage(
                        ME.t('DELETE.onChange.failed',
                             file, TARGET_NAME, e)
                    );
                }
            });
        }
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'delete.removeOnChange()');
    }
}

/**
 * Resets the package usage statistics.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function resetPackageUsage(context: vscode.ExtensionContext) {
    context.workspaceState.update(KEY_PACKAGE_USAGE, undefined).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'packages.resetPackageUsage()');
    });
}

/**
 * Shows a quick pick for a list of packages.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {Package|Package[]} packages One or more packages.
 * @param {vscode.QuickPickOptions} [opts] Custom options for the quick picks.
 * 
 * @return {Promise<Package|false>} The promise that contains the selected package (if selected)
 *                                  or (false) if no package is available.
 */
export async function showPackageQuickPick(context: vscode.ExtensionContext,
                                           packages: Package | Package[],
                                           opts?: vscode.QuickPickOptions): Promise<Package | false> {
    const QUICK_PICKS: deploy_contracts.ActionQuickPick<string>[] = deploy_helpers.asArray(packages).map(pkg => {
        const WORKSPACE = pkg.__workspace;

        return {
            action: () => {
                return pkg;
            },
            label: '$(gift)  ' + getPackageName(pkg),
            description: deploy_helpers.toStringSafe(pkg.description),
            detail: WORKSPACE.rootPath,
            state: Crypto.createHash('sha256')
                         .update( new Buffer(deploy_helpers.toStringSafe(pkg.__id), 'utf8') )
                         .digest('hex'),
        };
    });

    if (QUICK_PICKS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('packages.noneFound')
        );
        
        return false;
    }

    let selectedItem: deploy_contracts.ActionQuickPick<string>;
    if (1 === QUICK_PICKS.length) {
        selectedItem = QUICK_PICKS[0];
    }
    else {
        selectedItem = await vscode.window.showQuickPick(
            deploy_gui.sortQuickPicksByUsage(QUICK_PICKS,
                                             context.workspaceState,
                                             KEY_PACKAGE_USAGE,
                                             (i) => {
                                                 // remove icon
                                                 return i.label
                                                         .substr(i.label.indexOf(' '))
                                                         .trim();
                                             }),
            opts,
        );
    }

    if (selectedItem) {
        return selectedItem.action();
    }
}

async function waitForOtherAutoTargetOperations(target: deploy_targets.Target) {
    if (!target) {
        return;
    }

    await deploy_helpers.waitWhile(() => {
        return !deploy_helpers.isNullOrUndefined(
            AUTO_DEPLOY_STATES[ target.__id ]
        );
    }, {
        timeout: 60000,
        timeUntilNextCheck: 250,
    });
}
