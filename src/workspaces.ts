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
import * as ChildProcess from 'child_process';
import * as Crypto from 'crypto';
import * as deploy_api from './api';
import * as deploy_code from './code';
import * as deploy_commands from './commands';
import * as deploy_contracts from './contracts';
import * as deploy_delete from './delete';
import * as deploy_deploy from './deploy';
import * as deploy_download from './download';
import * as deploy_files from './files';
import * as deploy_git from './git';
import * as deploy_gui from './gui';
import * as deploy_helpers from './helpers';
import * as deploy_list from './list';
import * as deploy_log from './log';
import * as deploy_output from './output';
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_proxies from './proxies';
import * as deploy_pull from './pull';
import * as deploy_sync from './sync';
import * as deploy_targets from './targets';
import * as deploy_transformers from './transformers';
import * as deploy_tasks from './tasks';
import * as deploy_values from './values';
import * as Enumerable from 'node-enumerable';
import * as Events from 'events';
import * as FS from 'fs';
import * as Glob from 'glob';
import * as i18 from './i18';
import * as i18next from 'i18next';
import * as ip from 'ip';
const MergeDeep = require('merge-deep');
import * as Moment from 'moment';
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * Options for 'Workspace.deactivateAutoDeployOperationsFor()' method.
 */
export interface DeactivateAutoDeployOperationsForOptions {
    /**
     * Deactivate 'deploy on change' or not.
     */
    readonly noDeployOnChange?: boolean;
    /**
     * Deactivate 'deploy on save' or not.
     */
    readonly noDeployOnSave?: boolean;
    /**
     * Deactivate 'remove on change' or not.
     */
    readonly noRemoveOnChange?: boolean;
}

interface FinishedButton extends vscode.Disposable {
    readonly button: vscode.StatusBarItem;
    readonly command: vscode.Disposable;
}

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

interface TcpProxyButton extends vscode.Disposable {
    readonly button: vscode.StatusBarItem;
    readonly command: vscode.Disposable;
    readonly proxy: deploy_proxies.TcpProxy;
    readonly proxySettings: deploy_proxies.ProxySettings;
    readonly settings: deploy_proxies.ProxyButton;
}

/**
 * Stores data of configuration source.
 */
export interface WorkspaceConfigSource extends deploy_helpers.WorkspaceConfigSource {
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
     * The file system watcher for that workspace.
     */
    readonly fileWatcher: vscode.FileSystemWatcher;
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
 * A workspace directory.
 */
export interface WorkspaceDirectory extends deploy_contracts.WithNameAndPath, WorkspaceItem {
    /**
     * The path to the (local) directory.
     */
    readonly directory: string;
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
     * The cache for that item.
     */
    readonly __cache: deploy_helpers.CacheProvider;
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
 * A 'list directory' result of a workspace.
 */
export interface WorkspaceListDirectoryResult extends deploy_files.WithDirectoriesAndFiles {
    /**
     * Information about the underlying directory itself.
     */
    readonly info: deploy_files.DirectoryInfo;
    /**
     * The other / unknown elements.
     */
    readonly others: deploy_files.FileSystemInfo[];
    /**
     * The underlying workspace.
     */
    readonly workspace: Workspace;
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
let allWorkspacesProvider: WorkspaceProvider;
const FILES_CHANGES: { [path: string]: deploy_contracts.FileChangeType } = {};
const KEY_FINISHED_BTNS = 'finished_buttons';
const KEY_FINISHED_BTN_DELETE = 'finish_delete';
const KEY_FINISHED_BTN_DEPLOY = 'finish_deploy';
const KEY_FINISHED_BTN_PULL = 'finish_pull';
const KEY_WORKSPACE_USAGE = 'vscdrLastExecutedWorkspaceActions';
let nextFinishedBtnIds = Number.MIN_SAFE_INTEGER;
let nextPackageButtonId = Number.MIN_SAFE_INTEGER;
let nextTcpProxyButtonId = Number.MIN_SAFE_INTEGER;
let nextSwitchButtonId = Number.MIN_SAFE_INTEGER;
const SWITCH_STATE_REPO_COLLECTION_KEY = 'SwitchStates';

/**
 * A workspace.
 */
export class Workspace extends deploy_helpers.WorkspaceBase implements deploy_contracts.Translator {
    private readonly _APIS: deploy_api.ApiHost[] = [];
    /**
     * Stores the current configuration.
     */
    protected _config: WorkspaceSettings;
    private readonly _CONFIG_FILE_WATCHERS: vscode.FileSystemWatcher[] = [];
    /**
     * Stores the source of the configuration data.
     */
    protected _configSource: WorkspaceConfigSource;
    private _gitFolder: string | false;
    /**
     * Stores if 'deploy on change' feature is freezed or not.
     */
    protected _isDeployOnChangeFreezed = false;
    /**
     * Stores if 'deploy on save' feature is freezed or not.
     */
    protected _isDeployOnSaveFreezed = false;
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
    private readonly _LOGGER = new deploy_log.ActionLogger();
    private readonly _OLD_ENV_VARS: deploy_contracts.KeyValuePairs = {};
    private readonly _OUTPUT_CHANNEL: deploy_output.OutputChannelWrapper;
    private readonly _PACKAGE_BUTTONS: PackageWithButton[] = [];
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
    private readonly _TCP_PROXIES: deploy_proxies.TcpProxyDestinationContext[] = [];
    private readonly _TCP_PROXY_BUTTONS: TcpProxyButton[] = [];
    private readonly _TCP_PROXY_FILTERS: deploy_proxies.TcpProxyRemoteFilterContext[] = [];
    private readonly _TCP_PROXY_LOGGERS: deploy_proxies.TcpProxyLoggingContext[] = [];
    private readonly _TCP_PROXY_NAMES_AND_DESCS: deploy_proxies.TcpProxyNameAndDescriptionResolverContext[] = [];
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
                folder: vscode.WorkspaceFolder,
                public readonly context: WorkspaceContext) {
        super(folder);

        this._OUTPUT_CHANNEL = new deploy_output.OutputChannelWrapper(
            context.outputChannel
        );
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
               !this.isReloadingConfig &&
               this.isInitialized;
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
        const ME = this;

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
                    ME.logger
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

                const SELECTED_ITEM = await ME.showErrorMessage<deploy_contracts.MessageItemWithValue>(
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

            const SELECTED_ITEM = await ME.showWarningMessage<deploy_contracts.MessageItemWithValue>(
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
    
                    await this.showErrorMessage<deploy_contracts.MessageItemWithValue>(
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
    public get configSource(): WorkspaceConfigSource {
        return this._configSource;
    }

    private createFinishedButton(state: deploy_contracts.KeyValuePairs, key: string, id: number): FinishedButton {
        const ME = this;

        let btn: vscode.StatusBarItem;
        let cmd: vscode.Disposable;
        try {
            btn = vscode.window.createStatusBarItem();
            btn.hide();

            const CMD_ID = `extension.deploy.reloaded.buttons.finishedButtons.${key}${id}`;
            cmd = vscode.commands.registerCommand(CMD_ID, () => {
                ME.output.show();

                btn.hide();
            });

            btn.command = CMD_ID;
        }
        catch (e) {
            deploy_helpers.tryDispose(btn);
            deploy_helpers.tryDispose(cmd);

            throw e;
        }

        return {
            button: btn,
            command: cmd,
            dispose: function() {
                const BUTTONS = state['buttons'];

                let timeouts: deploy_contracts.KeyValuePairs;
                if (state['timeouts']) {
                    timeouts = state['timeouts'][ KEY_FINISHED_BTNS ];
                }

                deploy_helpers.tryDispose( this.button );
                deploy_helpers.tryDispose( this.command );

                if (BUTTONS) {
                    delete BUTTONS[ key ];
                }

                if (timeouts) {
                    deploy_helpers.tryDispose( timeouts[key] );

                    delete timeouts[ key ];
                }
            }
        };
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
                else {
                    gitCwd = Path.resolve(
                        Path.join(
                            gitCwd, '..'
                        )
                    );
                }
                
                return new deploy_git.GitClient(GIT,
                                                gitCwd);
            }
        }
        catch (e) {
            this.logger
                .trace(e, 'workspaces.Workspace.createGitClient()');
        }

        return false;
    }

    /**
     * Creates a (new) logger based of that workspace.
     * 
     * @return {deploy_log.Logger} The (new) workspace logger.
     */
    public createLogger(): deploy_log.Logger {
        return this.logger;
    }

    private createWorkspaceSessionState(newCfg: WorkspaceSettings) {
        const NEW_SESSION_STATE: deploy_contracts.KeyValuePairs = {};
            
        NEW_SESSION_STATE['buttons'] = {};

        NEW_SESSION_STATE['commands'] = {};
        NEW_SESSION_STATE['commands']['events'] = new Events.EventEmitter();

        NEW_SESSION_STATE['list'] = {};
        NEW_SESSION_STATE['list']['lastDirectories'] = {};

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

        NEW_SESSION_STATE['timeouts'] = {};

        // targets
        NEW_SESSION_STATE[ deploy_targets.KEY_TARGETS_STATE_STORAGE ] = {};
        NEW_SESSION_STATE[ deploy_targets.KEY_TARGETS_STATE_STORAGE ][
            deploy_targets.KEY_TARGETS_IN_PROGRESS
        ] = {};

        this.initFinishedButtons(NEW_SESSION_STATE);

        return NEW_SESSION_STATE;
    }

    /**
     * Deactivates auto deploy operations like 'deploy on change', 'deploy on save' and
     * 'remove on change' while an action is running.
     * 
     * @param {Function} action The action to invoke.
     * @param {DeactivateAutoDeployOperationsForOptions} [opts] Custom options.
     */
    public async deactivateAutoDeployOperationsFor<TResult = any>(
        action: () => TResult | PromiseLike<TResult>, opts?: DeactivateAutoDeployOperationsForOptions
    ) {
        if (!opts) {
            opts = <any>{};
        }

        let oldIsDeployOnChangeFreezed = this._isDeployOnChangeFreezed;
        let oldIsDeployOnSaveFreezed = this._isDeployOnSaveFreezed;
        let oldIsRemoveOnChangeFreezed = this._isRemoveOnChangeFreezed;
        try {
            if (deploy_helpers.toBooleanSafe(opts.noDeployOnChange, true)) {
                this._isDeployOnChangeFreezed = true;
            }

            if (deploy_helpers.toBooleanSafe(opts.noRemoveOnChange, true)) {
                this._isRemoveOnChangeFreezed = true;
            }

            if (deploy_helpers.toBooleanSafe(opts.noDeployOnSave, true)) {
                this._isDeployOnSaveFreezed = true;
            }

            if (action) {
                return await Promise.resolve(
                    action()
                );
            }
        }
        finally {
            this._isDeployOnChangeFreezed = oldIsDeployOnChangeFreezed;
            this._isDeployOnSaveFreezed = oldIsDeployOnSaveFreezed;
            this._isRemoveOnChangeFreezed = oldIsRemoveOnChangeFreezed;
        }
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
     * @param {deploy_targets.TargetResolver} [targetResolver] A function to receive optional targets. 
     * @param {boolean} [askForDeleteLocalFiles] Also ask for deleting the local files or not.
     */
    public async deletePackage(pkg: deploy_packages.Package, targetResolver?: deploy_targets.TargetResolver,
                               askForDeleteLocalFiles = true) {
        await deploy_helpers.applyFuncFor(
            deploy_delete.deletePackage,
            this
        )(pkg, targetResolver, askForDeleteLocalFiles);
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
     * Deploys files of a git commit.
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
        if (this.isDeployOnSaveFreezed) {
            return;  // freezed
        }

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
     * @param {deploy_targets.TargetResolver} [targetResolver] A function to receive optional targets. 
     */
    public async deployPackage(pkg: deploy_packages.Package, targetResolver?: deploy_targets.TargetResolver) {
        await deploy_helpers.applyFuncFor(
            deploy_deploy.deployPackage,
            this
        )(pkg, targetResolver);
    }

    /**
     * Deploys uncomitted files of the git repository.
     * 
     * @param {deploy_targets.Target} target The target to deploy to. 
     */
    public async deployUncomittedGitChanges(target: deploy_targets.Target) {
        if (!this.canBeHandledByMe(target)) {
            return;
        }
        
        const GIT = await this.createGitClient();
        if (!GIT) {
            return;
        }

        await deploy_deploy.deployUncommitedScmChanges
                           .apply(this, [ GIT, target ]);
    }

    private disposeConfigFileWatchers() {
        while (this._CONFIG_FILE_WATCHERS.length > 0) {
            deploy_helpers.tryDispose(
                this._CONFIG_FILE_WATCHERS.pop()
            );
        }
    }

    private disposeFinishedButtons() {
        const STATE = this.workspaceSessionState;
        if (!STATE) {
            return;
        }

        const BUTTONS = STATE['buttons'];
        if (!BUTTONS) {
            return;
        }        

        const KEYS = [
            KEY_FINISHED_BTN_DEPLOY,
            KEY_FINISHED_BTN_PULL,
            KEY_FINISHED_BTN_DELETE,
        ];

        for (const K of KEYS) {
            deploy_helpers.tryDispose(BUTTONS[ K ]);
        }
    }

    private disposeTcpProxies() {
        // loggers
        while (this._TCP_PROXY_LOGGERS.length > 0) {
            deploy_helpers.tryDispose(
                this._TCP_PROXY_LOGGERS.pop()
            );
        }

        // name and description resolvers
        while (this._TCP_PROXY_NAMES_AND_DESCS.length > 0) {
            deploy_helpers.tryDispose(
                this._TCP_PROXY_NAMES_AND_DESCS.pop()
            );
        }

        // buttons
        while (this._TCP_PROXY_BUTTONS.length > 0) {
            deploy_helpers.tryDispose(
                this._TCP_PROXY_BUTTONS.pop()
            );
        }

        // proxies
        while (this._TCP_PROXIES.length > 0) {
            deploy_helpers.tryDispose(
                this._TCP_PROXIES.pop()
            );
        }

        // filters
        while (this._TCP_PROXY_FILTERS.length > 0) {
            deploy_helpers.tryDispose(
                this._TCP_PROXY_FILTERS.pop()
            );
        }
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

            ME.output.appendLine('');
            ME.output.append(
                ME.t('shell.executing',
                     name) + ' '
            );
            try {
                await ME.exec(shellCmdToExecute, {
                    cwd: cwd,
                });

                ME.output.appendLine(
                    `[${ME.t('ok')}]`
                );
            }
            catch (e) {
                ME.output.appendLine(
                    `[${ME.t('error', e)}]`
                );
                
                if (!IGNORE_IF_FAIL) {
                    throw e;
                }
            }
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
                    this.logger
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
     * Returns a list of all API hosts handled by that workspace.
     * 
     * @return {deploy_proxies.ApiHost[]} The list of hosts.
     */
    public getApiHosts(): deploy_api.ApiHost[] {
        return Enumerable.from( this._APIS )
                         .distinct(true)
                         .toArray();
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

        return this.context.plugins.filter(pi => {
            return deploy_plugins.canDelete(pi, target);
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

        return this.context.plugins.filter(pi => {
            return deploy_plugins.canDownload(pi, target);
        });
    }

    /**
     * Gets all targets that can download.
     * 
     * @return {deploy_targets.Target[]} The targets.
     */
    public getDownloadTargets(): deploy_targets.Target[] {
        const ME = this;
        
        return this.getTargets().filter(t => {
            return ME.getDownloadPlugins(t).length > 0;
        });
    }

    /**
     * Returns an existing path based on the settings folder.
     * 
     * @param {string} path The path.
     * 
     * @return {Promise<string|boolean>} The promise with the existing, full normalized path or (false) if path does not exist.
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
     * Returns the list of files of that workspace for deployment from an active document.
     * 
     * @return {Promise<string[]|false>} The promise with the file list or (false) if not possible.
     */
    public async getFileListFromActiveDocumentForDeployment(): Promise<string[] | false> {
        const ME = this;
        
        let activeDocument: vscode.TextDocument;
        
        const ACTIVE_EDITOR = vscode.window.activeTextEditor;
        if (ACTIVE_EDITOR) {
            activeDocument = ACTIVE_EDITOR.document;
        }

        if (!activeDocument) {
            ME.showWarningMessage(
                ME.t('editors.active.noOpen')
            );

            return false;
        }

        let range: vscode.Range;

        const SELECTION = ACTIVE_EDITOR.selection;
        if (SELECTION) {
            range = new vscode.Range(
                SELECTION.end,
                SELECTION.start,
            );
        }

        if (range) {
            if (_.isNil(range.start) && _.isNil(range.end)) {
                range = undefined;
            }
        }

        if (range) {
            if (_.isNil(range.start) && !_.isNil(range.end)) {
                range = new vscode.Range(
                    SELECTION.end,
                    SELECTION.end,
                );
            }
            else if (!_.isNil(range.start) && _.isNil(range.end)) {
                range = new vscode.Range(
                    SELECTION.start,
                    SELECTION.start,
                );
            }
        }

        if (range) {        
            if (range.start.isEqual(range.end)) {
                range = undefined;
            }
        }

        const LINES = deploy_helpers.toStringSafe( activeDocument.getText(range) ).split("\n").map(l => {
            return l.trim();
        }).filter(l => {
            return '' !== l;
        });

        const FILES: string[] = [];
        for (const L of LINES) {
            const FILE_OR_FOLDER = Path.resolve(
                Path.join(ME.rootPath, L)
            );

            if (!(await deploy_helpers.exists(FILE_OR_FOLDER))) {
                continue;
            }
            if (!ME.isPathOf(FILE_OR_FOLDER)) {
                continue;
            }

            const STATS = await deploy_helpers.lstat(FILE_OR_FOLDER);
            if (STATS.isDirectory()) {
                Enumerable.from(
                    await deploy_helpers.glob('**', {
                        cwd: FILE_OR_FOLDER,
                        root: FILE_OR_FOLDER,                    
                    })
                ).pushTo(FILES);
            }
            else if (STATS.isFile()) {
                FILES.push(FILE_OR_FOLDER);
            }
        }

        return Enumerable.from(FILES)
                         .where(f => !ME.isFileIgnored(f))
                         .select(f => Path.resolve(f))
                         .distinct()
                         .orderBy(f => Path.dirname(f).length)
                         .thenBy(f => deploy_helpers.normalizeString( Path.dirname(f) ))
                         .thenBy(f => Path.basename(f).length)
                         .thenBy(f => deploy_helpers.normalizeString( Path.basename(f) ))
                         .toArray();
    }

    /**
     * Returns a status bar button, that shows if a deploy operation has been finished.
     * 
     * @param {deploy_contracts.DeployOperation} operation The operation type.
     * 
     * @return {vscode.StatusBarItem} The button.
     */
    public getFinishedButton(operation: deploy_contracts.DeployOperation): vscode.StatusBarItem {
        const STATE = this.workspaceSessionState;
        if (STATE) {
            const BUTTONS = STATE['buttons'];
            if (BUTTONS) {
                let btn: FinishedButton;

                switch (operation) {
                    case deploy_contracts.DeployOperation.Deploy:
                        btn = BUTTONS[ KEY_FINISHED_BTN_DEPLOY ];
                        break;

                    case deploy_contracts.DeployOperation.Pull:
                        btn = BUTTONS[ KEY_FINISHED_BTN_PULL ];
                        break;

                    case deploy_contracts.DeployOperation.Delete:
                        btn = BUTTONS[ KEY_FINISHED_BTN_DELETE ];
                        break;
                }

                if (btn) {
                    return btn.button;
                }
            }
        }        
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

        return this.context.plugins.filter(pi => {
            return deploy_plugins.canList(pi, target);
        });
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

    private getPopupPrefix() {
        const PREFIXES: string[] = [];

        const CFG = this.config;
        if (CFG) {
            let showWorkspaceName = deploy_helpers.toBooleanSafe(CFG.showWorkspaceNameInPopups, true);
            if (showWorkspaceName && (this.context.workspaces.length < 1)) {
                showWorkspaceName = deploy_helpers.toBooleanSafe(CFG.alwaysShowWorkspaceNameInPopups);
            }

            if (showWorkspaceName) {
                PREFIXES.push( `[${this.name}]` );
            }
        }

        return PREFIXES.length > 0 ? (PREFIXES.join('::') + ' ')
                                   : '';
    }

    /**
     * Returns all plugins which can remove folders by target.
     * 
     * @param {deploy_targets.Target} target The target.
     * 
     * @return {deploy_plugins.Plugin[]} The plugins.
     */
    public getRemoveFolderPlugins(target: deploy_targets.Target) {
        if (!target) {
            return;
        }

        return this.context.plugins.filter(pi => {
            return deploy_plugins.canRemoveFolders(pi, target);
        });
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
            deploy_helpers.getExtensionDirInHome(),
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
     * @param {deploy_targets.TargetResolver} targetResolver A function to receive optional targets.
     * 
     * @return {deploy_targets.Target[]|false} The targets or (false) if at least one target could not be found
     *                                         or (false) if package cannot be handled by that workspace.
     */
    public getTargetsOfPackage(pkg: deploy_packages.Package, targetResolver: deploy_targets.TargetResolver): deploy_targets.Target[] | false {
        if (!pkg) {
            return;
        }

        if (!this.canBeHandledByMe(pkg)) {
            return false;
        }

        let targetNames: false | string[] = false;
        if (targetResolver) {
            targetNames = deploy_helpers.asArray( targetResolver() )
                                        .map(t => deploy_helpers.toStringSafe(t))
                                        .filter(t => !deploy_helpers.isEmptyString(t));
        }

        if (false === targetNames || targetNames.length < 1) {
            targetNames = deploy_helpers.asArray(pkg.targets).map(tn => {
                return deploy_helpers.normalizeString(tn);
            }).filter(tn => {
                return '' !== tn;
            });    
        }

        if (targetNames.length < 1) {
            return [];
        }

        return deploy_targets.getTargetsByName(targetNames, this.getTargets());
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
     * Returns a list of all TCP proxies handled by that workspace.
     * 
     * @return {deploy_proxies.TcpProxy[]} The list of proxies.
     */
    public getTcpProxies(): deploy_proxies.TcpProxy[] {
        return Enumerable.from( this._TCP_PROXIES )
                         .select(x => x.proxy)
                         .distinct(true)
                         .toArray();
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

        return this.context.plugins.filter(pi => {
            return deploy_plugins.canUpload(pi, target);
        });
    }

    /**
     * Gets all targets that can upload.
     * 
     * @return {deploy_targets.Target[]} The targets.
     */
    public getUploadTargets(): deploy_targets.Target[] {
        const ME = this;
        
        return this.getTargets().filter(t => {
            return ME.getUploadPlugins(t).length > 0;
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
            if (CFG) {
                if (CFG.env) {
                    importEnvVars = deploy_helpers.toBooleanSafe(CFG.env.importVarsAsPlaceholders, true);
                }
            }

            if (importEnvVars) {
                values = values.concat( deploy_values.getEnvVars() );
            }
        }
        catch (e) {
            ME.logger
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
                        ME.logger
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

    private async initBower(cfg: WorkspaceSettings) {
        if (!cfg) {
            return;
        }

        if (!deploy_helpers.toBooleanSafe(cfg.initBower)) {
            return;
        }

        const ME = this;

        try {
            const BOWER_JSON = Path.resolve(
                Path.join(
                    ME.rootPath, 'bower.json',
                )
            );

            const BOWER_COMPONENTS = Path.resolve(
                Path.join(
                    ME.rootPath, 'bower_components',
                )
            );

            if (!(await deploy_helpers.exists(BOWER_JSON))) {
                return;  // no 'bower.json'
            }

            if (await deploy_helpers.exists(BOWER_COMPONENTS)) {
                return;  // 'bower_components' already exist
            }

            ME.output.appendLine('');
            ME.output.append(
                ME.t('workspaces.bower.install.running',
                     ME.rootPath) + ' '
            );
            try {
                await ME.exec('bower install');

                ME.output.appendLine(
                    `[${ME.t('ok')}]`
                );
            }
            catch (e) {
                ME.output.appendLine(
                    `[${ME.t('error', e)}]`
                );
            }
        }
        catch (e) {
            ME.showErrorMessage(
                ME.t('workspaces.bower.install.errors.failed',
                     e)
            );
        }
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

            ME.output.appendLine('');
            ME.output.append(
                ME.t('workspaces.composer.install.running',
                     ME.rootPath) + ' '
            );
            try {
                await ME.exec('composer install');

                ME.output.appendLine(
                    `[${ME.t('ok')}]`
                );
            }
            catch (e) {
                ME.output.appendLine(
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

    private async initConfigFileWatchers(files: string[]) {
        const ME = this;

        Enumerable.from(files).select(f => Path.resolve(f)).distinct().forEach(f => {
            const FILE_URI = vscode.Uri.file(f);

            const HANDLE_FILE_CHANGE = async (type: deploy_contracts.FileChangeType) => {
                switch (type) {
                    case deploy_contracts.FileChangeType.Changed:
                    case deploy_contracts.FileChangeType.Created:
                        await ME.reloadConfiguration();
                        break;
                }
            };

            const TRIGGER_CONFIG_FILE_CHANGE = (e: vscode.Uri, type: deploy_contracts.FileChangeType) => {
                try {
                    if (ME.isInFinalizeState) {
                        return;
                    }

                    if (!ME.isInitialized) {
                        return;
                    }

                    if (Path.resolve(e.fsPath) === Path.resolve(FILE_URI.fsPath)) {
                        HANDLE_FILE_CHANGE(type).then(() => {                                
                        }, (err) => {
                            ME.logger
                                .trace(e, 'workspaces.Workspace.initConfigFileWatchers(4)');
                        });
                    }
                }
                catch (e) {
                    ME.logger
                        .trace(e, 'workspaces.Workspace.initConfigFileWatchers(3)');
                }
            };

            let newWatcher: vscode.FileSystemWatcher;
            try {
                const BASE = vscode.Uri.file(Path.dirname(f));
                const PATTERN = Path.basename(f);

                newWatcher = vscode.workspace.createFileSystemWatcher(
                    new vscode.RelativePattern(
                        BASE.fsPath, PATTERN
                    ),
                    false, false, false,
                );

                newWatcher.onDidChange((e) => {
                    TRIGGER_CONFIG_FILE_CHANGE(e, deploy_contracts.FileChangeType.Changed);
                });
                newWatcher.onDidCreate((e) => {
                    TRIGGER_CONFIG_FILE_CHANGE(e, deploy_contracts.FileChangeType.Created);
                });
                newWatcher.onDidDelete((e) => {
                    TRIGGER_CONFIG_FILE_CHANGE(e, deploy_contracts.FileChangeType.Deleted);
                });

                ME._CONFIG_FILE_WATCHERS.push(newWatcher);
            }
            catch (e) {
                ME.logger
                  .trace(e, 'workspaces.Workspace.initConfigFileWatchers(2)');

                deploy_helpers.tryDispose(newWatcher);
            }
        });
    }

    private initFinishedButtons(state: deploy_contracts.KeyValuePairs) {
        const ID = nextFinishedBtnIds++;

        this.disposeFinishedButtons();

        state['timeouts'][ KEY_FINISHED_BTNS ] = {};

        const DEPLOY_BTN: FinishedButton = state['buttons'][KEY_FINISHED_BTN_DEPLOY] = this.createFinishedButton(
            state, KEY_FINISHED_BTN_DEPLOY, ID
        );
        const DELETE_BTN: FinishedButton = state['buttons'][KEY_FINISHED_BTN_DELETE] = this.createFinishedButton(
            state, KEY_FINISHED_BTN_DELETE, ID
        );
        const PULL_BTN: FinishedButton = state['buttons'][KEY_FINISHED_BTN_PULL] = this.createFinishedButton(
            state, KEY_FINISHED_BTN_PULL, ID
        );
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

        ME.setupLogger();
        ME.setupOutputChannel();

        ME._rootPath = false;

        ME.vars[ deploy_api.WS_VAR_APIS ] = [];

        // settings file
        {
            interface SettingsData {
                file: string;
                section: string;
            }

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
                    ME.logger
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
                    ME.logger
                      .trace(e, 'workspaces.Workspace.initialize(2)');
                }

                return false;
            };

            ME._gitFolder = await searchForNextFolder(
                ME.folder.uri.fsPath
            );
        }

        await ME.reloadConfiguration();

        // file system watcher
        {
            const TRIGGER_FILE_CHANGE_EVENT = (e: vscode.Uri, type: deploy_contracts.FileChangeType) => {
                ME.onDidFileChange(e, type).then(() => {
                }, (err) => {
                    ME.logger
                      .trace(err, 'workspaces.Workspace.initialize(3)');
                });
            };

            this.context.fileWatcher.onDidChange((e) => {
                TRIGGER_FILE_CHANGE_EVENT(e, deploy_contracts.FileChangeType.Changed);
            });

            this.context.fileWatcher.onDidCreate((e) => {
                TRIGGER_FILE_CHANGE_EVENT(e, deploy_contracts.FileChangeType.Created);
            });

            this.context.fileWatcher.onDidDelete((e) => {
                TRIGGER_FILE_CHANGE_EVENT(e, deploy_contracts.FileChangeType.Deleted);
            });
        }

        ME._startTime = Moment();
        ME._isInitialized = true;

        return true;
    }

    private async initNodeModules(cfg: WorkspaceSettings) {
        if (!cfg) {
            return;
        }

        const USE_YARN = deploy_helpers.toBooleanSafe(cfg.initYarn);

        if (!deploy_helpers.toBooleanSafe(cfg.initNodeModules) && !USE_YARN) {
            return;
        }

        const ME = this;

        let langErrId: string;
        if (USE_YARN) {
            langErrId = 'workspaces.yarn.install.errors.failed';
        }
        else {
            langErrId = 'workspaces.npm.install.errors.failed';
        }

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

            let cmd: string;
            let langId: string;
            if (USE_YARN) {
                cmd = 'yarn install';
                langId = 'workspaces.yarn.install.running';                
            }
            else {
                cmd = 'npm install';
                langId = 'workspaces.npm.install.running';
            }

            ME.output.appendLine('');
            ME.output.append(
                ME.t(langId,
                     ME.rootPath) + ' '
            );
            try {
                await ME.exec(cmd);

                ME.output.appendLine(
                    `[${ME.t('ok')}]`
                );
            }
            catch (e) {
                ME.output.appendLine(
                    `[${ME.t('error', e)}]`
                );
            }
        }
        catch (e) {
            ME.showErrorMessage(
                ME.t(langErrId, e)
            );
        }
    }

    /**
     * Invokes an action for a status bar button that is shown after a deploy operation.
     * 
     * @param {deploy_contracts.DeployOperation} operation The operation type.
     * @param {Function} action The action to invoke.
     * 
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public async invokeForFinishedButton(
        operation: deploy_contracts.DeployOperation,
        action: (btn: vscode.StatusBarItem) => any
    )
    {
        try {
            const BTN = this.getFinishedButton(operation);
            if (BTN) {
                if (action) {
                    await Promise.resolve(
                        action(BTN)
                    );
                }
            }

            return true;
        }
        catch (e) {
            this.logger
                .trace(e, 'workspaces.Workspace.invokeForFinishedButton(1)');
        }
        
        return false;
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
     * Gets if 'deploy on change' is currently freezed or not.
     */
    public get isDeployOnSaveFreezed() {
        return this._isDeployOnSaveFreezed;
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

        if (deploy_helpers.toBooleanSafe(this.config.ignoreSettingsFolder, true)) {
            if (this.isInSettingsFolder(file)) {
                return true;  // not from settings folder
            }
        }

        if (deploy_helpers.toBooleanSafe(this.config.ignoreGitFolder, true)) {
            if (this.isInGitFolder(file)) {
                return true;  // not from Git folder
            }
        }

        if (deploy_helpers.toBooleanSafe(this.config.ignoreSvnFolder, true)) {
            if (this.isInSvnFolder(file)) {
                return true;  // not from SVN folder
            }
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

    private isInFolder(folder: string, pathToCheck: string) {
        folder = deploy_helpers.toStringSafe(folder);
        if (!Path.isAbsolute(pathToCheck)) {
            folder = Path.join(this.rootPath, folder);
        }
        folder = Path.resolve(folder);
    
        pathToCheck = deploy_helpers.toStringSafe(pathToCheck);
        if (!Path.isAbsolute(pathToCheck)) {
            return true;
        }
        pathToCheck = Path.resolve(pathToCheck);
    
        return (folder === pathToCheck) ||
               (pathToCheck + Path.sep).startsWith(folder + Path.sep);
    }

    /**
     * Checks if a path is inside the Git folder.
     * 
     * @param {string} path The path to check.
     * 
     * @return {boolean} Is in Git folder or not.
     */
    public isInGitFolder(path: string) {
        return this.isInFolder(
            Path.join(
                this.rootPath,
                '.git'
            ), path
        );
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
        return this.isInFolder(
            Path.dirname(this.configSource.resource.fsPath),
            path,
        );
    }

    /**
     * Checks if a path is inside the Git folder.
     * 
     * @param {string} path The path to check.
     * 
     * @return {boolean} Is in Git folder or not.
     */
    public isInSvnFolder(path: string) {
        return this.isInFolder(
            Path.join(
                this.rootPath,
                '.svn'
            ), path
        );
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
     * Lists the files and folders inside that workspace.
     * 
     * @param {string} [dir] The directory inside that workspace.
     * 
     * @return {WorkspaceListDirectoryResult|false} The result or (false) if directory is invalid.
     */
    public async listWorkspaceDirectory(dir = ''): Promise<WorkspaceListDirectoryResult | false> {
        dir = deploy_helpers.toStringSafe(dir);
        if (deploy_helpers.isEmptyString(dir)) {
            dir = './';
        }

        if (!Path.isAbsolute(dir)) {
            dir = Path.join(this.rootPath, dir);
        }
        dir = Path.resolve(dir);

        const REL_PATH = this.toRelativePath(dir);
        if (false === REL_PATH) {
            return false;
        }

        const GET_TYPE = (stats: FS.Stats) => {
            let type: deploy_files.FileSystemType;
            if (stats) {
                if (stats.isDirectory()) {
                    type = deploy_files.FileSystemType.Directory;
                }
                else if (stats.isFile()) {
                    type = deploy_files.FileSystemType.File;
                }
            }

            return type;
        };

        const MY_STATS = await deploy_helpers.lstat(dir);

        const RESULT: WorkspaceListDirectoryResult = {
            dirs: [],
            files: [],
            info: {
                exportPath: dir,
                name: Path.basename(dir),
                path: deploy_helpers.normalizePath(REL_PATH),
                size: GET_TYPE(MY_STATS) === deploy_files.FileSystemType.File ? MY_STATS.size : undefined,
                time: Moment(MY_STATS.mtime),
                type: GET_TYPE(MY_STATS),
            },
            others: [],
            workspace: this,
        };

        const CREATE_DOWNLOAD_METHOD = (f: string) => {
            return async () => {
                return deploy_helpers.readFile(f);
            };
        };

        const FILES_AND_FOLDERS = Enumerable.from(
            await deploy_helpers.readDir(dir)
        ).orderBy(f => {
            return deploy_helpers.normalizeString(f);
        });

        for (const F of FILES_AND_FOLDERS) {
            const FULL_PATH = Path.resolve(
                Path.join(dir, F)
            );

            const ITEM_PATH = deploy_helpers.normalizePath(
                deploy_helpers.normalizePath(REL_PATH) +
                '/' + 
                RESULT.info.name,
            );

            const FILE_STATS = await deploy_helpers.lstat(FULL_PATH);

            const TIME = Moment(FILE_STATS.mtime);

            if (FILE_STATS.isDirectory()) {
                const DI: deploy_files.DirectoryInfo = {
                    exportPath: FULL_PATH,
                    name: F,
                    path: ITEM_PATH,
                    size: undefined,
                    time: TIME,
                    type: deploy_files.FileSystemType.Directory,
                };

                RESULT.dirs.push(DI);
            }
            else if (FILE_STATS.isFile()) {
                const FI: deploy_files.FileInfo = {
                    download: CREATE_DOWNLOAD_METHOD(FULL_PATH),
                    exportPath: FULL_PATH,
                    name: F,
                    path: ITEM_PATH,
                    size: FILE_STATS.size,
                    time: TIME,
                    type: deploy_files.FileSystemType.File,
                };

                RESULT.files.push(FI);
            }
            else {
                const FSI: deploy_files.FileSystemInfo = {
                    exportPath: FULL_PATH,
                    name: F,
                    path: ITEM_PATH,
                    size: undefined,
                    time: TIME,
                    type: undefined,
                };

                RESULT.others.push(FSI);
            }
        }

        return RESULT;
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
     * Gets the logger of that workspace.
     */
    public get logger(): deploy_log.Logger {
        return this._LOGGER;
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
                        this.logger
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

    private async onDidFileChange(e: vscode.Uri, type: deploy_contracts.FileChangeType, retry = true) {
        const ME = this;

        try {
            if (!ME.canDoAutoOperations) {
                return;
            }

            if (!ME.isPathOf(e.fsPath)) {
                return;
            }

            const MY_ARGS = arguments;

            if (!_.isNil(FILES_CHANGES[e.fsPath])) {
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
        catch (e) {
            ME.logger
              .trace(e, 'workspaces.Workspace.onDidFileChange(1)');
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
        deploy_helpers.applyFuncFor(
            deploy_api.disposeApiHosts, this
        )();

        this.disposeTcpProxies();

        // file system watchers
        this.disposeConfigFileWatchers();
        deploy_helpers.tryDispose(this.context.fileWatcher);

        this.disposeFinishedButtons();

        // output channel
        deploy_helpers.tryDispose(this._OUTPUT_CHANNEL);

        // and last but not least:
        // dispose logger
        try {
            this._LOGGER.clear();
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'workspaces.Workspace.onDispose(1)');
        }
    }

    /**
     * Gets the name of that workspace.
     */
    public get name(): string {
        return Path.basename(this.rootPath);
    }

    /**
     * Gets the output channel of that workspace.
     */
    public get output(): vscode.OutputChannel {
        return this._OUTPUT_CHANNEL;
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

                    // collect 'prepare' operations
                    const PREPARE_OF_CHILDREN = Enumerable.from( deploy_helpers.asArray(CHILD_TARGETS) ).selectMany(ct => {
                        return deploy_helpers.asArray(ct.prepare);
                    }).toArray();
                    const MY_PREPARE = deploy_helpers.asArray(target.prepare);

                    // prepare
                    (<any>target).prepare = MY_PREPARE.concat(
                        PREPARE_OF_CHILDREN
                    );

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
     * @param {deploy_targets.TargetResolver} [targetResolver] A function to receive optional targets.
     */
    public async pullPackage(pkg: deploy_packages.Package, targetResolver?: deploy_targets.TargetResolver) {
        await deploy_helpers.applyFuncFor(
            deploy_pull.pullPackage,
            this
        )(pkg, targetResolver);
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
        this.disposeConfigFileWatchers();

        const SCOPES = ME.getSettingScopes();

        let finalizer: () => any;
        try {
            ME.cleanupTimeouts();
            deploy_helpers.applyFuncFor(deploy_commands.cleanupCommands, ME)();

            ME._isDeployOnChangeFreezed = false;
            ME._isDeployOnSaveFreezed = false;
            ME._isRemoveOnChangeFreezed = false;

            const IMPORTED_LOCAL_FILES: string[] = [];            
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

                    const DOWNLOAD_RESULT: deploy_download.DownloadOutValue = {
                    };
                    const DATA = await deploy_download.download(
                        importFile, SCOPES, DOWNLOAD_RESULT
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

                    if (deploy_download.DownloadSourceType.Local === DOWNLOAD_RESULT.source) {
                        IMPORTED_LOCAL_FILES.push(DOWNLOAD_RESULT.fullPath);
                    }
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
                ME.logger
                  .trace(e, 'workspaces.reloadConfiguration(1)');
            }

            ME._translator = null;
            try {
                ME._translator = await deploy_helpers.applyFuncFor(i18.initForWorkspace, ME)();
            }
            catch (e) {
                ME.logger
                  .trace(e, 'workspaces.reloadConfiguration(2)');
            }

            if (deploy_helpers.toBooleanSafe(loadedCfg.clearOutputOnStartup)) {
                ME.output.clear();
            }
            if (deploy_helpers.toBooleanSafe(loadedCfg.openOutputOnStartup)) {
                ME.output.show();
            }

            finalizer = async () => {
                await ME.executeOnStartup(loadedCfg);
                await ME.initNodeModules(loadedCfg);
                await ME.initBower(loadedCfg);
                await ME.initComposer(loadedCfg);

                // runBuildTaskOnStartup
                try {
                    await deploy_tasks.runBuildTaskOnStartup
                                      .apply(ME, []);
                }
                catch (e) {
                    ME.logger
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

                        ME.output.appendLine('');
                        ME.output.appendLine(
                            ME.t('deploy.onChange.waitingBeforeActivate',
                                 Math.round(TIME_TO_WAIT_BEFORE_ACTIVATE_DEPLOY_ON_CHANGE / 1000.0),
                                 ME.rootPath)
                        );

                        ME._TIMEOUTS.push(
                            setTimeout(() => {
                                ME._isDeployOnChangeFreezed = false;

                                ME.output.appendLine('');
                                ME.output.appendLine(
                                    ME.t('deploy.onChange.activated',
                                         ME.rootPath)
                                );
                            }, TIME_TO_WAIT_BEFORE_ACTIVATE_DEPLOY_ON_CHANGE)
                        );
                    }
                }
                catch (e) {
                    ME.logger
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

                        ME.output.appendLine('');
                        ME.output.appendLine(
                            ME.t('DELETE.onChange.waitingBeforeActivate',
                                 Math.round(TIME_TO_WAIT_BEFORE_ACTIVATE_REMOVE_ON_CHANGE / 1000.0),
                                 ME.rootPath)
                        );

                        ME._TIMEOUTS.push(
                            setTimeout(() => {
                                ME._isRemoveOnChangeFreezed = false;

                                ME.output.appendLine('');
                                ME.output.appendLine(
                                    ME.t('DELETE.onChange.activated',
                                         ME.rootPath)
                                );
                            }, TIME_TO_WAIT_BEFORE_ACTIVATE_REMOVE_ON_CHANGE)
                        );
                    }
                }
                catch (e) {
                    ME.logger
                      .trace(e, 'workspaces.reloadConfiguration(6)');

                    ME._isRemoveOnChangeFreezed = false;
                }

                await ME.reloadPackageButtons();
                await ME.reloadSwitches();

                // executeStartupCommands
                await deploy_helpers.applyFuncFor(
                    deploy_commands.executeStartupCommands, ME
                )();

                // reloadApiHosts
                await deploy_helpers.applyFuncFor(
                    deploy_api.reloadApiHosts, ME
                )();

                await ME.reloadTcpProxies();

                await ME.initConfigFileWatchers(IMPORTED_LOCAL_FILES);
            };
        }
        catch (e) {
            ME.logger
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
                    ME.logger
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
            this.logger
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
            
            if (!_.isNil(P.button)) {
                if (deploy_helpers.isObject<deploy_packages.PackageButton>(P.button)) {
                    buttonDesc = P.button;
                }
                else if (_.isBoolean(P.button)) {
                    if (true === P.button) {
                        buttonDesc = {
                            text: DEFAULT_BTN_TEXT,
                            tooltip: DEFAULT_BTN_TOOLTIP,
                        };
                    }
                }
                else {
                    let btnText = deploy_helpers.toStringSafe(P.button);
                    if (deploy_helpers.isEmptyString(btnText)) {
                        btnText = DEFAULT_BTN_TEXT;
                    }

                    buttonDesc = {
                        text: btnText,
                        tooltip: DEFAULT_BTN_TOOLTIP,
                    };
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
                    const PACKAGE_TO_HANDLE = P;
                    const PACKAGE_NAME = deploy_packages.getPackageName(PACKAGE_TO_HANDLE);

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

                    const TARGET_RESOLVER: deploy_targets.TargetResolver = () => buttonDesc.targets;

                    if ((await vscode.commands.getCommands()).indexOf(newCmdId) < 0) {
                        newBtnCommand = vscode.commands.registerCommand(newCmdId, async () => {
                            let deployAction: (() => Promise<void>) | false = false;

                            try {
                                let promptMsg: string;
                                const DEPLOY_TYPE = deploy_helpers.normalizeString(pb.type);
                                switch (DEPLOY_TYPE) {
                                    case "":
                                    case "deploy":
                                        deployAction = async () => {
                                            await ME.deployPackage(PACKAGE_TO_HANDLE, TARGET_RESOLVER);
                                        };
                                        promptMsg = 'askBeforeDeploy';
                                        break;

                                    case "delete":
                                        deployAction = async () => {
                                            await ME.deletePackage(PACKAGE_TO_HANDLE, TARGET_RESOLVER);
                                        };
                                        promptMsg = 'askBeforeDelete';
                                        break;

                                    case "pull":
                                        deployAction = async () => {
                                            await ME.pullPackage(PACKAGE_TO_HANDLE, TARGET_RESOLVER);
                                        };
                                        promptMsg = 'askBeforePull';
                                        break;
                                }

                                if (false === deployAction) {
                                    await ME.showWarningMessage(
                                        ME.t('packages.buttons.unknownOperationType',
                                             DEPLOY_TYPE)
                                    );

                                    return;
                                }

                                if (deploy_helpers.toBooleanSafe(pb.showPrompt)) {
                                    const SELECTED_ITEM = await vscode.window.showWarningMessage<deploy_contracts.MessageItemWithValue>(
                                        ME.t(`packages.buttons.prompts.${promptMsg}`,
                                             PACKAGE_NAME),

                                        {
                                            title: ME.t('no'),
                                            isCloseAffordance: true,
                                            value: 0,
                                        },
                                        {
                                            title: ME.t('yes'),
                                            value: 1,
                                        }
                                    );

                                    let selectedValue: number;
                                    if (SELECTED_ITEM) {
                                        selectedValue = SELECTED_ITEM.value;
                                    }
                                    
                                    if (1 !== selectedValue) {
                                        return;
                                    }
                                }

                                await deployAction();
                            }
                            catch (e) {
                                await ME.showErrorMessage(
                                    ME.t('packages.deploymentFailed',
                                         deploy_packages.getPackageName(PACKAGE_TO_HANDLE))
                                );
                            }
                        });

                        ME.logger
                          .info(`Registrated command '${newCmdId}' for button of package '${PACKAGE_NAME}'.`,
                                'workspaces.Workspace.reloadPackageButtons()');
                    }
                    else {
                        ME.logger
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
                        package: PACKAGE_TO_HANDLE,
                    });

                    b.show();
                });
            }
            catch (e) {
                ME.logger
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
            
            (<any>p)['__cache'] = new deploy_helpers.MemoryCache();

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

    private async reloadTcpProxies() {
        const ME = this;

        ME.disposeTcpProxies();

        const CFG = ME.config;
        if (!CFG) {
            return;
        }

        const PROXY_LIST = CFG.proxies;
        if (!PROXY_LIST) {
            return;
        }

        const SETUP_LOGGING = (proxy: deploy_proxies.TcpProxy) => {
            ME._TCP_PROXY_LOGGERS.push(
                deploy_proxies.registerLoggingForTcpProxy(
                    proxy,
                    () => ME.logger,
                )
            );
        };

        const ADD_PROXY_FILTER = (proxy: deploy_proxies.TcpProxy, settings: deploy_proxies.ProxySettings) => {
            const ALLOWED = deploy_helpers.asArray(settings.allowed).map(a => {
                return deploy_helpers.toStringSafe(a)
                                     .trim();
            }).filter(a => '' !== a).map(a => {
                if (a.indexOf('/') < 0) {
                    if (ip.isV4Format(a)) {
                        a += "/32";
                    }
                    else {
                        a += "/128";
                    }
                }

                return a;
            });

            ME._TCP_PROXY_FILTERS.push(
                proxy.addFilter((addr, port) => {
                    if (ALLOWED.length > 0) {
                        if (!ip.isLoopback( addr )) {
                            return Enumerable.from(ALLOWED)
                                             .any(a => ip.cidrSubnet(a)
                                                         .contains(addr));

                        }
                    }

                    return true;
                })
            );
        };

        const SET_NAME_AND_DESC_RESOLVER = (proxy: deploy_proxies.TcpProxy, settings: deploy_proxies.ProxySettings) => {
            proxy.setNameAndDescriptionResolver(
                ME,
                () => {
                    const ADDITIONAL_VALUES: deploy_values.Value[] = [
                        new deploy_values.FunctionValue(() => {
                            return deploy_helpers.toStringSafe(proxy.port);
                        }, 'proxyPort')
                    ];

                    let name = deploy_helpers.toStringSafe(
                        ME.replaceWithValues(settings.name, ADDITIONAL_VALUES)
                    ).trim();
                    if ('' === name) {
                        name = undefined;
                    }

                    let desc = deploy_helpers.toStringSafe(
                        ME.replaceWithValues(settings.description, ADDITIONAL_VALUES)
                    ).trim();
                    if ('' === desc) {
                        desc = undefined;
                    }

                    return {
                        description: desc,
                        name: name,
                    };
                }
            );
        };

        const SETUP_PROXY_BUTTON = async (proxy: deploy_proxies.TcpProxy, settings: deploy_proxies.ProxySettings) => {
            const BTN_ID = nextTcpProxyButtonId++;

            let btn: deploy_proxies.ProxyButton;
            if (_.isNil(settings.button)) {
                btn = {};
            }
            else {
                if (deploy_helpers.isObject<deploy_proxies.ProxyButton>(settings.button)) {
                    btn = settings.button;
                }
                else if (_.isBoolean(settings.button)) {
                    btn = {
                        enabled: settings.button,
                    };
                }
                else {
                    btn = {
                        text: deploy_helpers.toStringSafe( settings.button ),
                    };
                }
            }            

            if (!btn || !deploy_helpers.toBooleanSafe(btn.enabled, true)) {
                return;
            }

            const GET_PROXY_NAME = () => {
                return proxy.getNameAndDescriptionFor(ME).name;
            };

            const GET_STATE_ICON = () => {
                return '$(' + (proxy.isRunning ? 'triangle-right' : 'primitive-square') + ')';
            };

            const ADDITIONAL_BTN_VALUES: deploy_values.Value[] = [
                new deploy_values.FunctionValue(() => {
                    return GET_PROXY_NAME();
                }, 'proxy'),
                new deploy_values.FunctionValue(() => {
                    return deploy_helpers.toStringSafe( proxy.port );
                }, 'proxyPort'),
                new deploy_values.FunctionValue(() => {
                    return GET_STATE_ICON();
                }, 'proxyStateIcon'),
            ];

            let guiBtn: vscode.StatusBarItem;
            let btnCmd: vscode.Disposable;
            let defaultColor: string | vscode.ThemeColor;
            const DISPOSE_BUTTON = () => {
                deploy_helpers.tryDispose(guiBtn);
                deploy_helpers.tryDispose(btnCmd);
            };

            const UPDATE_BUTTON = () => {
                const GB = guiBtn;
                if (!GB) {
                    return;
                }

                try {
                    let text = deploy_helpers.toStringSafe(
                        ME.replaceWithValues(btn.text, ADDITIONAL_BTN_VALUES)
                    ).trim();
                    if ('' === text) {
                        text = GET_STATE_ICON() + '  ' + ME.t('proxies.buttons.defaultText',
                                                              GET_PROXY_NAME());
                    }

                    let tooltip = deploy_helpers.toStringSafe(
                        ME.replaceWithValues(btn.tooltip, ADDITIONAL_BTN_VALUES)
                    ).trim();
                    if ('' === tooltip) {
                        tooltip = ME.t('proxies.buttons.defaultTooltip');
                    }

                    let newColor = defaultColor;
                    if (!proxy.isRunning) {
                        if (deploy_helpers.isEmptyString(btn.stopColor)) {
                            newColor = new vscode.ThemeColor('panelTitle.inactiveForeground');
                        }
                        else {
                            newColor = deploy_helpers.normalizeString( btn.stopColor );
                        }
                    }

                    if (GB.text !== text) {
                        GB.text = text;
                    }
                    if (GB.tooltip !== tooltip) {
                        GB.tooltip = tooltip;
                    }
                    if (GB.color !== newColor) {
                        GB.color = newColor;
                    }
                }
                catch (e) {
                    this.logger
                        .trace(e, 'workspaces.Workspace.reloadTcpProxies.SETUP_PROXY_BUTTON.UPDATE_BUTTON(1)');
                }
            };

            const START_STOP_EVENT_LISTENER = () => {
                UPDATE_BUTTON();
            };

            const REMOVE_EVENT_LISTENERS = () => {
                proxy.removeListener(deploy_proxies.EVENT_STARTED, START_STOP_EVENT_LISTENER);
                proxy.removeListener(deploy_proxies.EVENT_STOPPED, START_STOP_EVENT_LISTENER);
            };

            try {
                const CMD_NAME = `extension.deploy.reloaded.buttons.tcpProxy${BTN_ID}`;

                btnCmd = vscode.commands.registerCommand(CMD_NAME, async () => {
                    try {
                        await proxy.toggle();
                    }
                    catch (e) {
                        ME.showErrorMessage(
                            ME.t('proxies.errors.couldNotToggleRunningState',
                                 proxy.getNameAndDescriptionFor(ME).name,
                                 e)
                        );
                    }
                    finally {
                        UPDATE_BUTTON();
                    }
                });

                guiBtn = await deploy_helpers.createButton(btn, (b) => {
                    b.command = CMD_NAME;
                });
                defaultColor = guiBtn.color;

                proxy.on(deploy_proxies.EVENT_STARTED, START_STOP_EVENT_LISTENER);
                proxy.on(deploy_proxies.EVENT_STOPPED, START_STOP_EVENT_LISTENER);    

                ME._TCP_PROXY_BUTTONS.push({
                    button: guiBtn,
                    command: btnCmd,
                    dispose: function() {
                        REMOVE_EVENT_LISTENERS();
                        DISPOSE_BUTTON();
                    },
                    proxy: proxy,
                    proxySettings: settings,                    
                    settings: btn,                    
                });

                UPDATE_BUTTON();

                guiBtn.show();
            }
            catch (e) {
                DISPOSE_BUTTON();

                throw e;
            }
        };

        for (const P in PROXY_LIST) {
            const PROXY_ENTRY = PROXY_LIST[ P ];
            
            if (deploy_helpers.filterPlatformItems( PROXY_ENTRY ).length < 1) {
                continue;  // not for platform
            }
            if (ME.filterConditionalItems( PROXY_ENTRY ).length < 1) {
                continue;  // filter does not match
            }
            
            const PORT = parseInt(
                deploy_helpers.toStringSafe(P)
            );

            const ADDITIONAL_PROXY_VALUES: deploy_values.Value[] = [
                new deploy_values.FunctionValue(() => {
                    return deploy_helpers.toStringSafe( PORT );
                }, 'proxyPort'),
            ];

            try {
                const PROXY = deploy_proxies.getTcpProxy(PORT);

                if (deploy_helpers.toBooleanSafe(PROXY_ENTRY.debug)) {
                    SETUP_LOGGING(PROXY);
                }

                if (!_.isNil(PROXY_ENTRY.destination)) {
                    const DV = PROXY_ENTRY.destination;

                    let d: deploy_proxies.ProxyDestination;
                    if (deploy_helpers.isObject<deploy_proxies.ProxyDestination>(DV)) {
                        d = DV;
                    }
                    else if (_.isNumber(DV)) {
                        d = {
                            port: DV,
                        };
                    }
                    else {
                        let addr: string;
                        let port: number;

                        const ADDR_AND_PORT = deploy_helpers.toStringSafe(
                            ME.replaceWithValues(DV, ADDITIONAL_PROXY_VALUES)
                        );

                        const SEP = ADDR_AND_PORT.indexOf(':');
                        if (SEP > -1) {
                            addr = addr.substr(0, SEP);
                            port = parseInt(
                                addr.substr(SEP + 1).trim()
                            );
                        }
                        else {
                            addr = ADDR_AND_PORT;
                        }

                        d = {
                            address: addr.trim(),
                            port: port,
                        };
                    }

                    if (deploy_helpers.filterPlatformItems( d ).length > 0) {
                        if (ME.filterConditionalItems( d ).length > 0) {                            
                            // filters match

                            ADD_PROXY_FILTER(PROXY, PROXY_ENTRY);
                            SET_NAME_AND_DESC_RESOLVER(PROXY, PROXY_ENTRY);

                            ME._TCP_PROXIES.push(
                                PROXY.addDestination(
                                    d.address, d.port,
                                )
                            );                                    
                        }    
                    }
                }
                
                if (deploy_helpers.toBooleanSafe(PROXY_ENTRY.autoStart, true)) {
                    if (!PROXY.isRunning) {
                        await PROXY.start();
                    }
                }
                
                await SETUP_PROXY_BUTTON(PROXY, PROXY_ENTRY);
            }
            catch (e) {
                ME.showErrorMessage(
                    ME.t('proxies.errors.couldNotRegister',
                         PORT, e)
                );
            }
        }
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
                            ME.logger
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
            ME.logger
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

            (<any>t)['__cache'] = new deploy_helpers.MemoryCache();
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
                await deploy_helpers.applyFuncFor(
                    deploy_packages.removeOnChange,
                    this
                )(file);
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
     * Sets a timeout for a "finished button".
     * 
     * @param {deploy_contracts.DeployOperation} operation The type of deploy operation.
     * @param {Function} callback The callback.
     * @param {number} [ms] The custom number of milliseconds.
     * 
     * @return {boolean} Operation was successful or not.
     */
    public setTimeoutForFinishedButton(
        operation: deploy_contracts.DeployOperation,
        callback: (btn: vscode.StatusBarItem) => any,
        ms = 60000,
    ) {
        const ME = this;

        const STATE = ME.workspaceSessionState;
        if (STATE) {
            let timeouts: deploy_contracts.KeyValuePairs;
            if (STATE['timeouts']) {
                timeouts = STATE['timeouts'][ KEY_FINISHED_BTNS ];
            }

            if (timeouts) {
                let key: string | false = false;

                switch (operation) {
                    case deploy_contracts.DeployOperation.Deploy:
                        key = KEY_FINISHED_BTN_DEPLOY;
                        break;

                    case deploy_contracts.DeployOperation.Pull:
                        key = KEY_FINISHED_BTN_PULL;
                        break;

                    case deploy_contracts.DeployOperation.Delete:
                        key = KEY_FINISHED_BTN_DELETE;
                        break;
                }

                if (false !== key) {
                    deploy_helpers.tryDispose( timeouts[key] );

                    const BTN = ME.getFinishedButton(operation);
                    if (BTN) {
                        timeouts[key] = deploy_helpers.createTimeout(() => {
                            try {
                                if (callback) {
                                    Promise.resolve( callback(BTN) ).then(() => {                                    
                                    }, (err) => {
                                        ME.logger
                                          .trace(err, 'workspaces.Workspace.setTimeoutForFinishedButton(2)');
                                    });
                                }
                            }
                            catch (e) {
                                ME.logger
                                  .trace(e, 'workspaces.Workspace.setTimeoutForFinishedButton(1)');
                            }
                        }, ms);

                        return true;
                    }
                }
            }
        }

        return false;
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

    private setupLogger() {
        // console
        this._LOGGER.addAction((ctx) => {
            deploy_log.CONSOLE
                      .log(ctx.type, ctx.message, ctx.tag);
        });

        //TODO: add actions from config
    }

    private setupOutputChannel() {
        //TODO: add writers from config
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
                                      .apply(null, [ <any>`${this.getPopupPrefix()}${msg}`.trim() ].concat(items));
        }
        catch (e) {
            this.logger
                .trace(e, 'workspaces.Workspace.showErrorMessage()');
        }
    }

    /**
     * Shows a "finished button".
     * 
     * @param {deploy_contracts.DeployOperation} operation The type of deploy operation.
     * 
     * @return {boolean} Operation was successful or not.
     */
    public showFinishedButton(operation: deploy_contracts.DeployOperation) {
        const CFG = this.config;
        if (!CFG) {
            return;
        }

        const BTN = this.getFinishedButton(operation);
        if (BTN) {
            const SHOW_STATUS_WHEN_FINISHED = CFG.showStatusWhenFinished;            

            let showButton = !_.isUndefined(SHOW_STATUS_WHEN_FINISHED);
            let hideAfter: number;
            if (showButton) {
                if (null !== SHOW_STATUS_WHEN_FINISHED) {
                    if (_.isBoolean(SHOW_STATUS_WHEN_FINISHED)) {
                        showButton = SHOW_STATUS_WHEN_FINISHED;
                        hideAfter = 60000;
                    }
                    else {
                        hideAfter = parseInt(
                            deploy_helpers.toStringSafe(SHOW_STATUS_WHEN_FINISHED).trim()
                        );
                    }   
                }
            }

            if (showButton) {
                BTN.show();

                if (!isNaN(hideAfter)) {
                    this.setTimeoutForFinishedButton(
                        operation,
                        (b) => b.hide(),
                        hideAfter,
                    );
                }
            }

            return true;
        }

        return false;
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
                                      .apply(null, [ <any>`${this.getPopupPrefix()}${msg}`.trim() ].concat(items));
        }
        catch (e) {
            this.logger
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
            placeHolder: this.t('workspaces.selectTarget',
                                this.name)
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
                                      .apply(null, [ <any>`${this.getPopupPrefix()}${msg}`.trim() ].concat(items));
        }
        catch (e) {
            this.logger
                .trace(e, 'workspaces.Workspace.showWarningMessage()');
        }
    }

    /**
     * Starts a deployment of files from the file list of an active document.
     * 
     * @param {Function} deployAction The deploy action.
     * 
     * @return {Promise<boolean>} The promise that indicates if action has been invoked or not.
     */
    public async startDeploymentOfFilesFromActiveDocument(
        deployAction: (target: deploy_targets.Target, files: string[]) => any,
    ): Promise<boolean> {
        const ME = this;

        const FILES_TO_DEPLOY = await ME.getFileListFromActiveDocumentForDeployment();
        if (!FILES_TO_DEPLOY) {
            return false;
        }

        const TARGET = await deploy_targets.showTargetQuickPick(
            ME.context.extension,
            ME.getTargets(),
            {
                placeHolder: ME.t('targets.selectTarget'),
            }
        );
        if (!TARGET) {
            return false;
        }

        if (deployAction) {
            await Promise.resolve(
                deployAction(TARGET, FILES_TO_DEPLOY)
            );
        }

        return true;
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
            ME.logger
              .trace(e, 'workspaces.Workspace.updateSwitchButtons()');
        }
    }

    /**
     * Gets the current session data storage.
     */
    public get workspaceSessionState(): deploy_contracts.KeyValuePairs {
        return this._workspaceSessionState;
    }

    /**
     * A storage of variables for that object.
     */
    public readonly vars: deploy_contracts.KeyValuePairs = {};
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
        return sortWorkspaces( PROVIDER() );
    }
}

/**
 * Returns a list of all workspaces.
 * 
 * @return {Workspace[]} The list of all workspaces.
 */
export function getAllWorkspaces(): Workspace[] {
    const PROVIDER = allWorkspacesProvider;
    if (PROVIDER) {
        return sortWorkspaces( PROVIDER() );
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
 * Sets the global function for providing the list of all workspaces.
 * 
 * @param {WorkspaceProvider} newProvider The new function.
 */
export function setAllWorkspacesProvider(newProvider: WorkspaceProvider) {
    allWorkspacesProvider = newProvider;
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

function sortWorkspaces(workspaces: Workspace | Workspace[]) {
    return deploy_helpers.asArray(workspaces).sort((x, y) => {
        return deploy_helpers.compareValuesBy(x, y, ws => {
            return ws.folder.index;
        });
    });
}
