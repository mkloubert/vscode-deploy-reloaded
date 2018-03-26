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
import * as deploy_contracts from './contracts';
import * as deploy_helpers from './helpers';
import * as deploy_files from './files';
import * as deploy_values from './values';
import * as vscode from 'vscode';


/**
 * An async file client.
 */
export interface IAsyncFileClient extends NodeJS.EventEmitter, vscode.Disposable {
    /**
     * Deletes a file.
     * 
     * @param {string} path The path of the file on the remote.
     * 
     * @return {PromiseLike<boolean>} A promise that indicates if operation was successful or not.
     */
    readonly deleteFile: (path: string) => PromiseLike<boolean>;

    /**
     * Downloads a file.
     * 
     * @param {string} path The path of the file to download.
     * 
     * @return {PromiseLike<Buffer>} The promise with the downloaded data.
     */
    readonly downloadFile: (path: string) => PromiseLike<Buffer>;

    /**
     * Lists a directory.
     * 
     * @param {string} path The path of the remote directory.
     * 
     * @return {PromiseLike<deploy_files.FileSystemInfo[]>} The promise with the file and folder list.
     */
    readonly listDirectory: (path: string) => PromiseLike<deploy_files.FileSystemInfo[]>;

    /**
     * The type.
     */
    readonly type: string;

    /**
     * Uploads a file.
     * 
     * @param {string} path The path of the file on the remote.
     * @param {Buffer} data The data for the remote file.
     */
    readonly uploadFile: (path: string, data: Buffer) => PromiseLike<void>;

    /**
     * Stores the list of connection values.
     */
    readonly values: deploy_values.Value[];
}


/**
 * A basic async file client.
 */
export abstract class AsyncFileListBase extends deploy_helpers.DisposableBase implements IAsyncFileClient {
    private readonly _CONNECTION_VALUES: deploy_contracts.KeyValuePairs = {};

    /** @inheritdoc */
    public abstract async deleteFile(path: string): Promise<boolean>;

    /** @inheritdoc */
    public abstract async downloadFile(path: string): Promise<Buffer>;

    /** @inheritdoc */
    public abstract async listDirectory(path: string): Promise<deploy_files.FileSystemInfo[]>;

    /**
     * Normalizes a name for a value.
     * 
     * @param {any} name The input value.
     * 
     * @return {string} The output value.
     */
    protected normalizeValueName(name: any): string {
        return deploy_helpers.normalizeString( name );
    }

    /**
     * Sets a connection value.
     * 
     * @param {string} name The name of the value.
     * @param {any} val The value to set.
     * 
     * @return this
     * 
     * @chainable
     */
    public setValue(name: string, val: any): this {
        name = this.normalizeValueName( name );

        let existingValue = deploy_helpers.from(
            this.values
        ).singleOrDefault(v => v.name === name);
        if (_.isSymbol(existingValue)) {
            existingValue = new deploy_values.FunctionValue(() => {
                return this._CONNECTION_VALUES[ name ];
            }, name);

            this.values
                .push( existingValue );
        }

        this._CONNECTION_VALUES[ name ] = val;

        return this;
    }

    /** @inheritdoc */
    public abstract get type(): string;

    /** @inheritdoc */
    public abstract async uploadFile(path: string, data: Buffer): Promise<void>;

    /** @inheritdoc */
    public readonly values: deploy_values.Value[] = [];
}
