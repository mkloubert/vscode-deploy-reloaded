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
import * as deploy_delete from './delete';
import * as deploy_deploy from './deploy';
import * as deploy_helpers from './helpers';
import * as deploy_i18 from './i18';
import * as deploy_list from './list';
import * as deploy_log from './log';
import * as deploy_objects from './objects';
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_pull from './pull';
import * as deploy_sync from './sync';
import * as deploy_targets from './targets';
import * as deploy_transformers from './transformers';
import * as deploy_tasks from './tasks';
import * as deploy_values from './values';
import * as Enumerable from 'node-enumerable';
import * as Glob from 'glob';
import * as i18next from 'i18next';
const MergeDeep = require('merge-deep');
import * as Moment from 'moment';
import * as OS from 'os';
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * Out value for 'Workspace.downloadFromSettingsUri()' method.
 */
export interface DownloadFromSettingsUriOutValue {
    /**
     * The download source.
     */
    source?: 'local';
}

interface PackageWithButton {
    readonly button: vscode.StatusBarItem;
    readonly command: vscode.Disposable;
    readonly package: deploy_packages.Package;
}

/**
 * Object that stores the states for 'sync when open'.
 */
export type SyncWhenOpenStates = { [ key: string ]: Moment.Moment };

/**
 * A workspace context.
 */
export interface WorkspaceContext {
    /**
     * The underlying extension context.
     */
    readonly extension: vscode.ExtensionContext;
    /**
     * The output channel.
     */
    readonly outputChannel: vscode.OutputChannel;
    /**
     * All plugins.
     */
    readonly plugins: deploy_plugins.Plugin[];
    /**
     * The list of other workspaces.
     */
    readonly workspaces: Workspace[];
}

/**
 * A workspace file.
 */
export interface WorkspaceFile extends deploy_contracts.WithNameAndPath, WorkspaceItem {
    /**
     * The path to the (local) file.
     */
    readonly file: string;
}

/**
 * A workspace item.
 */
export interface WorkspaceItem {
    /**
     * The underlying workspace.
     */
    readonly workspace: Workspace;
}

/**
 * A workspace item from settings.
 */
export interface WorkspaceItemFromSettings {
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the ID of that item.
     */
    readonly __id: any;
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the zero-based of that item.
     */
    readonly __index: number;
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * A value for comparison.
     */
    readonly __searchValue: any;
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the underlying workspace.
     */
    readonly __workspace: Workspace;
}

/**
 * Workspace settings.
 */
export interface WorkspaceSettings extends deploy_contracts.Configuration, vscode.WorkspaceConfiguration {
}


const FILES_CHANGES: { [path: string]: deploy_contracts.FileChangeType } = {};
let nextPackageButtonId = Number.MIN_SAFE_INTEGER;

/**
 * A workspace.
 */
export class Workspace extends deploy_objects.DisposableBase implements deploy_contracts.Translator, vscode.Disposable {
    /**
     * Stores the current configuration.
     */
    protected _config: WorkspaceSettings;
    /**
     * Stores the source of the configuration data.
     */
    protected _configSource: deploy_contracts.ConfigSource;
    /**
     * Stores if 'deploy on change' feature is freezed or not.
     */
    protected _isDeployOnChangeFreezed = false;
    /**
     * Stores if workspace has been initialized or not.
     */
    protected _isInitialized = false;
    /**
     * Stores if configuration is currently reloaded or not.
     */
    protected _isReloadingConfig = false;
    /**
     * Stores if 'remove on change' feature is freezed or not.
     */
    protected _isRemoveOnChangeFreezed = false;
    /**
     * Stores the last timestamp of configuration update.
     */
    protected _lastConfigUpdate: Moment.Moment;
    private _PACKAGE_BUTTONS: PackageWithButton[] = [];
    /**
     * Stores the start time.
     */
    protected _startTime: Moment.Moment;
    /**
     * Stores the states for 'sync when open'.
     */
    protected _syncWhenOpenStates: SyncWhenOpenStates;
    /**
     * The current translation function.
     */
    protected _translator: i18next.TranslationFunction;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {any} id The ID.
     * @param {vscode.WorkspaceFolder} folder The underlying folder.
     * @param {WorkspaceContext} context the current extension context.
     */
    constructor(public readonly id: any,
                public readonly folder: vscode.WorkspaceFolder,
                public readonly context: WorkspaceContext) {
        super();
    }

    /**
     * Checks if an object can be handled by that workspace.
     * 
     * @param {WorkspaceItem|WorkspaceItemFromSettings} obj The object to check.
     * 
     * @return {boolean} Can be handled or not.
     */
    public canBeHandledByMe(obj: WorkspaceItem | WorkspaceItemFromSettings) {
        if (obj) {
            const WORKSPACE = (<any>obj).__workspace || (<any>obj).workspace;
            if (WORKSPACE instanceof Workspace) {
                return Path.resolve(WORKSPACE.folder.uri.fsPath) ===
                       Path.resolve(this.folder.uri.fsPath);
            }
        }

        return false;
    }

    /**
     * Gets if the workspace can do automatic (background) operations or not.
     */
    public get canDoAutoOperations() {
        return !this.isInFinalizeState &&
               !this.isReloadingConfig;
    }

    private cleanupPackageButtons() {
        while (this._PACKAGE_BUTTONS.length > 0) {
            const PBTN = this._PACKAGE_BUTTONS.shift();

            deploy_helpers.tryDispose(PBTN.button);
            deploy_helpers.tryDispose(PBTN.command);
        }
    }

    /**
     * Gets the current configuration.
     */
    public get config(): WorkspaceSettings {
        return this._config;
    }

    /**
     * Gets the config source.
     */
    public get configSource(): deploy_contracts.ConfigSource {
        return this._configSource;
    }

    /**
     * Deletes a file in a target.
     * 
     * @param {string} file The file to delete.
     * @param {deploy_targets.Target} target The target to delete in.
     * @param {boolean} [askForDeleteLocalFile] Also ask for deleting the local file or not.
     */
    public async deleteFileIn(file: string, target: deploy_targets.Target,
                              askForDeleteLocalFile = true) {
        return await deploy_delete.deleteFileIn
                                  .apply(this, arguments);
    }

    /**
     * Deletes a package.
     * 
     * @param {deploy_packages.Package} pkg The package to delete.
     * @param {boolean} [askForDeleteLocalFiles] Also ask for deleting the local files or not.
     */
    public async deletePackage(pkg: deploy_packages.Package,
                               askForDeleteLocalFiles = true) {
        return await deploy_delete.deletePackage
                                  .apply(this, arguments);
    }

    /**
     * Deploys a file to a target.
     * 
     * @param {string} file The file to deploy.
     * @param {deploy_targets.Target} target The target to deploy to.
     */
    public async deployFileTo(file: string, target: deploy_targets.Target) {
        return await deploy_deploy.deployFileTo
                                  .apply(this, arguments);
    }

    /**
     * Deploys a files to a target.
     * 
     * @param {string[]} files The files to deploy.
     * @param {deploy_targets.Target} target The target to deploy to.
     * @param {number} [targetNr] The number of the target.
     */
    protected async deployFilesTo(files: string[],
                                  target: deploy_targets.Target, targetNr?: number) {
        return await deploy_deploy.deployFilesTo
                                  .apply(this, arguments);
    }

    /**
     * Deploys a file when is has been changed.
     * 
     * @param {string} file The file to check. 
     */
    protected async deployOnChange(file: string) {
        if (this.isDeployOnChangeFreezed) {
            return;  // freezed
        }

        if (!deploy_helpers.toBooleanSafe(this.config.deployOnChange, true)) {
            return;  // deactivated
        }

        if (!deploy_helpers.isEmptyString(file)) {
            if (!this.isFileIgnored(file)) {
                return await deploy_deploy.deployOnChange
                                          .apply(this, arguments);
            }
        }
    }

    /**
     * Deploys a file when is has been saved.
     * 
     * @param {string} file The file to check. 
     */
    protected async deployOnSave(file: string) {
        if (!deploy_helpers.toBooleanSafe(this.config.deployOnSave, true)) {
            return;  // deactivated
        }
        
        if (!deploy_helpers.isEmptyString(file)) {
            if (!this.isFileIgnored(file)) {
                return await deploy_deploy.deployOnSave
                                          .apply(this, arguments);
            }
        }
    }

    /**
     * Deploys a package.
     * 
     * @param {deploy_packages.Package} pkg The package to deploy. 
     */
    public async deployPackage(pkg: deploy_packages.Package) {
        await deploy_deploy.deployPackage
                           .apply(this, arguments);
    }

    /**
     * Downloads setting data from an URI.
     * 
     * @param {vscode.Uri} uri The URI.
     * @param {DownloadFromSettingsUriOutValue} [outVal] An object for storing additiional result data.
     */
    public async downloadFromSettingsUri(uri: vscode.Uri, outVal?: DownloadFromSettingsUriOutValue): Promise<Buffer | false> {
        if (!outVal) {
            outVal = {};
        }
        
        //TODO: implement other donwload sources, like HTTP or FTP

        outVal.source = 'local';
        const LOCAL_FILE = await this.getExistingSettingPath(uri.fsPath);
        if (false !== LOCAL_FILE) {
            return await deploy_helpers.readFile(LOCAL_FILE);
        }

        return false;
    }

    /**
     * Finds files inside that workspace.
     * 
     * @param {deploy_contracts.FileFilter} filter The filter to use.
     * @param {Glob.IOptions} [opts] Custom options.
     * 
     * @return {Promise<string[]>} The promise with the found files.
     */
    public async findFilesByFilter(filter: deploy_contracts.FileFilter, opts?: Glob.IOptions) {
        if (!filter) {
            filter = <any>{};
        }

        let patterns = deploy_helpers.asArray(filter.files).map(p => {
            return deploy_helpers.toStringSafe(p);
        }).filter(p => !deploy_helpers.isEmptyString(p));

        let exclude = deploy_helpers.asArray(filter.exclude).map(e => {
            return deploy_helpers.toStringSafe(e);
        }).filter(e => !deploy_helpers.isEmptyString(e));
        if (exclude.length < 1) {
            exclude = undefined;
        }

        const DEFAULT_OPTS: Glob.IOptions = {
            cwd: this.folder.uri.fsPath,
            ignore: exclude,
            root: this.folder.uri.fsPath,
        };

        return await deploy_helpers.glob(patterns,
                                         MergeDeep(DEFAULT_OPTS, opts));
    }

    /**
     * Returns all 'delete' plugins by target.
     * 
     * @param {deploy_targets.Target} target The target.
     * 
     * @return {deploy_plugins.Plugin[]} The plugins.
     */
    public getDeletePlugins(target: deploy_targets.Target) {
        if (!target) {
            return;
        }

        const TARGET_TYPE = deploy_targets.normalizeTargetType(target);

        return this.context.plugins.filter(pi => {
            const PLUGIN_TYPE = deploy_helpers.normalizeString(pi.__type);

            return '' === PLUGIN_TYPE || 
                   (TARGET_TYPE === PLUGIN_TYPE && pi.canDelete && pi.deleteFiles);
        });
    }

    /**
     * Returns all download plugins by target.
     * 
     * @param {deploy_targets.Target} target The target.
     * 
     * @return {deploy_plugins.Plugin[]} The plugins.
     */
    public getDownloadPlugins(target: deploy_targets.Target) {
        if (!target) {
            return;
        }

        const TARGET_TYPE = deploy_targets.normalizeTargetType(target);

        return this.context.plugins.filter(pi => {
            const PLUGIN_TYPE = deploy_helpers.normalizeString(pi.__type);

            return '' === PLUGIN_TYPE || 
                   (TARGET_TYPE === PLUGIN_TYPE && pi.canDownload && pi.downloadFiles);
        });
    }

    /**
     * Returns an existing path based on the settings folder.
     * 
     * @param {string} path The path.
     * 
     * @return {string|boolean} The existing, full normalized path or (false) if path does not exist.
     */
    public async getExistingSettingPath(path: string): Promise<string | false> {
        path = deploy_helpers.toStringSafe(path);
        
        if (!Path.isAbsolute(path)) {
            const FROM_SETTINGS = Path.resolve(
                Path.join(Path.dirname(this.configSource.resource.fsPath), path)
            );
            if (await deploy_helpers.exists(FROM_SETTINGS)) {
                return FROM_SETTINGS;
            }

            const FROM_HOMEDIR = Path.resolve(
                Path.join(OS.homedir(), '.vscode-deploy', path)
            );
            if (await deploy_helpers.exists(FROM_HOMEDIR)) {
                return FROM_HOMEDIR;
            }

            return false;
        }

        path = Path.resolve(path);
        if (await deploy_helpers.exists(path)) {
            return path;
        }
        
        return false;
    }

    /**
     * Returns all 'list directory' plugins by target.
     * 
     * @param {deploy_targets.Target} target The target.
     * 
     * @return {deploy_plugins.Plugin[]} The plugins.
     */
    public getListPlugins(target: deploy_targets.Target) {
        if (!target) {
            return;
        }

        const TARGET_TYPE = deploy_targets.normalizeTargetType(target);

        return this.context.plugins.filter(pi => {
            const PLUGIN_TYPE = deploy_helpers.normalizeString(pi.__type);

            return '' === PLUGIN_TYPE || 
                   (TARGET_TYPE === PLUGIN_TYPE && pi.canList && pi.listDirectory);
        });
    }

    /**
     * Returns the name and path for a file deployment.
     * 
     * @param {string} file The file.
     * @param {deploy_targets.Target} target The target.
     */
    public getNameAndPathForFileDeployment(file: string, target: deploy_targets.Target) {
        file = deploy_helpers.toStringSafe(file);

        if (!target) {
            return;
        }

        if (!this.canBeHandledByMe) {
            // TODO: translate
            this.context.outputChannel.append(`Target '${deploy_targets.getTargetName(target)}' cannot be used for file '${file}'!`);
            return false;
        }

        const NAME_AND_PATH = this.toNameAndPath(file);
        if (false === NAME_AND_PATH) {
            // TODO: translate
            this.context.outputChannel.append(`Cannot detect path information for file '${file}'!`);
            return false;
        }

        const MAPPED_PATH = deploy_targets.getMappedTargetFilePath(target,
                                                                   NAME_AND_PATH.path,
                                                                   NAME_AND_PATH.name);

        const MAPPED_NAME_AND_PATH = this.toNameAndPath(MAPPED_PATH);
        if (false === MAPPED_NAME_AND_PATH) {
            // TODO: translate
            this.context.outputChannel.append(`Cannot detect mapped path information for file '${file}'!`);
            return false;
        }

        return MAPPED_NAME_AND_PATH;
    }

    /**
     * Returns the ID of a package.
     * 
     * @param {deploy_packages.Package} package The package.
     * 
     * @return {string|false} The ID or (false) if package is invalid.
     */
    public getPackageId(pkg: deploy_packages.Package): string | false {
        if (!pkg) {
            return;
        }

        if (!this.canBeHandledByMe(pkg)) {
            return false;
        }

        return `${this.id}\n` + 
               `${pkg.__index}\n` + 
               `${deploy_helpers.normalizeString( deploy_packages.getPackageName(pkg) )}\n` + 
               `${this.configSource.resource.fsPath}`;
    }

    /**
     * Returns the list of packages as defined in the settings.
     */
    public getPackages(): deploy_packages.Package[] {
        const ME = this;

        const CFG = ME.config;
        if (!CFG) {
            return;
        }

        let index = -1;

        let packages = Enumerable.from( deploy_helpers.asArray(CFG.packages) ).where(p => {
            return 'object' === typeof p;
        }).select(p => {
            return deploy_helpers.cloneObject(p);
        }).pipe(p => {
            ++index;

            (<any>p)['__index'] = index;
            (<any>p)['__workspace'] = ME;

            // can only be defined AFTER '__workspace'!
            (<any>p)['__id'] = ME.getPackageId(p);
            (<any>p)['__searchValue'] = deploy_helpers.normalizeString(
                deploy_packages.getPackageName(p)
            );

            Object.defineProperty(p, '__button', {
                enumerable: true,

                get: () => {
                    return Enumerable.from(ME._PACKAGE_BUTTONS).where(pwb => {
                        return pwb.package.__id === p.__id;
                    }).select(pwb => pwb.button)
                      .singleOrDefault(undefined);
                }
            });
        }).toArray();

        packages = deploy_helpers.filterConditionalItems(packages);

        return packages;
    }

    /**
     * Returns the state key for 'sync when open'.
     * 
     * @param {deploy_targets.Target} target The target.
     * 
     * @return {string|false} The key or (false) when failed.
     */
    public getSyncWhenOpenKey(target: deploy_targets.Target): string | false {
        if (!target) {
            return;
        }
        
        if (!this.canBeHandledByMe(target)) {
            return false;
        }

        const TARGET_NAME = deploy_targets.getTargetName(target);
        
        return `${target.__id}\n` + 
               `${deploy_helpers.normalizeString(TARGET_NAME)}`;
    }

    /**
     * Returns the ID of a target.
     * 
     * @param {deploy_targets.Target} target The target.
     * 
     * @return {string|false} The ID or (false) if target is invalid.
     */
    public getTargetId(target: deploy_targets.Target): string | false {
        if (!target) {
            return;
        }

        if (!this.canBeHandledByMe(target)) {
            return false;
        }

        return `${this.id}\n` + 
               `${target.__index}\n` + 
               `${deploy_helpers.normalizeString( deploy_targets.getTargetName(target) )}` + 
               `${this.configSource.resource.fsPath}`;
    }

    /**
     * Returns the list of targets as defined in the settings.
     */
    public getTargets(): deploy_targets.Target[] {
        const ME = this;

        const CFG = ME.config;
        if (!CFG) {
            return;
        }

        let index = -1;

        let targets = Enumerable.from( deploy_helpers.asArray(CFG.targets) ).where(t => {
            return 'object' === typeof t;
        }).select(t => {
            return deploy_helpers.cloneObject(t);
        }).pipe(t => {
            ++index;

            (<any>t)['__index'] = index;
            (<any>t)['__workspace'] = ME;

            // can only be defined AFTER '__workspace'!
            (<any>t)['__id'] = ME.getTargetId(t);
            (<any>t)['__searchValue'] = deploy_helpers.normalizeString(
                deploy_targets.getTargetName(t)
            );
        }).toArray();

        targets = deploy_helpers.filterConditionalItems(targets);

        return targets;
    }

    /**
     * Returns the targets of a package.
     * 
     * @param {deploy_packages.Package} pkg The package.
     * 
     * @return {deploy_targets.Target[]|false} The targets or (false) if at least one target could not be found
     *                                         or (false) if package cannot be handled by that workspace.
     */
    public getTargetsOfPackage(pkg: deploy_packages.Package): deploy_targets.Target[] | false {
        if (!pkg) {
            return;
        }

        if (!this.canBeHandledByMe(pkg)) {
            return false;
        }

        const TARGET_NAMES = deploy_helpers.asArray(pkg.targets).map(tn => {
            return deploy_helpers.normalizeString(tn);
        }).filter(tn => {
            return '' !== tn;
        });

        if (TARGET_NAMES.length < 1) {
            return [];
        }

        return deploy_targets.getTargetsByName(TARGET_NAMES, this.getTargets());
    }

    /**
     * Returns all upload plugins by target.
     * 
     * @param {deploy_targets.Target} target The target.
     * 
     * @return {deploy_plugins.Plugin[]} The plugins.
     */
    public getUploadPlugins(target: deploy_targets.Target) {
        if (!target) {
            return;
        }

        const TARGET_TYPE = deploy_targets.normalizeTargetType(target);

        return this.context.plugins.filter(pi => {
            const PLUGIN_TYPE = deploy_helpers.normalizeString(pi.__type);

            return '' === PLUGIN_TYPE || 
                   (TARGET_TYPE === PLUGIN_TYPE && pi.canUpload && pi.uploadFiles);
        });
    }

    /**
     * Returns the list of values.
     */
    public getValues(): deploy_values.Value[] {
        return deploy_values.loadFromItems(this.config);
    }

    /**
     * Global data as defined in the settings.
     */
    public get globals(): any {
        return deploy_helpers.cloneObject(this.config.globals);
    }

    /**
     * Initializes that workspace.
     * 
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public async initialize() {
        const ME = this;

        if (ME.isInitialized) {
            return false;
        }

        // settings file
        {
            interface SettingsData {
                file: string;
                section: string;
            }

            const ALTERNATIVE_FILENAME = './.vscode/deploy.json';
            const ALTERNATIVE_SECTION_NAME = 'deploy';
            const DEFAULT_DIR = this.folder.uri.fsPath;
            const DEFAULT_FILENAME = './.vscode/settings.json';
            const DEFAULT_FILE = Path.join(
                DEFAULT_DIR,
                DEFAULT_FILENAME,
            );
            const DEFAULT_SECTION_NAME = 'deploy.reloaded';

            let settingsData: SettingsData | false = false;

            let searchForNextFile: (dir: string) => Promise<SettingsData | false>;
            searchForNextFile = async (dir: string) => {
                try {
                    dir = Path.resolve(dir);

                    const POSSIBLE_FILES: SettingsData[] = [
                        // deploy.json
                        /* TODO: implement later
                        {
                            section: ALTERNATIVE_SECTION_NAME,
                            file: Path.resolve(
                                Path.join(dir, ALTERNATIVE_FILENAME)
                            )
                        },*/

                        // settings.json
                        {
                            section: DEFAULT_SECTION_NAME,
                            file: Path.resolve(
                                Path.join(dir, DEFAULT_FILENAME)
                            )
                        }
                    ];

                    for (const ITEM of POSSIBLE_FILES) {
                        if (await deploy_helpers.exists(ITEM.file)) {
                            if ((await deploy_helpers.lstat(ITEM.file)).isFile()) {
                                return ITEM;  // found
                            }
                        }
                    }

                    const PARENT_DIR = Path.resolve(
                        Path.join(dir, '../')
                    );
                    if (dir !== PARENT_DIR && !deploy_helpers.isEmptyString(PARENT_DIR)) {
                        return await searchForNextFile(PARENT_DIR);
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'workspaces.Workspace.initialize()');
                }

                return false;
            };

            settingsData = await searchForNextFile(DEFAULT_DIR);
            if (false === settingsData) {
                // use default

                settingsData = {
                    file: DEFAULT_FILE,
                    section: DEFAULT_SECTION_NAME,
                };
            }

            ME._configSource = {
                section: settingsData.section,
                resource: vscode.Uri.file(settingsData.file),
            };
        }

        await ME.reloadConfiguration();

        ME._startTime = Moment();
        ME._isInitialized = true;

        return true;
    }

    /**
     * Gets if 'deploy on change' is currently freezed or not.
     */
    public get isDeployOnChangeFreezed() {
        return this._isDeployOnChangeFreezed;
    }

    /**
     * Checks if a file is ignored by that workspace.
     * 
     * @param {string} file The file to check.
     * 
     * @return {boolean} Is ignored or not. 
     */
    public isFileIgnored(file: string): boolean {
        file = deploy_helpers.toStringSafe(file);
        if (deploy_helpers.isEmptyString(file)) {
            return true;  // no (valid) file path
        }

        if (this.isInSettingsFolder(file)) {
            return true;  // not from settings folder
        }

        const RELATIVE_PATH = this.toRelativePath(file);
        if (false === RELATIVE_PATH) {
            return true;  // is not part of that workspace
        }

        const IGNORE_PATTERNS = deploy_helpers.asArray(this.config.ignore).map(i => {
            return deploy_helpers.toStringSafe(i);
        }).filter(i => {
            return !deploy_helpers.isEmptyString(i);
        });

        if (IGNORE_PATTERNS.length < 1) {
            return false;
        }

        const FILTER: deploy_contracts.FileFilter = {
            files: IGNORE_PATTERNS,
        };

        return deploy_helpers.checkIfDoesMatchByFileFilter('/' + RELATIVE_PATH,
                                                           deploy_helpers.toMinimatchFileFilter(FILTER));
    }

    /**
     * Gets if the workspace has been initialized or not.
     */
    public get isInitialized() {
        return this._isInitialized;
    }

    /**
     * Checks if a path is inside the settings folder.
     * 
     * @param {string} path The path to check.
     * 
     * @return {boolean} Is in settings folder or not.
     */
    public isInSettingsFolder(path: string) {
        const SETTINGS_DIR = Path.resolve(
            Path.dirname(this.configSource.resource.fsPath)
        );
        
        path = deploy_helpers.toStringSafe(path);
        if (!Path.isAbsolute(path)) {
            return true;
        }
        path = Path.resolve(path);

        return path.startsWith(SETTINGS_DIR);
    }

    /**
     * Checks if a path is part of that workspace.
     * 
     * @param {string} path The path to check.
     * 
     * @return {boolean} Is part of that workspace or not. 
     */
    public isPathOf(path: string) {
        return false !== this.toFullPath(path);
    }

    /**
     * Gets if the configuration for that workspace is currently reloaded or not.
     */
    public get isReloadingConfig(): boolean {
        return this._isReloadingConfig;
    }

    /**
     * Gets if 'remove on change' is currently freezed or not.
     */
    public get isRemoveOnChangeFreezed() {
        return this._isRemoveOnChangeFreezed;
    }

    /**
     * Gets the last config update timestamp.
     */
    public get lastConfigUpdate(): Moment.Moment {
        return this._lastConfigUpdate;
    }
    
    /**
     * List the root directory on a target.
     * 
     * @param {deploy_targets.Target} target The target from where to get the list.
     * 
     * @return {Promise<deploy_plugins.ListDirectoryResult<TTarget>>} The promise with the result.
     */
    public async listDirectory<TTarget extends deploy_targets.Target = deploy_targets.Target>(target: TTarget): Promise<deploy_plugins.ListDirectoryResult<TTarget>> {
        return await deploy_list.listDirectory
                                .apply(this, [ target ]);
    }

    /**
     * Loads a data transformer for an object.
     * 
     * @param {deploy_transformers.CanTransformData} transformable An object that can transform data.
     * 
     * @return {Promise<deploy_transformers.DataTransformer|false>} The loaded transformer or (false) if script could not be loaded.
     */
    public async loadDataTransformer(transformable: deploy_transformers.CanTransformData): Promise<deploy_transformers.DataTransformer | false> {
        const ME = this;
        
        if (!transformable) {
            return null;
        }
        
        const SCRIPT = deploy_helpers.toStringSafe(transformable.transformer);
        if (deploy_helpers.isEmptyString(SCRIPT)) {
            return;
        }

        const SCRIPT_FILE = await ME.getExistingSettingPath(SCRIPT);
        if (false === SCRIPT_FILE) {
            return false;
        }

        delete require.cache[SCRIPT_FILE];
        const SCRIPT_MODULE: deploy_transformers.DataTransformerModule = require(SCRIPT_FILE);

        if (SCRIPT_MODULE) {
            const TRANSFORMER = SCRIPT_MODULE.transform;
            if (TRANSFORMER) {
                return async function() {
                    return await TRANSFORMER.apply(SCRIPT_MODULE,
                                                   arguments);
                };
            }
            else {
                return TRANSFORMER;
            }
        }
    }

    /**
     * Is invoked when the active text editor changed.
     * 
     * @param {vscode.TextEditor} editor The new editor.
     */
    public async onDidChangeActiveTextEditor(editor: vscode.TextEditor) {
        if (!this.canDoAutoOperations) {
            return;
        }

        if (editor) {
            const DOC = editor.document;

            if (DOC) {
                // sync when open
                if (deploy_helpers.toBooleanSafe(this.config.syncWhenOpen, true)) {
                    try {
                        const FILE_TO_CHECK = DOC.fileName;

                        if (!deploy_helpers.isEmptyString(FILE_TO_CHECK)) {
                            if (!this.isFileIgnored(FILE_TO_CHECK)) {
                                await deploy_sync.syncDocumentWhenOpen
                                                 .apply(this, [ editor.document ]);
                            }
                        }
                    }
                    catch (e) {
                        deploy_log.CONSOLE
                                .trace(e, 'workspaces.Workspace.onDidChangeActiveTextEditor(1)');
                    }
                }
            }
        }
    }

    /**
     * Is invoked when configuration changes.
     * 
     * @param {vscode.ConfigurationChangeEvent} e The event data.
     */
    public async onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
        await this.reloadConfiguration();
    }

    /**
     * Is invoked on a file / directory change.
     * 
     * @param {vscode.Uri} e The URI of the item.
     * @param {deploy_contracts.FileChangeType} type The type of change.
     */
    public async onDidFileChange(e: vscode.Uri, type: deploy_contracts.FileChangeType, retry = true) {
        const ME = this;

        if (!ME.canDoAutoOperations) {
            return;
        }

        if (!ME.isPathOf(e.fsPath)) {
            return;
        }

        const MY_ARGS = arguments;

        if ('undefined' !== typeof FILES_CHANGES[e.fsPath]) {
            if (retry) {
                await deploy_helpers.invokeAfter(async () => {
                    await ME.onDidFileChange
                            .apply(ME, MY_ARGS);
                });
            }

            return;
        }
        FILES_CHANGES[e.fsPath] = type;

        try {
            switch (type) {
                case deploy_contracts.FileChangeType.Changed:
                    await this.deployOnChange(e.fsPath);
                    break;

                case deploy_contracts.FileChangeType.Created:
                    await this.deployOnChange(e.fsPath);
                    break;

                case deploy_contracts.FileChangeType.Deleted:
                    await ME.removeOnChange(e.fsPath);
                    break;
            }
        }
        finally {
            delete FILES_CHANGES[e.fsPath];
        }
    }

    /**
     * Is invoked when a text document has been changed.
     * 
     * @param {vscode.TextDocument} e The underlying text document.
     */
    public async onDidSaveTextDocument(e: vscode.TextDocument) {
        if (!this.canDoAutoOperations) {
            return;
        }

        if (!e) {
            return;
        }
        
        await this.deployOnSave(e.fileName);
    }


    /** @inheritdoc */
    protected onDispose() {
        this._syncWhenOpenStates = null;
    }

    /**
     * Gets the name of that workspace.
     */
    public get name(): string {
        return Path.basename(this.folder.uri.fsPath);
    }

    /**
     * Pulls a file from a target.
     * 
     * @param {string} file The file to pull.
     * @param {deploy_targets.Target} target The target from where to pull from.
     */
    public async pullFileFrom(file: string, target: deploy_targets.Target) {
        return await deploy_pull.pullFileFrom
                                .apply(this, arguments);
    }

    /**
     * Pulls files from a target.
     * 
     * @param {string[]} files The files to pull.
     * @param {deploy_targets.Target} target The target to pull from.
     * @param {number} [targetNr] The number of the target.
     */
    protected async pullFilesFrom(files: string[],
                                  target: deploy_targets.Target, targetNr?: number) {
        return await deploy_pull.pullFilesFrom
                                .apply(this, arguments);
    }

    /**
     * Pulls a package.
     * 
     * @param {deploy_packages.Package} pkg The package to pull. 
     */
    public async pullPackage(pkg: deploy_packages.Package) {
        return await deploy_pull.pullPackage
                                .apply(this, arguments);
    }

    /**
     * Reloads the current configuration for that workspace.
     * 
     * @param {boolean} [retry] Retry when busy or not. 
     */
    public async reloadConfiguration(retry = true) {
        const ME = this;

        const MY_ARGS = arguments;

        if (ME.isReloadingConfig) {
            if (retry) {
                await deploy_helpers.invokeAfter(async () => {
                    ME.reloadConfiguration
                      .apply(ME, MY_ARGS);
                });
            }

            return;
        }
        ME._isReloadingConfig = true;

        let finalizer: () => any;
        try {
            ME.cleanupTimers();

            ME._isDeployOnChangeFreezed = false;
            ME._isRemoveOnChangeFreezed = false;

            let loadedCfg: WorkspaceSettings = vscode.workspace.getConfiguration(ME.configSource.section,
                                                                                 ME.configSource.resource) || <any>{};
            loadedCfg = deploy_helpers.cloneObjectFlat(loadedCfg);

            // runGitPullOnStartup
            await deploy_tasks.runGitPullOnStartup
                              .apply(ME, [ loadedCfg ]);

            // imports
            try {
                let allImports = deploy_helpers.asArray(loadedCfg.imports);

                for (const IE of allImports) {
                    let importFile: string;

                    if (deploy_helpers.isObject<deploy_contracts.Import>(IE)) {
                        const CI = deploy_helpers.filterConditionalItems(IE);
                        if (1 === CI.length) {
                            importFile = deploy_helpers.toStringSafe(CI[0].from);
                        }
                    }
                    else {
                        importFile = deploy_helpers.toStringSafe(IE);
                    }

                    if (deploy_helpers.isEmptyString(importFile)) {
                        continue;
                    }

                    const DOWNLOAD_SOURCE: DownloadFromSettingsUriOutValue = {};
                    const DATA = await ME.downloadFromSettingsUri(vscode.Uri.parse(importFile));

                    if (!Buffer.isBuffer(DATA)) {
                        continue;
                    }

                    deploy_helpers.asArray(JSON.parse(DATA.toString('utf8')))
                        .filter(c => deploy_helpers.isObject(c))
                        .forEach(c => {
                                      const SUB_SUBSETTINGS = c[ME.configSource.section];
                                      if (!deploy_helpers.isObject<deploy_contracts.Configuration>(SUB_SUBSETTINGS)) {
                                          return; 
                                      }

                                      loadedCfg = MergeDeep(loadedCfg, SUB_SUBSETTINGS);
                                  });
                }
            }
            finally {
                (<any>loadedCfg).packages = deploy_helpers.mergeByName(loadedCfg.packages);
                (<any>loadedCfg).targets = deploy_helpers.mergeByName(loadedCfg.targets);

                delete (<any>loadedCfg).imports;
            }

            const OLD_CFG = ME._config;
            ME._config = loadedCfg;
            ME._lastConfigUpdate = Moment();

            try {
                ME.emit(deploy_contracts.EVENT_CONFIG_RELOADED,
                        ME, loadedCfg, OLD_CFG);
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'workspaces.reloadConfiguration(1)');
            }

            ME._translator = null;
            try {
                ME._translator = await deploy_i18.init
                                                 .apply(ME, []);
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'workspaces.reloadConfiguration(2)');
            }

            finalizer = async () => {
                ME._syncWhenOpenStates = {};

                // runBuildTaskOnStartup
                try {
                    await deploy_tasks.runBuildTaskOnStartup
                                      .apply(ME, []);
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'workspaces.reloadConfiguration(7)');
                }

                // timeToWaitBeforeActivateDeployOnChange
                try {
                    const TIME_TO_WAIT_BEFORE_ACTIVATE_DEPLOY_ON_CHANGE = parseInt(
                        deploy_helpers.toStringSafe(loadedCfg.timeToWaitBeforeActivateDeployOnChange).trim()
                    );
                    if (!isNaN(TIME_TO_WAIT_BEFORE_ACTIVATE_DEPLOY_ON_CHANGE)) {
                        // deactivate 'deploy on change'
                        // for a while

                        ME._isDeployOnChangeFreezed = true;
                        ME._TIMERS.push(
                            setTimeout(() => {
                                ME._isDeployOnChangeFreezed = false;
                            }, TIME_TO_WAIT_BEFORE_ACTIVATE_DEPLOY_ON_CHANGE)
                        );
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'workspaces.reloadConfiguration(5)');

                    ME._isDeployOnChangeFreezed = false;
                }

                // timeToWaitBeforeActivateRemoveOnChange
                try {
                    const TIME_TO_WAIT_BEFORE_ACTIVATE_REMOVE_ON_CHANGE = parseInt(
                        deploy_helpers.toStringSafe(loadedCfg.timeToWaitBeforeActivateRemoveOnChange).trim()
                    );
                    if (!isNaN(TIME_TO_WAIT_BEFORE_ACTIVATE_REMOVE_ON_CHANGE)) {
                        // deactivate 'remove on change'
                        // for a while

                        ME._isRemoveOnChangeFreezed = true;
                        ME._TIMERS.push(
                            setTimeout(() => {
                                ME._isRemoveOnChangeFreezed = false;
                            }, TIME_TO_WAIT_BEFORE_ACTIVATE_REMOVE_ON_CHANGE)
                        );
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'workspaces.reloadConfiguration(6)');

                    ME._isRemoveOnChangeFreezed = false;
                }

                if (deploy_helpers.toBooleanSafe(loadedCfg.clearOutputOnStartup)) {
                    ME.context.outputChannel.clear();
                }
                if (deploy_helpers.toBooleanSafe(loadedCfg.openOutputOnStartup, true)) {
                    ME.context.outputChannel.show();
                }

                await ME.reloadPackageButtons();
            };
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.reloadConfiguration(3)');

            finalizer = async () => {
                // DO NOT TRANSLATE
                // BECAUSE IT IS NOT GARANTEED THAT
                // A TRANSLATOR HAS BEEN LOADED YET!

                const BUTTONS: deploy_contracts.MessageItemWithValue[] = [
                    {
                        title: 'Yes',
                        value: 1,
                    },
                    {
                        title: 'No',
                        value: 2,
                    }
                ];

                const SELECTED_ITEM = await ME.showErrorMessage.apply(
                    ME,
                    [ <any>`The settings could not be loaded! Do you want to try it again?` ].concat(BUTTONS)
                );
                if (SELECTED_ITEM) {
                    if (1 === SELECTED_ITEM.value) {
                        ME._isReloadingConfig = false;

                        ME.reloadConfiguration
                          .apply(ME, MY_ARGS);
                    }
                }
            };
        }
        finally {
            if (finalizer) {
                try {
                    await Promise.resolve(
                        finalizer()
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'workspaces.reloadConfiguration(4)');
                }
            }

            ME._isReloadingConfig = false;
        }
    }

    private async reloadPackageButtons() {
        const ME = this;

        ME.cleanupPackageButtons();

        for (const P of ME.getPackages()) {
            let buttonDesc: deploy_packages.PackageButton;

            const DEFAULT_BTN_TEXT = `Deploy package '${ deploy_packages.getPackageName(P) }'`;
            const DEFAULT_BTN_TOOLTIP = `Click here to start deployment...`;
            
            if (!deploy_helpers.isNullOrUndefined(P.button)) {
                if (deploy_helpers.isObject<deploy_packages.PackageButton>(P.button)) {
                    buttonDesc = P.button;
                }
                else {
                    if (deploy_helpers.toBooleanSafe(P.button, true)) {
                        //TODO: translate
                        buttonDesc = {
                            text: DEFAULT_BTN_TEXT,
                            tooltip: DEFAULT_BTN_TOOLTIP,
                        };
                    }
                }
            }

            if (!buttonDesc) {
                continue;
            }

            if (!deploy_helpers.toBooleanSafe(buttonDesc.enabled, true)) {
                continue;
            }

            let newBtn: vscode.StatusBarItem;
            let newBtnCommand: vscode.Disposable;
            try {
                newBtn = await deploy_helpers.createButton(buttonDesc, async (b, pb) => {
                    const PACKAGE_TO_DEPLOY = P;
                    const PACKAGE_NAME = deploy_packages.getPackageName(PACKAGE_TO_DEPLOY);

                    const VALUES: deploy_values.Value[] = [
                        new deploy_values.StaticValue({
                                value: PACKAGE_NAME
                            },
                            'package'
                        ),
                        new deploy_values.FunctionValue(
                            () => ME.name,
                            'workspace'
                        ),
                        new deploy_values.FunctionValue(
                            () => Path.resolve(ME.folder.uri.fsPath),
                            'workspace_folder'
                        )
                    ];

                    let newCmdId = deploy_helpers.toStringSafe(pb.command);
                    if (deploy_helpers.isEmptyString(newCmdId)) {
                        newCmdId = `extension.deploy.reloaded.buttons.deployPackage${nextPackageButtonId++}`;
                    }

                    if ((await vscode.commands.getCommands()).indexOf(newCmdId) < 0) {
                        newBtnCommand = vscode.commands.registerCommand(newCmdId, async () => {
                            try {
                                await ME.deployPackage(PACKAGE_TO_DEPLOY);
                            }
                            catch (e) {
                                //TODO: translate
                                await ME.showErrorMessage(
                                    `Could not deploy package '${deploy_packages.getPackageName(PACKAGE_TO_DEPLOY)}': '${deploy_helpers.toStringSafe(e)}'`
                                );
                            }
                        });

                        deploy_log.CONSOLE
                                  .info(`Registrated command '${newCmdId}' for button of package '${PACKAGE_NAME}'.`,
                                        'workspaces.Workspace.reloadPackageButtons()');
                    }
                    else {
                        deploy_log.CONSOLE
                                  .warn(`Button of package '${PACKAGE_NAME}' will use the existing command '${newCmdId}'.`,
                                        'workspaces.Workspace.reloadPackageButtons()');
                    }

                    if (deploy_helpers.isEmptyString(b.text)) {
                        b.text = DEFAULT_BTN_TEXT;
                    }
                    else {
                        b.text = ME.replaceWithValues(b.text, VALUES);
                    }

                    if (deploy_helpers.isEmptyString(b.tooltip)) {
                        b.tooltip = DEFAULT_BTN_TOOLTIP;
                    }
                    else {
                        b.tooltip = ME.replaceWithValues(b.tooltip);
                    }

                    b.command = newCmdId;

                    ME._PACKAGE_BUTTONS.push({
                        button: b,
                        command: newBtnCommand,
                        package: PACKAGE_TO_DEPLOY,
                    });

                    b.show();
                });
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'workspaces.Workspace.reloadPackageButtons()');

                deploy_helpers.tryDispose(newBtn);
                deploy_helpers.tryDispose(newBtnCommand);
            }
        }
    }

    /**
     * Handles a file for "remove on change" feature.
     * 
     * @param {string} file The file to check.
     */
    protected async removeOnChange(file: string) {
        if (this.isRemoveOnChangeFreezed) {
            return;  // freezed
        }

        if (!deploy_helpers.toBooleanSafe(this.config.removeOnChange, true)) {
            return;  // deactivated
        }

        if (!deploy_helpers.isEmptyString(file)) {
            if (!this.isFileIgnored(file)) {
                await deploy_delete.removeOnChange
                                   .apply(this, arguments);
            }
        }
    }

    /**
     * Handles a value as string and replaces placeholders.
     * 
     * @param {any} val The value to parse.
     * @param {deploy_values.Value|deploy_values.Value[]|boolean} additionalValuesOrThrowOnError Additional values or if less than 3 arguments are defined: it
     *                                                                                           does the work of 'throwOnError'
     * @param {boolean} [throwOnError] Throw on error or not.
     * 
     * @return {string} The parsed value.
     */
    public replaceWithValues(val: any,
                             additionalValuesOrThrowOnError: deploy_values.Value | deploy_values.Value[] | boolean = true,
                             throwOnError = true) {
        if (deploy_helpers.isObject<deploy_values.Value>(additionalValuesOrThrowOnError) ||
            Array.isArray(additionalValuesOrThrowOnError)) {

            additionalValuesOrThrowOnError = deploy_helpers.asArray(additionalValuesOrThrowOnError);
            throwOnError = deploy_helpers.toBooleanSafe(throwOnError, true);
        }
        else {
            throwOnError = deploy_helpers.toBooleanSafe(additionalValuesOrThrowOnError, true) &&
                           deploy_helpers.toBooleanSafe(throwOnError, true);

            additionalValuesOrThrowOnError = [];
        }

        return deploy_values.replaceWithValues(this.getValues()
                                                   .concat(additionalValuesOrThrowOnError),
                                               val, throwOnError);
    }

    /**
     * Promise (and safe) version of 'vscode.window.showErrorMessage()' function.
     * 
     * @param {any} msg The message to display.
     * @param {TItem[]} [items] The optional items.
     * 
     * @return {Promise<TItem>} The promise with the selected item.
     */
    public async showErrorMessage<TItem extends vscode.MessageItem = vscode.MessageItem>(msg: any, ...items: TItem[]): Promise<TItem> {
        try {
            msg = deploy_helpers.toStringSafe(msg);

            return await vscode.window.showErrorMessage
                                      .apply(null, [ <any>`[vscode-deploy-reloaded]::[${this.name}] ${msg}`.trim() ].concat(items));
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.Workspace.showErrorMessage()');
        }
    }

    /**
     * Promise (and safe) version of 'vscode.window.showWarningMessage()' function.
     * 
     * @param {any} msg The message to display.
     * @param {TItem[]} [items] The optional items.
     * 
     * @return {Promise<TItem>} The promise with the selected item.
     */
    public async showWarningMessage<TItem extends vscode.MessageItem = vscode.MessageItem>(msg: any, ...items: TItem[]): Promise<TItem> {
        try {
            msg = deploy_helpers.toStringSafe(msg);

            return await vscode.window.showWarningMessage
                                      .apply(null, [ <any>`[vscode-deploy-reloaded]::[${this.name}] ${msg}`.trim() ].concat(items));
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.Workspace.showWarningMessage()');
        }
    }

    /**
     * Gets the start time.
     */
    public get startTime(): Moment.Moment {
        return this._startTime;
    }

    /**
     * Gets the states for 'sync when open'.
     */
    public get syncWhenOpenStates(): SyncWhenOpenStates {
        return this._syncWhenOpenStates;
    }

    /** @inheritdoc */
    public t(key: string, ...args: any[]): string {
        const TRANSLATOR = this._translator;
        if (TRANSLATOR) {
            let formatStr = TRANSLATOR(deploy_helpers.toStringSafe(key));
            formatStr = deploy_helpers.toStringSafe(formatStr);
    
            return deploy_helpers.formatArray(formatStr, args);
        }

        return key;
    }

    /**
     * Extracts the name and (relative) path from a file.
     * 
     * @param {string} file The file (path).
     * 
     * @return {deploy_contracts.WithNameAndPath|false} The extracted data or (false) if file path is invalid.
     */
    public toNameAndPath(file: string): deploy_contracts.WithNameAndPath | false {
        if (deploy_helpers.isEmptyString(file)) {
            return;
        }

        let workspaceDir = Path.resolve(this.folder.uri.fsPath);
        workspaceDir = deploy_helpers.replaceAllStrings(workspaceDir, Path.sep, '/');

        if (!Path.isAbsolute(file)) {
            file = Path.join(workspaceDir, file);
        }
        file = Path.resolve(file);
        file = deploy_helpers.replaceAllStrings(file, Path.sep, '/');

        if (!file.startsWith(workspaceDir)) {
            return false;
        }

        const NAME = Path.basename(file);

        let relativePath = Path.dirname(file).substr(workspaceDir.length);
        while (relativePath.startsWith('/')) {
            relativePath = relativePath.substr(1);
        }
        while (relativePath.endsWith('/')) {
            relativePath = relativePath.substr(0, relativePath.length - 1);
        }

        if ('' === relativePath.trim()) {
            relativePath = '';
        }

        return {
            name: NAME,
            path: relativePath,
        };
    }

    /**
     * Converts to a full path.
     * 
     * @param {string} path The path to convert.
     * 
     * @return {string|false} The pull path or (false) if 'path' could not be converted.
     */
    public toFullPath(path: string): string | false {
        const RELATIVE_PATH = this.toRelativePath(path);
        if (false === RELATIVE_PATH) {
            return false;
        }

        return Path.resolve(
            Path.join(
                this.folder.uri.fsPath,
                RELATIVE_PATH
            )
        );
    }

    /**
     * Converts to a relative path.
     * 
     * @param {string} path The path to convert.
     * 
     * @return {string|false} The relative path or (false) if 'path' could not be converted.
     */
    public toRelativePath(path: string): string | false {
        path = deploy_helpers.toStringSafe(path);

        path = deploy_helpers.replaceAllStrings(
            Path.resolve(path),
            Path.sep,
            '/'
        );

        const WORKSPACE_DIR = deploy_helpers.replaceAllStrings(
            Path.resolve(this.folder.uri.fsPath),
            Path.sep,
            '/'
        );

        if (!path.startsWith(WORKSPACE_DIR)) {
            return false;
        }

        let relativePath = path.substr(WORKSPACE_DIR.length);
        while (relativePath.startsWith('/')) {
            relativePath = relativePath.substr(1);
        }
        while (relativePath.endsWith('/')) {
            relativePath = relativePath.substr(0, relativePath.length - 1);
        }

        return relativePath;
    }
}
