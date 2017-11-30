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
import * as deploy_targets from './targets';
import * as Events from 'events';
import * as vscode from 'vscode';


/**
 * A file to upload.
 */
export interface FileToUpload {
    /**
     * The method that should be invoked BEFORE an upload of that file starts.
     */
    readonly onBeforeUpload: () => PromiseLike<void>;
    /**
     * The method that should be invoked AFTER an upload of that file has been finished.
     * 
     * @param {any} [err] The error (if occurred).
     */
    readonly onUploadCompleted: (err?: any) => PromiseLike<void>;
    /**
     * Reads the complete content of that file.
     * 
     * @return {PromiseLike<Buffer>} The loaded data.
     */
    readonly read: () => PromiseLike<Buffer>;
}

/**
 * The result for the 'initialize' method of a plugin.
 */
export type InitializePluginResult = boolean | void;

/**
 * Result type of new plugins.
 */
export type NewPlugins = Plugin | PromiseLike<Plugin> | Plugin[] | PromiseLike<Plugin[]>;

/**
 * A plugin.
 */
export interface Plugin extends NodeJS.EventEmitter, vscode.Disposable {
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the filename of the plugin.
     */
    __file?: string;
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the full path of the plugin's file.
     */
    __filePath?: string;
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the index of the plugin.
     */
    __index?: number;
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the type of the plugin.
     */
    __type?: string;

    /**
     * Gets if the plugin can upload files or not.
     */
    readonly canUpload?: boolean;
    /**
     * Initializes the plugin.
     * 
     * @return {InitializePluginResult|PromiseLike<InitializePluginResult>} The result.
     */
    readonly initialize?: () => InitializePluginResult | PromiseLike<InitializePluginResult>;
    /**
     * Uploads files.
     * 
     * @param {UploadContext} The context.
     */
    readonly upload?: (context: UploadContext) => void | PromiseLike<void>;
}

/**
 * A plugin context.
 */
export interface PluginContext {
    /**
     * The output channel for that plugin.
     */
    readonly outputChannel: vscode.OutputChannel;
}

/**
 * A plugin module.
 */
export interface PluginModule {
    /**
     * Creates new plugins.
     * 
     * @param {context: PluginContext} The context of that plugin.
     * 
     * @return {NewPlugins} The new plugins.
     */
    readonly createPlugins: (context: PluginContext) => NewPlugins;
}

/**
 * An upload context.
 */
export interface UploadContext {
    /**
     * The files to upload.
     */
    readonly files: FileToUpload[];
}

/**
 * A local file to upload.
 */
export abstract class FileToUploadBase implements FileToUpload {
    /** @inheritdoc */
    public onBeforeUpload = async () => {
    };

    /** @inheritdoc */
    public onUploadCompleted = async () => {
    };

    /** @inheritdoc */
    public abstract async read();
}

/**
 * A local file to upload.
 */
export class LocalFileToUpload extends FileToUploadBase {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {string} FILE The path to the local file. 
     */
    constructor(public readonly FILE: string) {
        super();
    }

    /** @inheritdoc */
    public async read() {
        return deploy_helpers.readFile(this.FILE);
    }
}

/**
 * A basic plugin.
 */
export abstract class PluginBase<TTarget extends deploy_targets.Target = deploy_targets.Target> extends Events.EventEmitter implements Plugin {
    /**
     * Stores all disposable items.
     */
    protected readonly _DISPOSABLES: vscode.Disposable[] = [];

    /**
     * Initializes a new instance of that class.
     * 
     * @param {PluginContext} CONTEXT The underlying context.
     */
    constructor(public readonly CONTEXT: PluginContext) {
        super();
    }

    /** @inheritdoc */
    public __file: string;
    /** @inheritdoc */
    public __filePath: string;
    /** @inheritdoc */
    public __index: number;
    /** @inheritdoc */
    public __type: string;

    /** @inheritdoc */
    public get canUpload() {
        return true;
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

    /** @inheritdoc */
    public async initialize() {
    }

    /** @inheritdoc */
    public async upload(context: UploadContext) {
        throw new Error(`Not implemented!`);
    }
}
