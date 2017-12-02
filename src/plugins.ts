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
import * as deploy_files from './files';
import * as deploy_helpers from './helpers';
import * as deploy_targets from './targets';
import * as deploy_transformers from './transformers';
import * as deploy_workspaces from './workspaces';
import * as Events from 'events';
import * as vscode from 'vscode';


/**
 * A delete context.
 */
export interface DeleteContext<TTarget extends deploy_targets.Target = deploy_targets.Target> extends FilesContext<TTarget> {
    /**
     * The files to delete.
     */
    readonly files: FileToDelete[];
}

/**
 * A download context.
 */
export interface DownloadContext<TTarget extends deploy_targets.Target = deploy_targets.Target> extends FilesContext<TTarget> {
    /**
     * The files to download.
     */
    readonly files: FileToDownload[];
}

/**
 * A downloaded file.
 */
export interface DownloadedFile extends vscode.Disposable, deploy_contracts.WithNameAndPath {
    /**
     * Reads the whole content of the file.
     * 
     * @return {PromiseLike<Buffer>} The read data.
     */
    readonly read: () => Buffer | PromiseLike<Buffer>;
}

/**
 * A context for handling files.
 */
export interface FilesContext<TTarget extends deploy_targets.Target = deploy_targets.Target> extends TargetContext<TTarget> {
}

/**
 * A file to delete.
 */
export interface FileToDelete extends deploy_workspaces.WorkspaceFile {
    /**
     * The method that should be invoked BEFORE a deletion of that file starts.
     * 
     * @param {string} [destination] A custom value for the destination.
     */
    readonly onBeforeDelete: (destination?: string) => PromiseLike<void>;
    /**
     * The method that should be invoked AFTER a deletion of that file has been finished.
     * 
     * @param {any} [err] The error (if occurred).
     * @param {boolean} [deleteLocalFiles] Delete local version or not.
     */
    readonly onDeleteCompleted: (err?: any, deleteLocal?: boolean) => PromiseLike<void>;
    /**
     * The underlying workspace.
     */
    readonly workspace: deploy_workspaces.Workspace;
}

/**
 * A file to download.
 */
export interface FileToDownload extends deploy_workspaces.WorkspaceFile {
    /**
     * The method that should be invoked BEFORE a download of that file starts.
     * 
     * @param {string} [destination] A custom value for the destination.
     */
    readonly onBeforeDownload: (destination?: string) => PromiseLike<void>;
    /**
     * The method that should be invoked AFTER a download of that file has been finished.
     * 
     * @param {any} err The error (if occurred).
     * @param {DownloadedFile} [file] The downloaded file (if available).
     */
    readonly onDownloadCompleted: (err: any, file?: DownloadedFile) => PromiseLike<void>;
    /**
     * The underlying workspace.
     */
    readonly workspace: deploy_workspaces.Workspace;
}

/**
 * A file to upload.
 */
export interface FileToUpload extends deploy_workspaces.WorkspaceFile {
    /**
     * The method that should be invoked BEFORE an upload of that file starts.
     * 
     * @param {string} [destination] A custom value for the destination.
     */
    readonly onBeforeUpload: (destination?: string) => PromiseLike<void>;
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
 * A context for listening a directory.
 */
export interface ListDirectoryContext<TTarget extends deploy_targets.Target = deploy_targets.Target> extends TargetContext<TTarget>, deploy_workspaces.WorkspaceItem {
    /**
     * The directory to list.
     */
    readonly dir?: string;
}

/**
 * A 'list directory' result.
 */
export interface ListDirectoryResult<TTarget extends deploy_targets.Target = deploy_targets.Target> {
    /**
     * The directories.
     */
    readonly dirs: deploy_files.DirectoryInfo[];
    /**
     * The files.
     */
    readonly files: deploy_files.FileInfo[];
    /**
     * The other / unknown elements.
     */
    readonly others: deploy_files.FileSystemInfo[];
    /**
     * The underlying target.
     */
    readonly target: TTarget;
}

/**
 * Result type of new plugins.
 */
export type NewPlugins = Plugin | PromiseLike<Plugin> | Plugin[] | PromiseLike<Plugin[]>;

/**
 * A plugin.
 */
export interface Plugin<TTarget extends deploy_targets.Target = deploy_targets.Target> extends NodeJS.EventEmitter, vscode.Disposable {
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
     * Gets if the plugin can delete files or not.
     */
    readonly canDelete?: boolean;
    /**
     * Gets if the plugin can download files or not.
     */
    readonly canDownload?: boolean;
    /**
     * Gets if the plugin can list directories or not.
     */
    readonly canList?: boolean;
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
     * Deletes files.
     * 
     * @param {DeleteContext<TTarget>} The context.
     */
    readonly deleteFiles?: (context: DeleteContext<TTarget>) => void | PromiseLike<void>;
    /**
     * Downloads files.
     * 
     * @param {DownloadContext<TTarget>} The context.
     */
    readonly downloadFiles?: (context: DownloadContext<TTarget>) => void | PromiseLike<void>;
    /**
     * List a directory.
     * 
     * @param {ListDirectoryContext<TTarget>} The context.
     * 
     * @return {ListDirectoryResult<TTarget>|PromiseLike<ListDirectoryResult<TTarget>>} The result.
     */
    readonly listDirectory?: (context: ListDirectoryContext<TTarget>) => ListDirectoryResult<TTarget> | PromiseLike<ListDirectoryResult<TTarget>>;
    /**
     * Uploads files.
     * 
     * @param {UploadContext<TTarget>} The context.
     */
    readonly uploadFiles?: (context: UploadContext<TTarget>) => void | PromiseLike<void>;
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
 * A context based on a target.
 */
export interface TargetContext<TTarget extends deploy_targets.Target = deploy_targets.Target> extends deploy_contracts.Cancelable {
    /**
     * Gets the underlying target.
     */
    readonly target: TTarget;
}

/**
 * An upload context.
 */
export interface UploadContext<TTarget extends deploy_targets.Target = deploy_targets.Target> extends FilesContext<TTarget> {
    /**
     * The files to upload.
     */
    readonly files: FileToUpload[];
}


/**
 * A local file to upload.
 */
export abstract class FileToUploadBase implements FileToUpload {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {deploy_workspaces.Workspace} workspace the underlying workspace.
     * @param {string} file The path to the local file. 
     * @param {deploy_contracts.WithNameAndPath} _NAME_AND_PATH Name and relative path information.
     */
    constructor(public readonly workspace: deploy_workspaces.Workspace,
                public readonly file: string,
                private readonly _NAME_AND_PATH: deploy_contracts.WithNameAndPath) {
    }

    /** @inheritdoc */
    public get name() {
        return this._NAME_AND_PATH.name;
    }

    /** @inheritdoc */
    public onBeforeUpload = async () => {
    };

    /** @inheritdoc */
    public onUploadCompleted = async () => {
    };

    /** @inheritdoc */
    public get path() {
        return this._NAME_AND_PATH.path;
    }

    /** @inheritdoc */
    public async read() {
        let data = await this.onRead();

        if (this.transformer) {
            const CONTEXT: deploy_transformers.DataTransformerContext = {
                mode: deploy_transformers.DataTransformerMode.Transform,
                options: this.transformerOptions,
            };
            
            data = await Promise.resolve(
                this.transformer(
                    data, CONTEXT
                )
            );
        }

        return data;
    }

    /**
     * The logic for the 'read()' method.
     * 
     * @return {Promise<Buffer>} The promise with the read data.
     */
    protected abstract async onRead();

    /**
     * The data transformer.
     */
    public transformer: deploy_transformers.DataTransformer;

    /**
     * The options for the data transformer.
     */
    public transformerOptions: any;
}

/**
 * A local file to upload.
 */
export class LocalFileToUpload extends FileToUploadBase {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {deploy_workspaces.Workspace} workspace the underlying workspace.
     * @param {string} file The path to the local file.
     * @param {deploy_contracts.WithNameAndPath} nameAndPath Name and relative path information.
     */
    constructor(workspace: deploy_workspaces.Workspace,
                file: string,
                nameAndPath: deploy_contracts.WithNameAndPath) {
        super(workspace, file, nameAndPath);
    }

    /** @inheritdoc */
    protected async onRead() {
        return await deploy_helpers.readFile(this.file);
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
     * @param {PluginContext} context The underlying context.
     */
    constructor(public readonly context: PluginContext) {
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
    public get canDelete() {
        return false;
    }
    /** @inheritdoc */
    public get canDownload() {
        return false;
    }
    /** @inheritdoc */
    public get canList() {
        return false;
    }
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
    public async deleteFiles(context: DeleteContext<TTarget>): Promise<void> {
        throw new Error(`'deleteFiles()' is NOT implemented!`);
    }

    /** @inheritdoc */
    public async downloadFiles(context: DownloadContext<TTarget>): Promise<void> {
        throw new Error(`'downloadFiles()' is NOT implemented!`);
    }

    /** @inheritdoc */
    public async initialize() {
    }

    /** @inheritdoc */
    public async listDirectory(context: ListDirectoryContext<TTarget>): Promise<ListDirectoryResult<TTarget>> {
        throw new Error(`'listDirectory()' is NOT implemented!`);
    }

    /** @inheritdoc */
    public async uploadFiles(context: UploadContext<TTarget>): Promise<void> {
        throw new Error(`'uploadFiles()' is NOT implemented!`);
    }
}

/**
 * A simple implementation of a file to delete.
 */
export class SimpleFileToDelete implements FileToDelete {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {deploy_workspaces.Workspace} workspace the underlying workspace.
     * @param {string} file The path to the (local) file.
     * @param {deploy_contracts.WithNameAndPath} _NAME_AND_PATH Name and relative path information.
     */
    constructor(public readonly workspace: deploy_workspaces.Workspace,
                public readonly file: string,
                private readonly _NAME_AND_PATH: deploy_contracts.WithNameAndPath) {
    }

    /** @inheritdoc */
    public get name() {
        return this._NAME_AND_PATH.name;
    }

    /** @inheritdoc */
    public onBeforeDelete = async () => {
    };

    /** @inheritdoc */
    public onDeleteCompleted = async () => {
    };

    /** @inheritdoc */
    public get path() {
        return this._NAME_AND_PATH.path;
    }
}

/**
 * A simple implementation of a file to download.
 */
export class SimpleFileToDownload implements FileToDownload {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {deploy_workspaces.Workspace} workspace the underlying workspace.
     * @param {string} file The path to the (local) file.
     * @param {deploy_contracts.WithNameAndPath} _NAME_AND_PATH Name and relative path information.
     */
    constructor(public readonly workspace: deploy_workspaces.Workspace,
                public readonly file: string,
                private readonly _NAME_AND_PATH: deploy_contracts.WithNameAndPath) {
    }

    /** @inheritdoc */
    public get name() {
        return this._NAME_AND_PATH.name;
    }

    /** @inheritdoc */
    public onBeforeDownload = async () => {
    };

    /** @inheritdoc */
    public onDownloadCompleted = async () => {
    };

    /** @inheritdoc */
    public get path() {
        return this._NAME_AND_PATH.path;
    }
}


/**
 * Creates a new instance of a 'downloaded file' from a buffer.
 * 
 * @param {deploy_workspaces.WorkspaceFile} file The underlying workspace file.
 * @param {Buffer} buff The buffer with the data.
 * 
 * @return {DownloadedFile} The new object.
 */
export function createDownloadedFileFromBuffer(file: deploy_workspaces.WorkspaceFile, buff: Buffer): DownloadedFile {
    const DOWNLOADED: DownloadedFile = {
        dispose: () => {
            buff = null;
        },
        name: undefined,
        path: undefined,
        read: async () => {
            return buff;
        },
    };

    // DOWNLOADED.name
    Object.defineProperty(DOWNLOADED, 'name', {
        enumerable: true,

        get: () => {
            return file.name;
        }
    });

    // DOWNLOADED.path
    Object.defineProperty(DOWNLOADED, 'path', {
        enumerable: true,
        
        get: () => {
            return file.path;
        }
    });
    
    return DOWNLOADED;
}
