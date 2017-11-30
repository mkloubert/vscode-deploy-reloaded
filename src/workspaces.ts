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
    public getPackages(): deploy_contracts.Package[] {
        const CFG = this.config;
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
        }).toArray();
    }

    /**
     * Returns the list of targets as defined in the settings.
     */
    public getTargets(): deploy_contracts.Target[] {
        const CFG = this.config;
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
