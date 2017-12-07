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

import * as deploy_clients from '../clients';
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
const Dropbox = require('dropbox');
import * as Moment from 'moment';
import * as Path from 'path';


/**
 * Options for a FTP connection.
 */
export interface DropboxOptions {
    /**
     * The access token to use.
     */
    readonly accessToken?: string;
}


/**
 * A Dropbox file client.
 */
export class DropBoxClient extends deploy_clients.AsyncFileListBase {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {DropboxOptions} options The options for the client. 
     */
    constructor(public readonly options: DropboxOptions) {
        super();

        let accessToken = deploy_helpers.toStringSafe(options.accessToken).trim();
        if ('' === accessToken) {
            accessToken = undefined;
        }

        this.connection = new Dropbox({ 
            accessToken: accessToken
        });
    }

    /**
     * Gets the underlying Dropbox instance.
     */
    public readonly connection: any;

    /** @inheritdoc */
    public async deleteFile(path: string): Promise<boolean> {
        path = toDropBoxPath(path);
        
        try {
            await this.connection.filesDeleteV2({
                path: path,
            });
            
            return true;
        }
        catch (e) {
            return false;
        }
    }

    /** @inheritdoc */
    public async downloadFile(path: string): Promise<Buffer> {
        path = toDropBoxPath(path);

        const META_DATA = await this.connection.filesDownload({
            path: path,
        });

        return new Buffer(META_DATA.fileBinary, 'binary');
    }

    /** @inheritdoc */
    public async listDirectory(path: string) {
        const ME = this;

        path = toDropBoxPath(path);

        const RESULT: deploy_files.FileSystemInfo[] = [];

        const LIST = await this.connection.filesListFolder({
            include_media_info: true,
            include_mounted_folders: true,
            path: path,
            recursive: false,
        });
        if (LIST && LIST.entries) {
            for (const ENTRY of LIST.entries) {
                switch (deploy_helpers.normalizeString(ENTRY['.tag'])) {
                    case 'file':
                        {
                            const FI: deploy_files.FileInfo = {
                                download: async () => {
                                    return await ME.downloadFile(
                                        normalizePath(
                                            normalizePath(path) + '/' + ENTRY.name
                                        )
                                    );
                                },
                                name: ENTRY.name,
                                path: normalizePath(path),
                                size: ENTRY.size,
                                time: Moment(ENTRY.server_modified),
                                type: deploy_files.FileSystemType.File,
                            };

                            RESULT.push(FI);
                        }
                        break;

                    case 'folder':
                        {
                            const DI: deploy_files.DirectoryInfo = {
                                name: ENTRY.name,
                                path: normalizePath(path),
                                type: deploy_files.FileSystemType.Directory,
                            };

                            RESULT.push(DI);
                        }
                        break;

                    default:
                        {
                            const FSI: deploy_files.FileSystemInfo = {
                                name: ENTRY.name,
                                path: normalizePath(path),
                            };

                            RESULT.push(FSI);
                        }
                        break;
                }
            }
        }

        return RESULT;
    }

    /** @inheritdoc */
    public get type() {
        return 'dropbox';
    }

    /** @inheritdoc */
    public async uploadFile(path: string, data: Buffer): Promise<void> {
        path = toDropBoxPath(path);

        await this.connection.filesUpload({
            autorename: false,
            contents: data,
            mode: 'overwrite',
            mute: false,
            path: path,
        });
    }
}


/**
 * Creates a new client.
 * 
 * @param {DropboxOptions} opts The options for the new client.
 */
export function createClient(opts: DropboxOptions) {
    if (!opts) {
        return <any>opts;
    }

    return new DropBoxClient(opts);
}

/**
 * Normalizes a path.
 * 
 * @param {string} path The path to normalize.
 * 
 * @return {string} The normalized path. 
 */
export function normalizePath(path: string) {
    path = deploy_helpers.toStringSafe(path);
    path = deploy_helpers.replaceAllStrings(path, Path.sep, '/');

    if (deploy_helpers.isEmptyString(path)) {
        path = '';
    }

    while (path.startsWith('/')) {
        path = path.substr(1);
    }
    while (path.endsWith('/')) {
        path = path.substr(0, path.length - 1);
    }

    return path;
}

/**
 * Converts to a Dropbox path.
 * 
 * @param {string} path The path to convert.
 * 
 * @return {string} The converted path. 
 */
export function toDropBoxPath(path: string) {
    path = normalizePath(path);

    if ('' !== path) {
        path = '/' + path;
    }

    return path;
}
