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
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_targets from './targets';
import * as Enumerable from 'node-enumerable';
import * as Events from 'events';
import * as Path from 'path';
import * as vscode from 'vscode';


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


const FILES_CHANGES: { [path: string]: deploy_contracts.FileChangeType } = {};

/**
 * A workspace.
 */
export class Workspace extends Events.EventEmitter implements vscode.Disposable {
    /**
     * Stores the current configuration.
     */
    protected _config: deploy_contracts.Configuration;
    /**
     * Stores all disposable items.
     */
    protected readonly _DISPOSABLES: vscode.Disposable[] = [];
    /**
     * Stores if workspace has been initialized or not.
     */
    protected _isInitialized = false;
    /**
     * Stores if configuration is currently reloaded or not.
     */
    protected _isReloadingConfig = false;

    /**
     * Initializes a new instance of that class.
     * @param {vscode.WorkspaceFolder} FOLDER The underlying folder.
     * @param {WorkspaceContext} CONTEXT the current extension context.
     */
    constructor(public readonly FOLDER: vscode.WorkspaceFolder,
                public readonly CONTEXT: WorkspaceContext) {
        super();
    }

    /**
     * Gets the current configuration.
     */
    public get config(): deploy_contracts.Configuration {
        return this._config;
    }

    /**
     * Deploys a file to a target.
     * 
     * @param {string} file The file to deploy.
     * @param {deploy_targets.Target} target The target to deploy to.
     */
    public async deployFileTo(file: string, target: deploy_targets.Target) {
        if (!target) {
            return;
        }

        if (target.__workspace.FOLDER.uri.fsPath !== this.FOLDER.uri.fsPath) {
            //TODO: translate
            throw new Error(`File '${file}' cannot be deployed from workspace '${this.FOLDER.uri.fsPath}'!`);
        }

        file = Path.resolve(file);

        await this.deployFilesTo(
            [ file ], target, target.__index + 1
        );
    }

    /**
     * Deploys a files to a target.
     * 
     * @param {string[]} files The files to deploy.
     * @param {deploy_targets.Target} target The target to deploy to.
     * @param {number} The number of the target.
     */
    protected async deployFilesTo(files: string[],
                                  target: deploy_targets.Target, targetNr: number) {
        const ME = this;
        
        if (!files || files.length < 1) {
            return;
        }

        if (!target) {
            return;
        }

        const TARGET_NAME = deploy_targets.getTargetName(target, targetNr);
        const TARGET_TYPE = deploy_helpers.normalizeString(target.type);

        const PLUGINS = ME.CONTEXT.plugins.filter(pi => {
            return '' === pi.__type || 
                   (TARGET_TYPE === pi.__type && pi.canUpload && pi.upload);
        });

        if (PLUGINS.length < 1) {
            //TODO: translate
            await deploy_helpers.showWarningMessage(
                `No matching PLUGINS found!`
            );

            return;
        }

        while (PLUGINS.length > 0) {
            const PI = PLUGINS.shift();

            try {
                // TODO: translate
                ME.CONTEXT.outputChannel.appendLine('');
                ME.CONTEXT.outputChannel.appendLine(`Start deploying files to '${TARGET_NAME}'...`);

                const CTX: deploy_plugins.UploadContext = {
                    files: files.map(f => {
                        const LF = new deploy_plugins.LocalFileToUpload(f);
                        LF.onBeforeUpload = async () => {
                            // TODO: translate
                            ME.CONTEXT.outputChannel.append(`Deploying file '${f}' to '${TARGET_NAME}'... `);
                        };
                        LF.onUploadCompleted = async (err?: any) => {
                            // TODO: translate
                            if (err) {
                                ME.CONTEXT.outputChannel.appendLine(`[ERROR: ${err}]`);
                            }
                            else {
                                ME.CONTEXT.outputChannel.appendLine(`[OK]`);
                            }
                        };

                        return LF;
                    }),
                };

                await Promise.resolve(
                    PI.upload(CTX)
                );

                // TODO: translate
                ME.CONTEXT.outputChannel.appendLine(`Deploying files to '${TARGET_NAME}' has been finished.`);
            }
            catch (e) {
                // TODO: translate
                ME.CONTEXT.outputChannel.appendLine(`[ERROR] deploying to '${TARGET_NAME}' failed: ${e}`);
            }
            finally {
                ME.CONTEXT.outputChannel.appendLine('');
            }
        }
    }

    /**
     * Deploys a package.
     * 
     * @param {deploy_packages.Package} pkg The package to deploy. 
     */
    public async deployPackage(pkg: deploy_packages.Package) {
        const ME = this;

        if (!pkg) {
            return;
        }

        if (pkg.__workspace.FOLDER.uri.fsPath !== ME.FOLDER.uri.fsPath) {
            //TODO: translate
            throw new Error(`Package '${deploy_packages.getPackageName(pkg)}' cannot be deployed from workspace '${ME.FOLDER.uri.fsPath}'!`);
        }

        const FILES = deploy_helpers.asArray(pkg.files).filter(f => {
            return !deploy_helpers.isEmptyString(f);
        });

        const EXCLUDE = deploy_helpers.asArray(pkg.exclude).filter(f => {
            return !deploy_helpers.isEmptyString(f);
        });

        const ROOT_DIR = ME.FOLDER.uri.fsPath;

        const FILES_TO_DEPLOY = await deploy_helpers.glob(FILES, {
            absolute: true,
            cwd: ROOT_DIR,
            dot: false,
            ignore: EXCLUDE,
            nodir: true,
            nonull: true,
            nosort: false,
            root: ROOT_DIR,
            sync: false,
        });

        if (FILES_TO_DEPLOY.length < 1) {
            //TODO: translate
            await deploy_helpers.showWarningMessage(
                `No FILES found!`
            );

            return;
        }

        const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = ME.getTargets().map((t, i) => {
            return {
                action: async () => {
                    await ME.deployFilesTo(FILES_TO_DEPLOY, t, i + 1);
                },
                description: deploy_helpers.toStringSafe( t.description ).trim(),
                detail: t.__workspace.FOLDER.uri.fsPath,
                label: deploy_targets.getTargetName(t, i + 1),
            };
        });

        if (QUICK_PICK_ITEMS.length < 1) {
            //TODO: translate
            await deploy_helpers.showWarningMessage(
                `No TARGETS found!`
            );

            return;
        }

        let selectedItem: deploy_contracts.ActionQuickPick;
        if (1 === QUICK_PICK_ITEMS.length) {
            selectedItem = QUICK_PICK_ITEMS[0];
        }
        else {
            selectedItem = await vscode.window.showQuickPick(QUICK_PICK_ITEMS, {
                placeHolder: 'Select the TARGET to deploy to...',  //TODO: translate
            });
        }

        if (selectedItem) {
            await Promise.resolve(
                selectedItem.action()
            );
        }
    }

    /** @inheritdoc */
    public dispose() {
        const ME = this;

        ME.removeAllListeners();

        while (ME._DISPOSABLES.length > 0) {
            const DISP = ME._DISPOSABLES.pop();

            deploy_helpers.tryDispose(DISP);
        }
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

        return Enumerable.from( deploy_helpers.asArray(CFG.packages) ).where(p => {
            return 'object' === typeof p;
        }).select(p => {
            return deploy_helpers.cloneObject(p);
        }).pipe(p => {
            ++index;

            (<any>p['__index']) = index;
            (<any>p['__workspace']) = ME;
        }).toArray();
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

        return Enumerable.from( deploy_helpers.asArray(CFG.targets) ).where(t => {
            return 'object' === typeof t;
        }).select(t => {
            return deploy_helpers.cloneObject(t);
        }).pipe(t => {
            ++index;

            (<any>t['__index']) = index;
            (<any>t['__workspace']) = ME;
        }).toArray();
    }

    /**
     * Gets if the workspace has been initialized or not.
     */
    public get isInitialized() {
        return this._isInitialized;
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

        await ME.reloadConfiguration();

        ME._isInitialized = true;
        return true;
    }

    public isPathOf(path: string) {
        if (!deploy_helpers.isEmptyString(path)) {
            if (!Path.isAbsolute(path)) {
                path = Path.join(this.FOLDER.uri.fsPath, path);
            }
            path = Path.resolve(path);

            return path.startsWith(
                Path.resolve(this.FOLDER.uri.fsPath)
            );
        }

        return false;
    }

    /**
     * Is invoked when the active text editor changed.
     * 
     * @param {vscode.TextEditor} editor The new editor.
     */
    public async onDidChangeActiveTextEditor(editor: vscode.TextEditor) {
    }

    /**
     * Is invoked on a file / directory change.
     * 
     * @param {vscode.Uri} e The URI of the item.
     * @param {deploy_contracts.FileChangeType} type The type of change.
     */
    public async onDidFileChange(e: vscode.Uri, type: deploy_contracts.FileChangeType, retry = true) {
        const ME = this;

        if ('undefined' !== typeof FILES_CHANGES[e.fsPath]) {
            if (retry) {
                await deploy_helpers.invokeAfter(async () => {
                    await ME.onDidFileChange(e, type, retry);
                });
            }

            return;
        }
        FILES_CHANGES[e.fsPath] = type;

        try {
            switch (type) {
                case deploy_contracts.FileChangeType.Changed:
                    break;

                case deploy_contracts.FileChangeType.Created:
                    break;

                case deploy_contracts.FileChangeType.Deleted:
                    break;
            }
        }
        finally {
            delete FILES_CHANGES[e.fsPath];
        }
    }

    /**
     * Reloads the current configuration for that workspace.
     * 
     * @param {boolean} [retry] Retry when busy or not. 
     */
    public async reloadConfiguration(retry = true) {
        const ME = this;

        if (ME._isReloadingConfig) {
            if (retry) {
                await deploy_helpers.invokeAfter(async () => {
                    await ME.reloadConfiguration();
                });
            }

            return;
        }
        ME._isReloadingConfig = true;

        try {
            const SETTINGS_FILE = Path.join(
                ME.FOLDER.uri.fsPath,
                './.vscode/settings.json',
            );

            const LOADED_CFG: deploy_contracts.Configuration = vscode.workspace.getConfiguration('deploy.reloaded',
                                                                                                 vscode.Uri.file(SETTINGS_FILE)) || <any>{};

            const OLD_CFG = ME._config;
            ME._config = LOADED_CFG;
            try {
                ME.emit(deploy_contracts.EVENT_CONFIG_RELOADED,
                        ME, LOADED_CFG, OLD_CFG);
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'workspaces.reloadConfiguration(1)');
            }
        }
        finally {
            ME._isReloadingConfig = true;
        }
    }
}
