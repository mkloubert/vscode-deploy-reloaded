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

 
import * as ChildProcess from 'child_process';
import * as Crypto from 'crypto';
import * as deploy_code from './code';
import * as deploy_commands from './commands';
import * as deploy_contracts from './contracts';
import * as deploy_delete from './delete';
import * as deploy_deploy from './deploy';
import * as deploy_download from './download';
import * as deploy_git from './git';
import * as deploy_gui from './gui';
import * as deploy_helpers from './helpers';
import * as deploy_list from './list';
import * as deploy_log from './log';
import * as deploy_mappings from './mappings';
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
import * as Events from 'events';
import * as Glob from 'glob';
import * as i18 from './i18';
import * as i18next from 'i18next';
const MergeDeep = require('merge-deep');
import * as Moment from 'moment';
import * as OS from 'os';
import * as Path from 'path';
import * as vscode from 'vscode';


interface PackageWithButton {
    readonly button: vscode.StatusBarItem;
    readonly command: vscode.Disposable;
    readonly package: deploy_packages.Package;
}

interface SwitchStateRepoWithCollection {
    readonly collection: SwitchStateRepositoryCollection;
    readonly repository: SwitchStateRepository;
}

type SwitchStateRepository = deploy_contracts.KeyValuePairs<string>;

type SwitchStateRepositoryCollection = deploy_contracts.KeyValuePairs<SwitchStateRepository>;

/**
 * A 'switch' target.
 */
export interface SwitchTarget extends deploy_targets.Target {
    /**
     * A button for the switch.
     */
    readonly button?: deploy_contracts.Button | boolean | string;

    /**
     * One or more options for the switch.
     */
    readonly options: SwitchTargetOptionValue | SwitchTargetOptionValue[];
}

/**
 * An option entry for of a switch target.
 */
export interface SwitchTargetOption extends deploy_targets.TargetProvider {
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the ID of that option.
     */
    readonly __id: any;
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * The zero-based index.
     */
    readonly __index: number;

    /**
     * The description.
     */
    readonly description?: string;
    /**
     * Is default or not.
     */
    readonly isDefault?: boolean;
    /**
     * The (display) name.
     */
    readonly name?: string;
}

/**
 * A switch option value.
 */
export type SwitchTargetOptionValue = SwitchTargetOption | string;

/**
 * Object that stores the states for 'sync when open'.
 */
export type SyncWhenOpenStates = { [ key: string ]: Moment.Moment };

interface TargetWithButton<TTarget = deploy_targets.Target> {
    readonly button: vscode.StatusBarItem;
    readonly command: vscode.Disposable;
    readonly settings: deploy_contracts.Button;
    readonly target: TTarget;
}

/**
 * A workspace context.
 */
export interface WorkspaceContext {
    /**
     * The repository of commands.
     */
    readonly commands: deploy_commands.WorkspaceCommandRepository;
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
 * A function that provides workspaces.
 * 
 * @return {Workspace|Workspace[]} The workspace(s).
 */
export type WorkspaceProvider = () => Workspace | Workspace[];

/**
 * Workspace settings.
 */
export interface WorkspaceSettings extends deploy_contracts.Configuration {
}


let activeWorkspaceProvider: WorkspaceProvider;
const FILES_CHANGES: { [path: string]: deploy_contracts.FileChangeType } = {};
const KEY_WORKSPACE_USAGE = 'vscdrLastExecutedWorkspaceActions';
let nextPackageButtonId = Number.MIN_SAFE_INTEGER;
let nextSwitchButtonId = Number.MIN_SAFE_INTEGER;
const SWITCH_STATE_REPO_COLLECTION_KEY = 'SwitchStates';

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
    private _gitFolder: string | false;
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
    private _OLD_ENV_VARS: deploy_contracts.KeyValuePairs = {};
    private _PACKAGE_BUTTONS: PackageWithButton[] = [];
    private _packages: deploy_packages.Package[];
    private _rootPath: string | false;
    private _selectedSwitches: deploy_contracts.KeyValuePairs;
    /**
     * Stores the start time.
     */
    protected _startTime: Moment.Moment;
    private readonly _SWITCH_BUTTONS: TargetWithButton<SwitchTarget>[] = [];
    private _targets: deploy_targets.Target[];
    /**
     * The current translation function.
     */
    protected _translator: i18next.TranslationFunction;
    private _workspaceSessionState: deploy_contracts.KeyValuePairs;

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

        this.state = new WorkspaceMemento(this,
                                          context.extension.workspaceState);
    }

    /**
     * Applies values to an object.
     * 
     * @param {TObj} obj The object to apply the values to.
     * 
     * @return {TObj} The new object.
     */
    public applyValuesTo<TObj extends deploy_values.Applyable = deploy_values.Applyable>(obj: TObj): TObj {
        const ME = this;
        
        return deploy_values.applyValuesTo(
            obj,
            () => ME.getValues(),
        );
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
                return WORKSPACE.rootPath === this.rootPath;
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

    /**
     * Lets the user change the option of a switch.
     * 
     * @param {SwitchTarget} target The target.
     */
    public async changeSwitchButtonOption(target: SwitchTarget) {
        const ME = this;
        
        if (!ME.canBeHandledByMe(target)) {
            return;
        }

        const MY_ID = deploy_helpers.toStringSafe(ME.id);
        const TARGET_ID = deploy_helpers.toStringSafe(target.__id);
        const TARGET_NAME = deploy_targets.getTargetName(target);

        const SWITCH_REPO = ME.getSwitchRepository();

        const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = ME.getAllSwitchOptions(target).map(o => {
            const OPTION_ID = deploy_helpers.toStringSafe(o.__id);
            const LABEL = ME.getSwitchOptionName(o);
            const DESCRIPTION = deploy_helpers.toStringSafe(o.description).trim();

            return {
                action: async () => {
                    SWITCH_REPO.repository[TARGET_ID] = OPTION_ID;
                },
                description: DESCRIPTION,
                label: LABEL,
            };
        });

        if (QUICK_PICKS.length < 1) {
            ME.showWarningMessage(
                ME.t('plugins.switch.noOptionsDefined',
                     TARGET_NAME)
            );

            return;
        }

        let selectedItem: deploy_contracts.ActionQuickPick;
        if (1 === QUICK_PICKS.length) {
            selectedItem = QUICK_PICKS[0];
        }
        else {
            selectedItem = await vscode.window.showQuickPick(
                QUICK_PICKS,
                {
                    placeHolder: ME.t('plugins.switch.selectOption',
                                      TARGET_NAME),
                }
            );
        }

        if (!selectedItem) {
            return;
        }

        await Promise.resolve(
            selectedItem.action()
        );

        SWITCH_REPO.collection[MY_ID] = SWITCH_REPO.repository;
        await ME.state.update(SWITCH_STATE_REPO_COLLECTION_KEY,
                              SWITCH_REPO.collection);

        await ME.updateSwitchButtons();
    }

    private async checkForRequiredExtensions(loadedCfg: WorkspaceSettings) {
        if (!loadedCfg) {
            return true;
        }

        const REQUIRED_EXTENSIONS = loadedCfg.requiredExtensions;
        if (!deploy_helpers.isObject(REQUIRED_EXTENSIONS)) {
            return true;
        }

        const ALL_EXTENSIONS = vscode.extensions.all.map(e => {
            return deploy_helpers.normalizeString(e);
        });
        for (const EXT in REQUIRED_EXTENSIONS) {
            const EXTENSION_ID = deploy_helpers.toStringSafe(EXT).trim();
            if ('' === EXTENSION_ID) {
                continue;
            }

            const OPEN_IN_MARKETPLACE = () => {
                deploy_helpers.open(`https://marketplace.visualstudio.com/items?itemName=${encodeURIComponent(EXTENSION_ID)}`).then(() => {
                }, (err) => {
                    deploy_log.CONSOLE
                              .trace(err, 'workspaces.Workspace.checkForRequiredExtensions().OPEN_IN_MARKETPLACE()');
                });
            };

            let settings = REQUIRED_EXTENSIONS[EXT];
            if (!deploy_helpers.isObject<deploy_contracts.RequiredExtensionSettings>(settings)) {
                settings = {
                    isMustHave: deploy_helpers.toBooleanSafe(settings),
                };
            }

            if (deploy_helpers.filterPlatformItems(settings).length < 1) {
                continue;  // not for platform
            }
            if (deploy_helpers.filterConditionalItems(settings).length < 1) {
                continue;  // condition failed
            }

            if (ALL_EXTENSIONS.indexOf(EXTENSION_ID.toLowerCase()) > -1) {
                // found
                continue;
            }

            if (deploy_helpers.toBooleanSafe(settings.isMustHave)) {
                // must be installed

                const SELECTED_ITEM = await this.showErrorMessage<deploy_contracts.MessageItemWithValue>(
                    i18.t('requirements.extensions.mustBeInstalled',
                          EXTENSION_ID),
                    {
                        isCloseAffordance: true,
                        title: i18.t('requirements.extensions.openInMarketplace'),
                        value: 0,
                    },
                );

                if (SELECTED_ITEM) {
                    if (0 === SELECTED_ITEM.value) {
                        OPEN_IN_MARKETPLACE();
                    }
                }
                
                return false;
            }

            const SELECTED_ITEM = await this.showWarningMessage<deploy_contracts.MessageItemWithValue>(
                i18.t('requirements.extensions.shouldBeInstalled',
                      EXTENSION_ID),
                {
                    isCloseAffordance: true,
                    title: i18.t('requirements.extensions.openInMarketplace'),
                    value: 0,
                },
                {
                    title: i18.t('continue'),
                    value: 1,
                }
            );

            if (SELECTED_ITEM) {
                if (0 === SELECTED_ITEM.value) {
                    OPEN_IN_MARKETPLACE();

                    return false;
                }
            }
        }

        return true;
    }

    private async checkForRequirements(loadedCfg: WorkspaceSettings) {
        if (loadedCfg) {
            const CHECK_FOR_REQUIREMENTS = deploy_helpers.asArray(
                loadedCfg.checkForRequirements
            );

            let index = -1;
            const GET_CONDITION_NAME = (settings: deploy_contracts.CheckForRequirementsSettings) =>
            {
                let name = deploy_helpers.toStringSafe(settings.name);
                if ('' === name) {
                    name = i18.t('requirements.conditions.defaultName',
                                 index + 1);
                }

                return name;
            };
            
            for (const R of CHECK_FOR_REQUIREMENTS) {
                ++index;

                let settings = R;
                if (!deploy_helpers.isObject<deploy_contracts.CheckForRequirementsSettings>(settings)) {
                    settings = {
                        condition: deploy_helpers.toStringSafe(settings),
                    };
                }

                if (deploy_helpers.filterPlatformItems(settings).length < 1) {
                    continue;  // not for platform
                }

                const CONDITION: deploy_contracts.ConditionalItem = {
                    if: settings.condition,
                };
                if (deploy_helpers.filterConditionalItems(CONDITION).length > 0) {
                    continue;  // does match
                }

                const NAME = GET_CONDITION_NAME(settings);

                if (deploy_helpers.toBooleanSafe(settings.isMustHave)) {
                    // must match
    
                    const SELECTED_ITEM = await this.showErrorMessage<deploy_contracts.MessageItemWithValue>(
                        i18.t('requirements.conditions.mustMatch',
                              NAME),
                        {
                            isCloseAffordance: true,
                            title: i18.t('cancel'),
                            value: 0,
                        },
                    );

                    return false;
                }

                const SELECTED_ITEM = await this.showWarningMessage<deploy_contracts.MessageItemWithValue>(
                    i18.t('requirements.conditions.shouldMatch',
                          NAME),
                    {
                        isCloseAffordance: true,
                        title: i18.t('cancel'),
                        value: 0,
                    },
                    {
                        title: i18.t('continue'),
                        value: 1,
                    }
                );
    
                if (SELECTED_ITEM) {
                    if (0 === SELECTED_ITEM.value) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    private cleanupPackageButtons() {
        while (this._PACKAGE_BUTTONS.length > 0) {
            const PBTN = this._PACKAGE_BUTTONS.shift();

            deploy_helpers.tryDispose(PBTN.button);
            deploy_helpers.tryDispose(PBTN.command);
        }
    }

    private cleanupSwitchButtons() {
        while (this._SWITCH_BUTTONS.length > 0) {
            const SB = this._SWITCH_BUTTONS.shift();

            deploy_helpers.tryDispose(SB.button);
            deploy_helpers.tryDispose(SB.command);
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
     * Creates a new git client (if possible).
     * 
     * @return {Promise<deploy_git.GitClient|false>} The promise with the client or (false) if not found.
     */
    public async createGitClient(): Promise<deploy_git.GitClient | false> {
        try {
            const GIT = await deploy_git.tryFindGitPath();
            if (false !== GIT) {
                let gitCwd = this.gitFolder;
                if (false === gitCwd) {
                    gitCwd = this.rootPath;
                }
                
                return new deploy_git.GitClient(GIT,
                                                gitCwd);
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.Workspace.createGitClient()');
        }

        return false;
    }

    private createWorkspaceSessionState(newCfg: WorkspaceSettings) {
        const NEW_SESSION_STATE: deploy_contracts.KeyValuePairs = {};
        
        NEW_SESSION_STATE['commands'] = {};
        NEW_SESSION_STATE['commands']['events'] = new Events.EventEmitter();

        NEW_SESSION_STATE['pull'] = {};
        NEW_SESSION_STATE['pull']['events'] = new Events.EventEmitter();
        NEW_SESSION_STATE['pull']['states'] = {};
        NEW_SESSION_STATE['pull']['states']['global'] = {};
        NEW_SESSION_STATE['pull']['states']['data_transformers'] = {};

        NEW_SESSION_STATE['sync'] = {};
        NEW_SESSION_STATE['sync']['whenOpen'] = {};
        NEW_SESSION_STATE['sync']['whenOpen']['states'] = {};

        NEW_SESSION_STATE['upload'] = {};
        NEW_SESSION_STATE['upload']['events'] = new Events.EventEmitter();
        NEW_SESSION_STATE['upload']['states'] = {};
        NEW_SESSION_STATE['upload']['states']['global'] = {};
        NEW_SESSION_STATE['upload']['states']['data_transformers'] = {};

        NEW_SESSION_STATE['target_operations'] = {};
        NEW_SESSION_STATE['target_operations']['http'] = {};
        NEW_SESSION_STATE['target_operations']['http']['events'] = new Events.EventEmitter();
        NEW_SESSION_STATE['target_operations']['http']['global'] = {};
        NEW_SESSION_STATE['target_operations']['http']['body_scripts'] = {};
        NEW_SESSION_STATE['target_operations']['script'] = {};
        NEW_SESSION_STATE['target_operations']['script']['events'] = new Events.EventEmitter();
        NEW_SESSION_STATE['target_operations']['script']['global'] = {};
        NEW_SESSION_STATE['target_operations']['script']['scripts'] = {};

        return NEW_SESSION_STATE;
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
     * Deploys a files of a git commit.
     * 
     * @param {deploy_targets.Target} target The target to deploy to. 
     */
    public async deployGitCommit(target: deploy_targets.Target) {
        if (!this.canBeHandledByMe(target)) {
            return;
        }
        
        const GIT = await this.createGitClient();
        if (!GIT) {
            return;
        }

        await deploy_deploy.deployScmCommit
                           .apply(this, [ GIT, target ]);
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
     * Gets the root path of the editor.
     */
    public get editorRootPath() {
        return Path.resolve(
            this.folder.uri.fsPath,
        );
    }

    /**
     * Executes something for that workspace.
     * 
     * @param {string} command The thing / command to execute. 
     * @param {ChildProcess.ExecOptions} [opts] Custom options.
     * 
     * @return {Promise<ExecResult>} The promise with the result.
     */
    public async exec(command: string, opts?: ChildProcess.ExecOptions) {
        const DEFAULT_OPTS: ChildProcess.ExecOptions = {
            cwd: this.rootPath,  
        };

        return await deploy_helpers.exec(
            command,
            MergeDeep(DEFAULT_OPTS, opts),
        );
    }

    private async executeOnStartup(cfg: WorkspaceSettings) {
        if (!cfg) {
            return;
        }

        const ME = this;

        const SHELL_COMMANDS = deploy_helpers.asArray(
            cfg.executeOnStartup
        ).map(sc => {
            if (!deploy_helpers.isObject<deploy_contracts.ShellCommandSettings>(sc)) {
                sc = {
                    command: deploy_helpers.toStringSafe(sc),
                };
            }

            return sc;
        });

        for (let sc of SHELL_COMMANDS) {
            sc = Enumerable.from( ME.filterConditionalItems(sc, true) )
                           .singleOrDefault(null);
            if (!sc) {
                continue;
            }

            let shellCmdToExecute = deploy_helpers.toStringSafe(sc.command);
            if (!deploy_helpers.toBooleanSafe(sc.noPlaceHolders)) {
                shellCmdToExecute = ME.replaceWithValues(shellCmdToExecute);
            }

            if (deploy_helpers.isEmptyString(shellCmdToExecute)) {
                continue;
            }

            // display name
            let name = deploy_helpers.toStringSafe(
                ME.replaceWithValues(
                    sc.name
                )
            ).trim();
            if ('' === name) {
                name = shellCmdToExecute;
            }

            // working directory
            let cwd = ME.replaceWithValues(sc.cwd);
            if (deploy_helpers.isEmptyString(cwd)) {
                cwd = this.rootPath;
            }
            if (!Path.isAbsolute(cwd)) {
                cwd = Path.join(this.rootPath, cwd);
            }
            cwd = Path.resolve(cwd);

            const IGNORE_IF_FAIL = deploy_helpers.toBooleanSafe(sc.ignoreIfFail);

            ME.context.outputChannel.appendLine('');
            ME.context.outputChannel.append(
                ME.t('shell.executing',
                     name) + ' '
            );
            try {
                await ME.exec(shellCmdToExecute, {
                    cwd: cwd,
                });

                ME.context.outputChannel.appendLine(
                    `[${ME.t('ok')}]`
                );
            }
            catch (e) {
                ME.context.outputChannel.appendLine(
                    `[${ME.t('error', e)}]`
                );
                
                if (!IGNORE_IF_FAIL) {
                    throw e;
                }
            }
        }
    }

    private async executeStartupCommands() {
        const ME = this;

        const CFG = ME.config;

        try {
            for (let cmd of deploy_helpers.asArray(CFG.startupCommands)) {
                if (!deploy_helpers.isObject<deploy_contracts.StartupCommand>(cmd)) {
                    cmd = {
                        command: cmd,
                    };
                }

                const CMD_ID = deploy_helpers.toStringSafe(cmd.command);
                if (deploy_helpers.isEmptyString(CMD_ID)) {
                    continue;
                }

                try {
                    let args: any[];
                    if (deploy_helpers.isNullOrUndefined(cmd.arguments)) {
                        args = [];
                    }
                    else {
                        args = deploy_helpers.asArray(cmd.arguments, false);
                    }

                    await vscode.commands.executeCommand
                                         .apply(null, [ <any>CMD_ID ].concat(args));
                }
                catch (e) {
                    await ME.showErrorMessage(
                        ME.t('commands.executionError',
                             CMD_ID, e)
                    );
                }
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.Workspace.executeStartupCommands()');
        }
    }

    /**
     * Filters items with 'if' code.
     * 
     * @param {TItem | TItem[]} items The items to filter.
     * @param {boolean} [throwOnError] Throw on error or not. 
     * @param {any} [errorResult] The custom result when an error occurred.
     * 
     * @return {TItem[]} The filtered items.
     */
    public filterConditionalItems<TItem extends deploy_contracts.ConditionalItem = deploy_contracts.ConditionalItem>(
        items: TItem | TItem[],
        throwOnError = false,
        errorResult: any = false,
    ) {
        const ME = this;

        items = deploy_helpers.asArray(items);
        throwOnError = deploy_helpers.toBooleanSafe(throwOnError);

        return items.filter(i => {
            return Enumerable.from( deploy_helpers.asArray(i.if) ).all(c => {
                let res: any;

                try {
                    const IF_CODE = deploy_helpers.toStringSafe(c);
                    if (!deploy_helpers.isEmptyString(IF_CODE)) {
                        res = deploy_code.exec({
                            code: IF_CODE,
                            context: {
                                i: i,
                                ws: ME,
                            },
                            values: ME.getValues(),
                        });
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'workspaces.Workspace.filterConditionalItems()');

                    if (throwOnError) {
                        throw e;
                    }

                    return errorResult;
                }
                
                return deploy_helpers.toBooleanSafe(res, true);
            });
        });
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
            cwd: this.rootPath,
            ignore: exclude,
            root: this.rootPath,
        };

        return await deploy_helpers.glob(patterns,
                                         MergeDeep(DEFAULT_OPTS, opts));
    }

    /**
     * Returns all directories of that workspace.
     * 
     * @return {Promise<string[]>} The promise with the directories.
     */
    public async getAllDirectories() {
        return Enumerable.from(
            await scanForDirectoriesRecursive(this.rootPath, true)
        ).orderBy(d => {
            return deploy_helpers.normalizeString(
                Path.dirname(d)
            );
        }).thenBy(d => {
            return deploy_helpers.normalizeString(
                Path.basename(d)
            );
        }).toArray();
    }

    private getAllSwitchOptions(target: SwitchTarget): SwitchTargetOption[] {
        if (!target) {
            return <any>target;
        }
    
        return deploy_helpers.asArray(target.options).map((o, i) => {
            o = deploy_helpers.cloneObject(o);
            if (!deploy_helpers.isObject<SwitchTargetOption>(o)) {
                o = {
                    __id: undefined,
                    __index: undefined,
    
                    targets: deploy_helpers.asArray(o)
                                           .map(tn => deploy_helpers.normalizeString(tn))
                                           .filter(tn => '' !== tn),
                };
            }
    
            (<any>o)['__id'] = `${target.__id}\n` + 
                               `${i}`;
            (<any>o)['__index'] = i;
    
            return o;
        });
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
        const ME = this;

        path = deploy_helpers.toStringSafe(path);
        
        if (!Path.isAbsolute(path)) {
            const SCOPES = ME.getSettingScopes();

            const FROM_HOMEDIR = Path.resolve(
                Path.join(SCOPES[0], path)  // SCOPES[0] => home directory
            );
            if (await deploy_helpers.exists(FROM_HOMEDIR)) {
                return FROM_HOMEDIR;
            }

            const FROM_SETTINGS = Path.resolve(
                Path.join(SCOPES[1], path)  // SCOPES[1] => settings folder
            );
            if (await deploy_helpers.exists(FROM_SETTINGS)) {
                return FROM_SETTINGS;
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
     * @param {string|string[]} dirs One or more scope directories.
     * 
     * @return {deploy_contracts.WithNameAndPath|false} The object or (false) if not possible.
     */
    public getNameAndPathForFileDeployment(target: deploy_targets.Target,
                                           file: string,
                                           dirs: string | string[]): deploy_contracts.WithNameAndPath | false {
        const ME = this;
        
        dirs = deploy_helpers.asArray(dirs);
        
        if (!ME.canBeHandledByMe(target)) {
            return false;
        }

        if (ME.isFileIgnored(file)) {
            return false;
        }

        let relPath = ME.toRelativePath(file);
        if (false === relPath) {
            return false;
        }

        const TO_MINIMATCH = (str: string) => {
            str = deploy_helpers.toStringSafe(str);
            if (!str.startsWith('/')) {
                str = '/' + str;
            }

            return str;
        };

        let name = Path.basename(relPath);
        let path = Path.dirname(relPath);
        let pathSuffix = '';
        
        const MAPPINGS = target.mappings;
        if (MAPPINGS) {
            for (const P in MAPPINGS) {
                let settings = MAPPINGS[P];
                if (deploy_helpers.isNullOrUndefined(settings)) {
                    continue;
                }

                if (!deploy_helpers.isObject<deploy_mappings.FolderMappingSettings>(settings)) {
                    settings = {
                        to: deploy_helpers.toStringSafe(settings),
                    };
                }

                const PATTERN = TO_MINIMATCH(P);
                const PATH_TO_CHECK = TO_MINIMATCH(relPath);
                
                if (deploy_helpers.doesMatch(PATH_TO_CHECK, PATTERN)) {
                    const DIR_NAME = Path.dirname(<string>relPath);

                    const MATCHING_DIRS = <string[]>dirs.map(d => {
                        return ME.toRelativePath(d);
                    }).filter(d => false !== d).filter((d: string) => {
                        return d === DIR_NAME || 
                               DIR_NAME.startsWith(d + '/');
                    }).sort((x, y) => {
                        return deploy_helpers.compareValuesBy(x, y,
                                                              (d: string) => d.length);
                    });

                    if (MATCHING_DIRS.length > 0) {
                        pathSuffix = DIR_NAME.substr(
                            MATCHING_DIRS[0].length
                        );
                    }

                    path = deploy_helpers.normalizeString(settings.to);
                    break;
                }
            }
        }                                   

        return {
            name: name,
            path: deploy_helpers.normalizePath(
                Path.join(
                    '/' +
                    deploy_helpers.normalizePath(path) + 
                    '/' + 
                    deploy_helpers.normalizePath(pathSuffix)
                )
            ),
        };
    }

    private async getAllDirectoriesInner(dir: string) {
        const RESULT: string[] = [];

        const FILES_AND_FOLDERS = await deploy_helpers.readDir(dir);
        for (const FF of FILES_AND_FOLDERS) {
            const FULL_PATH = Path.resolve(
                Path.join( dir, FF )
            );
            const STATS = await deploy_helpers.lstat(FULL_PATH);

            if (STATS.isDirectory()) {
                RESULT.push(FULL_PATH);

                RESULT.push
                      .apply(RESULT, await this.getAllDirectoriesInner(FULL_PATH));
            }
        }

        return RESULT;
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
        let packages = this._packages;

        packages = this.filterConditionalItems(
            packages
        );

        return packages;
    }

    /**
     * Returns the selected option of a switch (target),
     * 
     * @param {SwitchTarget} target The target.
     * 
     * @return {SwitchTargetOption|false} The option or (false) if not found.
     */
    public getSelectedSwitchOption(target: SwitchTarget): SwitchTargetOption | false {
        const ME = this;

        const MY_ID = deploy_helpers.toStringSafe(ME.id);

        if (ME.canBeHandledByMe(target)) {
            const ALL_OPTIONS = ME.getAllSwitchOptions(target);
            if (ALL_OPTIONS.length > 0) {
                const SWITCH_REPO = ME.getSwitchRepository();
                const TARGET_ID = deploy_helpers.toStringSafe(target.__id);

                const SELECTED_TARGET_OPTION_ID = SWITCH_REPO.repository[TARGET_ID];

                return Enumerable.from(ALL_OPTIONS).orderBy(o => {
                    if (deploy_helpers.toStringSafe(o.__id) === SELECTED_TARGET_OPTION_ID) {
                        return Number.MIN_SAFE_INTEGER;
                    }

                    if (deploy_helpers.toBooleanSafe(o.isDefault)) {
                        return 0;
                    }

                    return Number.MAX_SAFE_INTEGER;
                }).first();
            }
        }
        
        return false;
    }

    /**
     * Returns the scope directories for settings.
     * 
     * @return {string[]} The list of scope directories.
     */
    public getSettingScopes(): string[] {
        return [
            Path.resolve(
                Path.join(OS.homedir(), deploy_contracts.HOMEDIR_SUBFOLDER)
            ),
            this.settingFolder,
        ];
    }

    private getSwitchOptionName(option: SwitchTargetOption): string {
        if (!option) {
            return <any>option;
        }
    
        let name = deploy_helpers.toStringSafe(option.name).trim();
        if ('' === name) {
            name = this.t('plugins.switch.defaultOptionName',
                          option.__index + 1);
        }
    
        return name;
    }

    private getSwitchRepository(): SwitchStateRepoWithCollection {
        const MY_ID = deploy_helpers.toStringSafe(this.id);

        const REPO_COLL = this.state.get<SwitchStateRepositoryCollection>(SWITCH_STATE_REPO_COLLECTION_KEY) || {};
        const REPO = REPO_COLL[MY_ID] || {};

        return {
            collection: REPO_COLL,
            repository: REPO,
        };
    }

    /**
     * Returns a list of all available 'switch' targets of that workspace.
     * 
     * @return {SwitchTarget[]} The targets.
     */
    public getSwitchTargets(): SwitchTarget[] {
        return <any>this.getTargets().filter(t => {
            return isSwitchTarget(t);
        });
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
        let targets = this._targets;

        targets = this.filterConditionalItems(
            targets
        );

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
     * Returns the children of a switch target.
     * 
     * @param {SwitchTarget} switchTarget The switch target.
     * 
     * @return {deploy_targets.Target[]|false} The targets or (false) if failed.
     */
    public getTargetsOfSwitch(switchTarget: SwitchTarget): deploy_targets.Target[] | false {
        const ME = this;

        const OPTION = ME.getSelectedSwitchOption(switchTarget);
        if (false === OPTION) {
            ME.showWarningMessage(
                ME.t('plugins.switch.noOptionSelected2')
            );

            return false;
        }

        const TARGETS = deploy_targets.getTargetsByName(
            OPTION.targets,
            ME.getTargets(),
        );
        if (false === TARGETS) {
            return false;
        }

        deploy_targets.throwOnRecurrence(
            switchTarget, TARGETS
        );

        return TARGETS;
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
        const ME = this;
        const CFG = ME.config;
        
        let values: deploy_values.Value[] = [];

        // pre defined values
        values = values.concat(
            deploy_values.getPredefinedValues()
        );

        // ${editorRoot}
        values.push(new deploy_values.FunctionValue(() => {
            return ME.editorRootPath;
        }, 'editorRoot'));

        // ${workspace}
        values.push(new deploy_values.FunctionValue(() => {
            return ME.name;
        }, 'workspace'));

        // ${workspaceRoot}
        values.push(new deploy_values.FunctionValue(() => {
            return ME.rootPath;
        }, 'workspaceRoot'));

        // process's environment variables
        try {
            let importEnvVars = true;
            if (CFG.env) {
                importEnvVars = deploy_helpers.toBooleanSafe(CFG.env.importVarsAsPlaceholders, true);
            }

            if (importEnvVars) {
                values = values.concat( deploy_values.getEnvVars() );
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.Workspace.getValues(1)');
        }

        const WORKSPACE_VALUES = values.map(v => v);

        values = values.concat(
            deploy_values.loadFromItems(CFG, {
                conditialFilter: (i, o) => {
                    let doesMatch: any;
    
                    try {
                        doesMatch = Enumerable.from( deploy_helpers.asArray(i.if) ).all(c => {
                            let res: any;
                            
                            const IF_CODE = deploy_helpers.toStringSafe(c);
                            if (!deploy_helpers.isEmptyString(IF_CODE)) {
                                res = deploy_code.exec({
                                    code: IF_CODE,
                                    context: {
                                        i: i,
                                        ws: ME,
                                    },
                                    values: WORKSPACE_VALUES.concat(o),
                                });
                            }
    
                            return deploy_helpers.toBooleanSafe(res, true);
                        });
                    }
                    catch (e) {
                        deploy_log.CONSOLE
                                  .trace('workspaces.Workspace.getValues(2)');
    
                        doesMatch = false;
                    }
    
                    return doesMatch;
                },

                directoryScopeProvider: () => {
                    return ME.getSettingScopes();
                },

                prefixValuesProvider: () => {
                    return WORKSPACE_VALUES;
                },
            })
        );

        return values;
    }

    /**
     * Gets the path to the '.git' folder (if available).
     */
    public get gitFolder() {
        return this._gitFolder;
    }

    /**
     * Global data as defined in the settings.
     */
    public get globals(): any {
        return deploy_helpers.cloneObject(this.config.globals);
    }

    private async initComposer(cfg: WorkspaceSettings) {
        if (!cfg) {
            return;
        }

        if (!deploy_helpers.toBooleanSafe(cfg.initComposer)) {
            return;
        }

        const ME = this;

        try {
            const COMPOSER_JSON = Path.resolve(
                Path.join(
                    ME.rootPath, 'composer.json',
                )
            );

            const VENDOR = Path.resolve(
                Path.join(
                    ME.rootPath, 'vendor',
                )
            );

            if (!(await deploy_helpers.exists(COMPOSER_JSON))) {
                return;  // no 'composer.json'
            }

            if (await deploy_helpers.exists(VENDOR)) {
                return;  // 'vendor' already exist
            }

            ME.context.outputChannel.appendLine('');
            ME.context.outputChannel.append(
                ME.t('workspaces.composer.install.running',
                     ME.rootPath) + ' '
            );
            try {
                await ME.exec('composer install');

                ME.context.outputChannel.appendLine(
                    `[${ME.t('ok')}]`
                );
            }
            catch (e) {
                ME.context.outputChannel.appendLine(
                    `[${ME.t('error', e)}]`
                );
            }
        }
        catch (e) {
            ME.showErrorMessage(
                ME.t('workspaces.composer.install.errors.failed',
                     e)
            );
        }
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

        ME._rootPath = false;

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
                              .trace(e, 'workspaces.Workspace.initialize(1)');
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
            else {
                this._rootPath = Path.resolve(
                    Path.join(
                        Path.dirname(settingsData.file),
                        '..'
                    )
                );
            }

            ME._configSource = {
                section: settingsData.section,
                resource: vscode.Uri.file(settingsData.file),
            };
        }

        // git folder
        {
            ME._gitFolder = false;

            let searchForNextFolder: (dir: string) => Promise<string | false>;
            searchForNextFolder = async (dir) => {
                try {
                    dir = Path.resolve(dir);

                    const GIT_FOLDER = Path.resolve(
                        Path.join(dir, '.git')
                    );

                    if (await deploy_helpers.exists(GIT_FOLDER)) {
                        if ((await deploy_helpers.lstat(GIT_FOLDER)).isDirectory()) {
                            return GIT_FOLDER;  // found
                        }
                    }

                    const PARENT_DIR = Path.resolve(
                        Path.join(dir, '../')
                    );
                    if (dir !== PARENT_DIR && !deploy_helpers.isEmptyString(PARENT_DIR)) {
                        return await searchForNextFolder(PARENT_DIR);
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'workspaces.Workspace.initialize(2)');
                }

                return false;
            };

            ME._gitFolder = await searchForNextFolder(
                ME.folder.uri.fsPath
            );
        }

        await ME.reloadConfiguration();

        ME._startTime = Moment();
        ME._isInitialized = true;

        return true;
    }

    private async initNodeModules(cfg: WorkspaceSettings) {
        if (!cfg) {
            return;
        }

        if (!deploy_helpers.toBooleanSafe(cfg.initNodeModules)) {
            return;
        }

        const ME = this;

        try {
            const PACKAGE_JSON = Path.resolve(
                Path.join(
                    ME.rootPath, 'package.json',
                )
            );

            const NODE_MODULES = Path.resolve(
                Path.join(
                    ME.rootPath, 'node_modules',
                )
            );

            if (!(await deploy_helpers.exists(PACKAGE_JSON))) {
                return;  // no 'package.json'
            }

            if (await deploy_helpers.exists(NODE_MODULES)) {
                return;  // 'node_modules' already exist
            }

            ME.context.outputChannel.appendLine('');
            ME.context.outputChannel.append(
                ME.t('workspaces.npm.install.running',
                     ME.rootPath) + ' '
            );
            try {
                await ME.exec('npm install');

                ME.context.outputChannel.appendLine(
                    `[${ME.t('ok')}]`
                );
            }
            catch (e) {
                ME.context.outputChannel.appendLine(
                    `[${ME.t('error', e)}]`
                );
            }
        }
        catch (e) {
            ME.showErrorMessage(
                ME.t('workspaces.npm.install.errors.failed',
                     e)
            );
        }
    }

    /**
     * Gets if the workspace is active or not.
     */
    public get isActive() {
        return getActiveWorkspaces().map(aws => aws.id)
                                    .indexOf( this.id ) > -1;
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

        if (this.isInGitFolder(file)) {
            return true;  // not from Git folder
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
     * Checks if a path is inside the Git folder.
     * 
     * @param {string} path The path to check.
     * 
     * @return {boolean} Is in Git folder or not.
     */
    public isInGitFolder(path: string) {
        const GIT_DIR = Path.resolve(
            Path.join(
                this.rootPath,
                '.git'
            )
        );

        path = deploy_helpers.toStringSafe(path);
        if (!Path.isAbsolute(path)) {
            return true;
        }
        path = Path.resolve(path);

        return path.startsWith(GIT_DIR);
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

    /**
     * Gets the name of that workspace.
     */
    public get name(): string {
        return Path.basename(this.rootPath);
    }

    /**
     * Prepares a target for deployment.
     * 
     * @param {TTarget} target The target to prepare.
     * 
     * @return {TTarget} The prepared target.
     */
    public prepareTarget<TTarget extends deploy_targets.Target = deploy_targets.Target>(target: TTarget): TTarget {
        const ME = this;

        target = deploy_helpers.cloneObjectFlat(target);

        if (target) {
            if (isSwitchTarget(target)) {
                const CHILD_TARGETS = ME.getTargetsOfSwitch(<any>target);
                if (false !== CHILD_TARGETS) {
                    // collect 'before delete' operations
                    const BEFORE_DELETE_OF_CHILDREN = Enumerable.from( deploy_helpers.asArray(CHILD_TARGETS) ).selectMany(ct => {
                        return deploy_helpers.asArray(ct.beforeDelete);
                    }).toArray();
                    const MY_BEFORE_DELETE = deploy_helpers.asArray(target.beforeDelete);

                    // collect 'before deploy' operations
                    const BEFORE_DEPLOY_OF_CHILDREN = Enumerable.from( deploy_helpers.asArray(CHILD_TARGETS) ).selectMany(ct => {
                        return deploy_helpers.asArray(ct.beforeDeploy);
                    }).toArray();
                    const MY_BEFORE_DEPLOY = deploy_helpers.asArray(target.beforeDeploy);

                    // collect 'before pull' operations
                    const BEFORE_PULL_OF_CHILDREN = Enumerable.from( deploy_helpers.asArray(CHILD_TARGETS) ).selectMany(ct => {
                        return deploy_helpers.asArray(ct.beforePull);
                    }).toArray();
                    const MY_BEFORE_PULL = deploy_helpers.asArray(target.beforePull);

                    // collect 'after deleted' operations
                    const DELETED_OF_CHILDREN = Enumerable.from( deploy_helpers.asArray(CHILD_TARGETS) ).reverse().selectMany(ct => {
                        return deploy_helpers.asArray(ct.deleted);
                    }).toArray();  // in reverse target order
                    const MY_DELETED = deploy_helpers.asArray(target.deleted);

                    // collect 'after deployed' operations
                    const DEPLOYED_OF_CHILDREN = Enumerable.from( deploy_helpers.asArray(CHILD_TARGETS) ).reverse().selectMany(ct => {
                        return deploy_helpers.asArray(ct.deployed);
                    }).toArray();  // in reverse target order
                    const MY_DEPLOYED = deploy_helpers.asArray(target.deployed);

                    // collect 'after pulled' operations
                    const PULLED_OF_CHILDREN = Enumerable.from( deploy_helpers.asArray(CHILD_TARGETS) ).reverse().selectMany(ct => {
                        return deploy_helpers.asArray(ct.pulled);
                    }).toArray();  // in reverse target order
                    const MY_PULLED = deploy_helpers.asArray(target.pulled);

                    // before
                    (<any>target).beforeDelete = MY_BEFORE_DELETE.concat(
                        BEFORE_DELETE_OF_CHILDREN
                    );
                    (<any>target).beforeDeploy = MY_BEFORE_DEPLOY.concat(
                        BEFORE_DEPLOY_OF_CHILDREN
                    );
                    (<any>target).beforePull = MY_BEFORE_PULL.concat(
                        BEFORE_PULL_OF_CHILDREN
                    );

                    // after
                    (<any>target).deleted = DELETED_OF_CHILDREN.concat(
                        MY_DELETED
                    );
                    (<any>target).deployed = DEPLOYED_OF_CHILDREN.concat(
                        MY_DEPLOYED
                    );
                    (<any>target).pulled = PULLED_OF_CHILDREN.concat(
                        MY_PULLED
                    );
                }
            }
        }

        return target;
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

        const SCOPES = ME.getSettingScopes();

        let finalizer: () => any;
        try {
            ME.cleanupTimeouts();
            deploy_helpers.applyFuncFor(deploy_commands.cleanupCommands, ME)();

            ME._isDeployOnChangeFreezed = false;
            ME._isRemoveOnChangeFreezed = false;

            let loadedCfg: WorkspaceSettings = vscode.workspace.getConfiguration(ME.configSource.section,
                                                                                 ME.configSource.resource) || <any>{};
            loadedCfg = deploy_helpers.cloneObjectFlat(loadedCfg);

            if (ME.editorRootPath !== ME.rootPath) {
                if (await deploy_helpers.exists(ME.configSource.resource.fsPath)) {
                    const CONFIG_TO_MERGE: WorkspaceSettings = 
                        JSON.parse(
                            (await deploy_helpers.readFile(
                                ME.configSource.resource.fsPath,
                            )).toString('utf8')
                        );

                    if (CONFIG_TO_MERGE) {
                        loadedCfg = MergeDeep(
                            loadedCfg,
                            CONFIG_TO_MERGE[ME.configSource.section],  
                        );
                    }
                }
            }

            // runGitPullOnStartup
            await deploy_tasks.runGitPullOnStartup
                              .apply(ME, [ loadedCfg ]);

            // imports
            try {
                let allImports = deploy_helpers.asArray(loadedCfg.imports);

                for (const IE of allImports) {
                    let importFile: string;

                    if (deploy_helpers.isObject<deploy_contracts.Import>(IE)) {
                        let doesMatch = false;
                        
                        const PI = deploy_helpers.filterPlatformItems(IE);
                        if (PI.length > 0) {
                            doesMatch = Enumerable.from( IE.if ).all(c => {
                                let res: any;
                                
                                const IF_CODE = deploy_helpers.toStringSafe(c);
                                if (!deploy_helpers.isEmptyString(IF_CODE)) {
                                    res = deploy_code.exec({
                                        code: IF_CODE,
                                        context: {
                                            i: IE,
                                            ws: ME,
                                        },
                                        values: [].concat( deploy_values.getPredefinedValues() )
                                                .concat( deploy_values.getEnvVars() ),
                                    });
                                }    

                                return deploy_helpers.toBooleanSafe(res, true);
                            });
                        }

                        if (doesMatch) {
                            importFile = deploy_helpers.toStringSafe(IE.from);
                        }
                    }
                    else {
                        importFile = deploy_helpers.toStringSafe(IE);
                    }

                    if (deploy_helpers.isEmptyString(importFile)) {
                        continue;
                    }

                    const DATA = await deploy_download.download(
                        importFile, SCOPES
                    );

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

            // check for requirements
            if (!(await ME.checkForRequiredExtensions(loadedCfg))) {
                return;  // failed
            }
            if (!(await ME.checkForRequirements(loadedCfg))) {
                return;  // failed
            }

            await deploy_helpers.applyFuncFor(deploy_commands.reloadCommands, ME)(loadedCfg);

            await ME.reloadTargets(loadedCfg);
            await ME.reloadPackages(loadedCfg);

            const OLD_CFG = ME._config;
            ME._config = loadedCfg;
            ME._workspaceSessionState = ME.createWorkspaceSessionState(loadedCfg);
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
                ME._translator = await deploy_helpers.applyFuncFor(i18.initForWorkspace, ME)();
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'workspaces.reloadConfiguration(2)');
            }

            if (deploy_helpers.toBooleanSafe(loadedCfg.clearOutputOnStartup)) {
                ME.context.outputChannel.clear();
            }
            if (deploy_helpers.toBooleanSafe(loadedCfg.openOutputOnStartup, true)) {
                ME.context.outputChannel.show();
            }

            finalizer = async () => {
                await ME.executeOnStartup(loadedCfg);
                await ME.initNodeModules(loadedCfg);
                await ME.initComposer(loadedCfg);

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

                        ME.context.outputChannel.appendLine('');
                        ME.context.outputChannel.appendLine(
                            ME.t('deploy.onChange.waitingBeforeActivate',
                                 Math.round(TIME_TO_WAIT_BEFORE_ACTIVATE_DEPLOY_ON_CHANGE / 1000.0),
                                 ME.rootPath)
                        );

                        ME._TIMEOUTS.push(
                            setTimeout(() => {
                                ME._isDeployOnChangeFreezed = false;

                                ME.context.outputChannel.appendLine('');
                                ME.context.outputChannel.appendLine(
                                    ME.t('deploy.onChange.activated',
                                         ME.rootPath)
                                );
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

                        ME.context.outputChannel.appendLine('');
                        ME.context.outputChannel.appendLine(
                            ME.t('DELETE.onChange.waitingBeforeActivate',
                                 Math.round(TIME_TO_WAIT_BEFORE_ACTIVATE_REMOVE_ON_CHANGE / 1000.0),
                                 ME.rootPath)
                        );

                        ME._TIMEOUTS.push(
                            setTimeout(() => {
                                ME._isRemoveOnChangeFreezed = false;

                                ME.context.outputChannel.appendLine('');
                                ME.context.outputChannel.appendLine(
                                    ME.t('DELETE.onChange.activated',
                                         ME.rootPath)
                                );
                            }, TIME_TO_WAIT_BEFORE_ACTIVATE_REMOVE_ON_CHANGE)
                        );
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'workspaces.reloadConfiguration(6)');

                    ME._isRemoveOnChangeFreezed = false;
                }

                await ME.reloadPackageButtons();
                await ME.reloadSwitches();

                await ME.executeStartupCommands();
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

    /**
     * Reloads the environment variables as defined in the settings.
     */
    public reloadEnvVars() {
        const CFG = this.config;
        if (!CFG) {
            return;
        }

        try {
            // restore old values
            const OLD_VARS: string[] = [];
            for (const OV in this._OLD_ENV_VARS) {
                OLD_VARS.push( OV );
            }
            for (const OV of OLD_VARS) {
                process.env[OV] = this._OLD_ENV_VARS[OV]; 
                delete this._OLD_ENV_VARS[OV];
            }

            if (CFG.env) {
                const VARS = CFG.env.vars;
                if (VARS) {
                    // set own

                    for (const OV in VARS) {
                        this._OLD_ENV_VARS[OV] = process.env[OV];
                        process.env[OV] = deploy_helpers.toStringSafe(VARS[OV]);
                    }
                }
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.Workspace.reloadEnvVars()');
        }
    }

    private async reloadPackageButtons() {
        const ME = this;

        ME.cleanupPackageButtons();

        for (const P of ME.getPackages()) {
            let buttonDesc: deploy_packages.PackageButton;

            const DEFAULT_BTN_TEXT = ME.t('packages.buttons.defaultText',
                                          deploy_packages.getPackageName(P));
            const DEFAULT_BTN_TOOLTIP = ME.t('packages.buttons.defaultTooltip');
            
            if (!deploy_helpers.isNullOrUndefined(P.button)) {
                if (deploy_helpers.isObject<deploy_packages.PackageButton>(P.button)) {
                    buttonDesc = P.button;
                }
                else {
                    if (deploy_helpers.toBooleanSafe(P.button, true)) {
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

                    // additional values
                    const VALUES: deploy_values.Value[] = [
                        new deploy_values.StaticValue({
                                value: pb
                            },
                            'options'
                        ),
                        new deploy_values.StaticValue({
                                value: PACKAGE_NAME
                            },
                            'package'
                        ),
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
                                await ME.showErrorMessage(
                                    ME.t('packages.deploymentFailed',
                                         deploy_packages.getPackageName(PACKAGE_TO_DEPLOY))
                                );
                            }
                        });

                        //TODO: translate
                        deploy_log.CONSOLE
                                  .info(`Registrated command '${newCmdId}' for button of package '${PACKAGE_NAME}'.`,
                                        'workspaces.Workspace.reloadPackageButtons()');
                    }
                    else {
                        //TODO: translate
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

    private async reloadPackages(cfg: deploy_contracts.Configuration) {
        const ME = this;

        if (!cfg) {
            return;
        }

        let packages = Enumerable.from( deploy_helpers.asArray(cfg.packages) ).where(p => {
            return 'object' === typeof p;
        }).select(p => {
            return deploy_helpers.cloneObject(p);
        }).toArray();

        packages = deploy_helpers.filterPlatformItems(packages);

        let index = -1;
        packages = Enumerable.from(packages).select(p => {
            return ME.applyValuesTo(p);
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

        ME._packages = packages;
    }

    private async reloadSwitches() {
        const ME = this;
        
        try {
            ME.cleanupSwitchButtons();

            const TARGETS = ME.getSwitchTargets();

            const CREATE_AND_ADD_BUTTON = async (b: deploy_contracts.Button, t: SwitchTarget) => {
                const CMD_ID = `extension.deploy.reloaded.buttons.changeSwitchOption${nextSwitchButtonId++}`;

                let newBtn: vscode.StatusBarItem;
                let newCmd: vscode.Disposable;
                let newSwitchBtn: TargetWithButton<SwitchTarget>;
                try {
                    newCmd = vscode.commands.registerCommand(CMD_ID, async () => {
                        try {
                            await ME.changeSwitchButtonOption(newSwitchBtn.target);
                        }
                        catch (e) {
                            deploy_log.CONSOLE
                                      .trace(e, 'workspaces.Workspace.reloadSwitches().CREATE_AND_ADD_BUTTON()');
                        }
                    });

                    newBtn = await deploy_helpers.createButton(b, (nb) => {
                        nb.command = CMD_ID;
                        nb.text = undefined;
                        nb.tooltip = undefined;

                        nb.show();
                    });

                    ME._SWITCH_BUTTONS.push(newSwitchBtn = {
                        button: newBtn,
                        command: newCmd,
                        settings: b,
                        target: t,
                    });
                }
                catch (e) {
                    deploy_helpers.tryDispose(newBtn);
                    deploy_helpers.tryDispose(newCmd);

                    throw e;
                }
            };

            for (const T of TARGETS) {
                let btn = T.button;
                if (deploy_helpers.isNullOrUndefined(btn)) {
                    btn = true;
                }

                if (deploy_helpers.isBool(btn)) {
                    // boolean

                    btn = {
                        enabled: btn
                    };
                }
                else if (!deploy_helpers.isObject<deploy_contracts.Button>(btn)) {
                    // button text

                    btn = {
                        enabled: true,
                        text: deploy_helpers.toStringSafe(btn)
                    };
                }

                if (!deploy_helpers.toBooleanSafe(btn.enabled, true)) {
                    continue;
                }

                await CREATE_AND_ADD_BUTTON(btn, T);
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.Workspace.reloadSwitches()');
        }
        finally {
            await ME.updateSwitchButtons();
        }
    }

    private async reloadTargets(cfg: deploy_contracts.Configuration) {
        const ME = this;

        if (!cfg) {
            return;
        }

        let targets = Enumerable.from( deploy_helpers.asArray(cfg.targets) ).where(t => {
            return 'object' === typeof t;
        }).select(t => {
            return deploy_helpers.cloneObject(t);
        }).toArray();

        targets = deploy_helpers.filterPlatformItems(targets);

        let index = -1;
        targets = Enumerable.from(targets).select(t => {
            return ME.applyValuesTo(t);
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

        ME._targets = targets;
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
     * @param {deploy_values.Value|deploy_values.Value[]|boolean} [additionalValuesOrThrowOnError] Additional values or if less than 3 arguments are defined: it
     *                                                                                             does the work of 'throwOnError'
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
     * Gets the root path of that workspace.
     */
    public get rootPath(): string {
        let rp = this._rootPath;
        if (false === rp) {
            rp = this.folder.uri.fsPath;
        }

        if (!Path.isAbsolute(rp)) {
            rp = Path.join(
                this.folder.uri.fsPath, rp
            );
        }

        return Path.resolve(rp);
    }

    /**
     * Gets the repository of selected switches.
     */
    public get selectedSwitches(): deploy_contracts.KeyValuePairs {
        return this._selectedSwitches;
    }

    /**
     * Gets the full path of a settings folder.
     */
    public get settingFolder(): string {
        return Path.resolve(
            Path.dirname(
                this.configSource.resource.fsPath
            )
        );
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
     * Promise (and safe) version of 'vscode.window.showErrorMessage()' function.
     * 
     * @param {any} msg The message to display.
     * @param {TItem[]} [items] The optional items.
     * 
     * @return {Promise<TItem>} The promise with the selected item.
     */
    public async showInformationMessage<TItem extends vscode.MessageItem = vscode.MessageItem>(msg: any, ...items: TItem[]): Promise<TItem> {
        try {
            msg = deploy_helpers.toStringSafe(msg);

            return await vscode.window.showInformationMessage
                                      .apply(null, [ <any>`[vscode-deploy-reloaded]::[${this.name}] ${msg}`.trim() ].concat(items));
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.Workspace.showInformationMessage()');
        }
    }

    /**
     * Shows a quick pick for a list of targets of that workspace.
     * 
     * @param {vscode.QuickPickOptions} [opts] Custom options for the quick picks.
     * 
     * @return {Promise<Target|false>} The promise that contains the selected target (if selected)
     *                                 or (false) if no target is available.
     */
    public async showTargetQuickPick(opts?: vscode.QuickPickOptions): Promise<deploy_targets.Target | false> {
        const DEFAULT_OPTS: vscode.QuickPickOptions = {
            placeHolder: this.t('targets.selectTarget')
        };
        
        return await deploy_targets.showTargetQuickPick(
            this.context.extension,
            this.getTargets(),
            MergeDeep(DEFAULT_OPTS, opts),
        );
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
     * Stores the memento of that workspace.
     */
    public readonly state: WorkspaceMemento;

    /**
     * Gets the states for 'sync when open'.
     */
    public get syncWhenOpenStates(): SyncWhenOpenStates {
        return this.workspaceSessionState['sync']['whenOpen']['states'];
    }

    /** @inheritdoc */
    public t(key: string, ...args: any[]): string {
        const MY_ARGS = deploy_helpers.toArray(arguments);

        const ARGS: any[] = [
            this._translator,
            () => {
                // global translations are the fallback
                return i18.t
                          .apply(null, MY_ARGS);
            }
        ].concat( MY_ARGS );

        return i18.translateWith
                  .apply(null, ARGS);
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

        let workspaceDir = this.rootPath;
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
                this.rootPath,
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
            this.rootPath,
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

    private async updateSwitchButtons() {
        const ME = this;
        
        try {
            for (const SB of ME._SWITCH_BUTTONS) {
                const SWITCH_NAME = deploy_targets.getTargetName(SB.target);
                const OPTION = ME.getSelectedSwitchOption(SB.target);

                const ADDITIONAL_VALUES: deploy_values.Value[] = [
                    // switch
                    new deploy_values.FunctionValue(() => {
                        return SWITCH_NAME;
                    }, 'switch'),
                    
                    // switch option
                    new deploy_values.FunctionValue(() => {
                        return false === OPTION ? undefined
                                                : ME.getSwitchOptionName(OPTION);
                    }, 'switchOption'),
                ];

                let color = deploy_helpers.normalizeString(
                    ME.replaceWithValues(SB.settings.color, ADDITIONAL_VALUES)
                );
                if ('' === color) {
                    color = false === OPTION ? '#ffff00' : '#ffff00';
                }

                let text = deploy_helpers.toStringSafe(
                    ME.replaceWithValues(SB.settings.text, ADDITIONAL_VALUES)
                ).trim();
                if ('' === text) {
                    // default text
                    text = i18.t('plugins.switch.button.text',
                                 SWITCH_NAME);
                }

                let tooltip = deploy_helpers.toStringSafe(
                    ME.replaceWithValues(SB.settings.tooltip, ADDITIONAL_VALUES)
                ).trim();
                if ('' === tooltip) {
                    // default tooltip
                    if (false === OPTION) {
                        tooltip = i18.t('plugins.switch.button.tooltip',
                                        i18.t('plugins.switch.noOptionSelected'));
                    }
                    else {
                        tooltip = i18.t('plugins.switch.button.tooltip',
                                        ME.getSwitchOptionName(OPTION));
                    }
                }

                SB.button.text = text;
                SB.button.tooltip = tooltip;
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.Workspace.updateSwitchButtons()');
        }
    }

    /**
     * Gets the current session data storage.
     */
    public get workspaceSessionState(): deploy_contracts.KeyValuePairs {
        return this._workspaceSessionState;
    }
}

/**
 * A memento of a workspace.
 */
export class WorkspaceMemento implements vscode.Memento {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {Workspace} workspace The underlying workspace.
     * @param {vscode.Memento} _MEMENTO The memento to use.
     */
    constructor(public readonly workspace: Workspace,
                private readonly _MEMENTO: vscode.Memento) {
    }

    /** @inheritdoc */
    public get<T = any, TDefault = T>(key: any, defaultValue?: TDefault): T | TDefault {
        return this._MEMENTO.get<T | TDefault>(
            this.normalizeKey(key),
            defaultValue
        );
    }

    private normalizeKey(key: any) {
        return `vscdr${deploy_helpers.toStringSafe(key)}`;
    }

    /** @inheritdoc */
    public async update(key: any, value: any) {
        await this._MEMENTO.update(
            this.normalizeKey(key),
            value,
        );
    }
}

/**
 * Returns a list of active workspaces.
 * 
 * @return {Workspace[]} The list of active workspaces.
 */
export function getActiveWorkspaces(): Workspace[] {
    const PROVIDER = activeWorkspaceProvider;
    if (PROVIDER) {
        return deploy_helpers.asArray( PROVIDER() );
    }
}

/**
 * Checks if a target is a switch or not.
 * 
 * @param {deploy_targets.Target} target The target to check.
 * 
 * @return {boolean} Is switch or not.
 */
export function isSwitchTarget(target: deploy_targets.Target): target is SwitchTarget {
    if (target) {
        return [
            'switch'
        ].indexOf( deploy_helpers.normalizeString(target.type) ) > -1;
    }

    return false;
}

/**
 * Resets the workspace usage statistics.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function resetWorkspaceUsage(context: vscode.ExtensionContext) {
    context.workspaceState.update(KEY_WORKSPACE_USAGE, undefined).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'workspaces.resetWorkspaceUsage()');
    });
}

/**
 * Sets the global function for providing the list of active workspaces.
 * 
 * @param {WorkspaceProvider} newProvider The new function.
 */
export function setActiveWorkspaceProvider(newProvider: WorkspaceProvider) {
    activeWorkspaceProvider = newProvider;
}


/**
 * Shows a quick pick for a list of packages.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {Workspace|Workspace[]} workspaces One or more workspaces.
 * @param {vscode.QuickPickOptions} [opts] Custom options for the quick picks.
 * 
 * @return {Promise<Workspace|false>} The promise that contains the selected workspace (if selected)
 *                                    or (false) if no package is available.
 */
export async function showWorkspaceQuickPick(context: vscode.ExtensionContext,
                                             workspaces: Workspace | Workspace[],
                                             opts?: vscode.QuickPickOptions): Promise<Workspace | false> {
    const QUICK_PICKS: deploy_contracts.ActionQuickPick<string>[] = deploy_helpers.asArray(workspaces).map(ws => {
        return {
            action: () => {
                return ws;
            },
            label: '$(file-directory)  ' + ws.name,
            description: '',
            detail: ws.rootPath,
            state: Crypto.createHash('sha256')
                         .update( new Buffer(deploy_helpers.toStringSafe(ws.id), 'utf8') )
                         .digest('hex'),
        };
    });

    if (QUICK_PICKS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('noneFound.noneFound')
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
                                             context.globalState,
                                             KEY_WORKSPACE_USAGE,
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

async function scanForDirectoriesRecursive(dir: string, isRoot: boolean) {
    const RESULT: string[] = [];

    const FILES_AND_FOLDERS = await deploy_helpers.readDir(dir);
    for (const FF of FILES_AND_FOLDERS) {
        const FULL_PATH = Path.resolve(
            Path.join( dir, FF )
        );
        const STATS = await deploy_helpers.lstat(FULL_PATH);

        if (STATS.isDirectory()) {
            if (isRoot) {
                switch (FF) {
                    case '.git':
                    case '.vscode':
                        continue;
                }
            }

            RESULT.push(FULL_PATH);

            RESULT.push
                  .apply(RESULT, await scanForDirectoriesRecursive(FULL_PATH, false));
        }
    }

    return RESULT;
}