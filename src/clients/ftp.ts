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

import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_log from '../log';
import * as FTP from 'ftp';
const jsFTP = require('jsftp');
import * as Moment from 'moment';
const ParseListening = require("parse-listing");
import * as Path from 'path';


/**
 * Options for a FTP connection.
 */
export interface FTPConnectionOptions {
    /**
     * The engine.
     */
    readonly engine?: string;
    /**
     * The host.
     */
    readonly host?: string;
    /**
     * The password.
     */
    readonly password?: string;
    /**
     * The TCP port.
     */
    readonly port?: number;
    /**
     * The username.
     */
    readonly user?: string;
}


/**
 * The default value for a host address.
 */
export const DEFAULT_HOST = '127.0.0.1';


/**
 * A basic FTP client.
 */
export abstract class FtpClientBase {
    /**
     * Stores the internal connection object / value.
     */
    protected _connection: any;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {FTPConnectionOptions} opts The options.
     */
    public constructor(opts: FTPConnectionOptions) {
        this.options = deploy_helpers.cloneObject(opts) || <any>{};
    }

    /**
     * Connects to the server.
     * 
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public abstract connect(): Promise<boolean>;

    /**
     * Gets the internal connection object /value.
     */
    public get connection() {
        return this._connection;
    }

    /**
     * Changes the current directory.
     * 
     * @param {string} dir The path to the new directory.
     */
    public abstract cwd(dir: string): Promise<void>;

    /**
     * Ends the connections.
     * 
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public abstract end(): Promise<boolean>;

    /**
     * Downloads a file.
     * 
     * @param {string} file The path of the file.
     * 
     * @return {Promise<Buffer>} The promise with the downloaded data.
     */
    public abstract get(file: string): Promise<Buffer>;

    /**
     * Gets if the client is currently connected or not.
     */
    public get isConnected(): boolean {
        return !deploy_helpers.isNullOrUndefined(this.connection);
    }

    /**
     * Lists a directory.
     * 
     * @param {string} dir The path to the directory.
     */
    public abstract list(dir: string): Promise<deploy_files.FileSystemInfo[]>;

    /**
     * Creates a directory.
     * 
     * @param {string} dir The path of the directory to create.
     */
    public abstract mkdir(dir: string): Promise<void>;

    /**
     * Gets the underlying options.
     */
    public readonly options: FTPConnectionOptions;

    /**
     * Uploads a file.
     * 
     * @param {string} file The path to the destination file.
     * @param {Buffer} data The data to upload.
     */
    public abstract put(file: string, data: Buffer): Promise<void>;

    /**
     * Deletes a file or folder.
     * 
     * @param {string} path The path to the thing to delete.
     */
    public abstract unlink(path: string): Promise<void>;
}

class FtpClient extends FtpClientBase {
    public connect(): Promise<boolean> {
        const ME = this;

        let host = deploy_helpers.normalizeString(this.options.host).trim();
        if ('' === host) {
            host = '127.0.0.1';
        }

        let port = parseInt(deploy_helpers.toStringSafe(this.options.port).trim());
        if (isNaN(port)) {
            port = 21;
        }

        let user = deploy_helpers.toStringSafe(this.options.user, 'anonymous');

        let pwd = deploy_helpers.toStringSafe(this.options.password);
        if ('' === pwd) {
            pwd = undefined;
        }

        return new Promise<boolean>((resolve, reject) => {
            let conn: FTP;
            let completedInvoked = false;
            const COMPLETED = (err: any, connected?: boolean) => {
                if (completedInvoked) {
                    return;
                }
                completedInvoked = true;

                if (err) {
                    reject(err);
                }
                else {
                    ME._connection = conn;

                    resolve(connected);
                }
            };

            if (ME.isConnected) {
                COMPLETED(null, false);
                return;
            }

            try {
                conn = new FTP();

                conn.once('error', function(err) {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        COMPLETED(null, true);
                    }
                });

                conn.once('ready', function() {
                    COMPLETED(null, true);
                });

                conn.connect({
                    host: host, port: port,
                    user: user, password: pwd,
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public get connection(): FTP {
        return this._connection;
    }

    public cwd(dir: string): Promise<void> {
        const ME = this;

        dir = toFTPPath(dir);

        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.cwd(dir, (err) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        COMPLETED(null);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public end(): Promise<boolean> {
        const ME = this;

        return new Promise<boolean>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const OLD_CONNECTION = ME.connection;
                if (OLD_CONNECTION) {
                    OLD_CONNECTION.end();

                    ME._connection = null;

                    COMPLETED(null, true);
                }
                else {
                    COMPLETED(null, false);
                }
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public get(file: string): Promise<Buffer> {
        const ME = this;

        file = toFTPPath(file);

        return new Promise<Buffer>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.get(file, (err, stream) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        deploy_helpers.readStream(stream).then((data) => {
                            COMPLETED(null, data);
                        }).catch((err) => {
                            COMPLETED(err);
                        });
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public list(dir: string): Promise<deploy_files.FileSystemInfo[]> {
        const ME = this;

        dir = toFTPPath(dir);

        return new Promise<deploy_files.FileSystemInfo[]>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.list(dir, (err, list) => {
                    if (err) {
                        COMPLETED(err);
                        return;
                    }

                    const RESULT: deploy_files.FileSystemInfo[] = [];

                    if (list) {
                        for (let i = 0; i < list.length; i++) {
                            const ITEM = list[i];
                            if (!ITEM) {
                                continue;
                            }

                            let newFSIItem: deploy_files.FileSystemInfo;

                            let time: Moment.Moment;
                            if (ITEM.date) {
                                time = Moment(ITEM.date);
                            }

                            switch (deploy_helpers.normalizeString(ITEM.type)) {
                                case '-':
                                    // file
                                    {
                                        let size: number;
                                        if (!deploy_helpers.isEmptyString(ITEM.size)) {
                                            size = parseInt(ITEM.size.trim());
                                        }

                                        const FI: deploy_files.FileInfo = {
                                            download: async () => {
                                                const CLIENT = new JsFTPClient(ME.options);

                                                if (!(await CLIENT.connect())) {
                                                    //TODO: translate
                                                    throw new Error(`Could not start connection via jsftp!`);
                                                }

                                                try {
                                                    return await CLIENT.get(
                                                        toFTPPath(
                                                            normalizePath(dir) +
                                                            '/' +
                                                            normalizePath(ITEM.name)
                                                        )
                                                    );
                                                }
                                                finally {
                                                    try {
                                                        await CLIENT.end();
                                                    }
                                                    catch (e) {
                                                        deploy_log.CONSOLE
                                                                  .trace(e, 'clients.ftp.FTPClient.list().FI.download()');
                                                    }
                                                }
                                            },
                                            time: time,
                                            name: ITEM.name,
                                            path: dir,
                                            size: size,
                                            type: deploy_files.FileSystemType.File,
                                        };

                                        newFSIItem = FI;
                                    }
                                    break;

                                case 'd':
                                    // folder
                                    {
                                        const DI: deploy_files.DirectoryInfo = {
                                            time: time,
                                            name: ITEM.name,
                                            path: dir,
                                            type: deploy_files.FileSystemType.Directory,
                                        };
                                            
                                        newFSIItem = DI;
                                    }
                                    break;

                                default:
                                    // unknown
                                    {
                                        const FSI: deploy_files.FileSystemInfo = {
                                            time: time,
                                            name: ITEM.name,
                                            path: dir,
                                        };
                                            
                                        newFSIItem = FSI;
                                    }
                                    break;
                            }

                            RESULT.push(newFSIItem);
                        }
                    }

                    COMPLETED(null, RESULT);
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public mkdir(dir: string): Promise<void> {
        const ME = this;

        dir = toFTPPath(dir);

        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.mkdir(dir, true, (err) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        COMPLETED(null);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public put(file: string, data: Buffer): Promise<void> {
        const ME = this;

        file = toFTPPath(file);

        if (!data) {
            data = Buffer.alloc(0);
        }

        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.put(data, file, (err) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        COMPLETED(null);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public unlink(path: string): Promise<void> {
        const ME = this;

        path = toFTPPath(path);
        
        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.delete(path, (err) => {
                    COMPLETED(err);
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }
}

class JsFTPClient extends FtpClientBase {
    public connect(): Promise<boolean> {
        const ME = this;
        
        let host = deploy_helpers.normalizeString(ME.options.host);
        if ('' === host) {
            host = '127.0.0.1';
        }

        let port = parseInt(deploy_helpers.toStringSafe(ME.options.port).trim());
        if (isNaN(port)) {
            port = 21;
        }

        let user = deploy_helpers.toStringSafe(this.options.user, 'anonymous');

        let pwd = deploy_helpers.toStringSafe(ME.options.password);
        if ('' === pwd) {
            pwd = undefined;
        }
        
        return new Promise<boolean>((resolve, reject) => {
            let conn: any;
            let completedInvoked = false;
            const COMPLETED = (err: any, connected?: boolean) => {
                if (completedInvoked) {
                    return;
                }
                completedInvoked = true;

                if (err) {
                    reject(err);
                }
                else {
                    ME._connection = conn;

                    resolve(connected);
                }
            };

            try {
                if (ME.isConnected) {
                    COMPLETED(null, false);
                    return;
                }

                conn = new jsFTP({
                    host: host,
                    port: port,
                    user: user, 
                    pass: pwd,
                });

                COMPLETED(null, true);
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public cwd(dir: string): Promise<void> {
        const ME = this;

        dir = toFTPPath(dir);

        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.list(dir, (err) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        COMPLETED(null);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public end(): Promise<boolean> {
        const ME = this;

        return new Promise<boolean>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const OLD_CONNECTION = ME._connection;
                if (OLD_CONNECTION) {
                    OLD_CONNECTION.destroy();

                    ME._connection = null;

                    COMPLETED(null, true);
                }
                else {
                    COMPLETED(null, false);
                }
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public get(file: string): Promise<Buffer> {
        const ME = this;

        file = toFTPPath(file);

        return new Promise<Buffer>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.get(file, (err, socket) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        try {
                            let result: Buffer = Buffer.alloc(0);

                            socket.on("data", function(data: Buffer) {
                                try {
                                    if (data) {
                                        result = Buffer.concat([result, data]);
                                    }
                                }
                                catch (e) {
                                    COMPLETED(e);
                                }
                            });

                            socket.once("close", function(hadErr) {
                                if (hadErr) {
                                    COMPLETED(hadErr);
                                }
                                else {
                                    COMPLETED(null, result);
                                }
                            });

                            socket.resume();
                        }
                        catch (e) {
                            COMPLETED(e);
                        }
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public list(dir: string): Promise<deploy_files.FileSystemInfo[]> {
        const ME = this;

        dir = toFTPPath(dir);

        return new Promise<deploy_files.FileSystemInfo[]>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.list(dir, (err, result) => {
                    if (err) {
                        COMPLETED(err);
                        return;
                    }

                    try {
                        ParseListening.parseEntries(result, (err, list) => {
                            if (err) {
                                COMPLETED(err);
                                return;
                            }

                            const RESULT: deploy_files.FileSystemInfo[] = [];

                            if (list) {
                                for (let i = 0; i < list.length; i++) {
                                    const ITEM = list[i];
                                    if (!ITEM) {
                                        continue;
                                    }

                                    let newFSIItem: deploy_files.FileSystemInfo;

                                    let time: Moment.Moment;
                                    if (!deploy_helpers.isNullOrUndefined(ITEM.time)) {
                                        time = Moment( ITEM.time );
                                    }

                                    switch (ITEM.type) {
                                        case 0:
                                            // file
                                            {
                                                let size: number;
                                                if (!deploy_helpers.isEmptyString(ITEM.size)) {
                                                    size = parseInt( ITEM.size.trim() );
                                                }

                                                const FI: deploy_files.FileInfo = {
                                                    download: async () => {
                                                        const CLIENT = new JsFTPClient(ME.options);

                                                        if (!(await CLIENT.connect())) {
                                                            //TODO: translate
                                                            throw new Error(`Could not start connection via jsftp!`);
                                                        }

                                                        try {
                                                            return await CLIENT.get(
                                                                toFTPPath(
                                                                    normalizePath(dir) +
                                                                    '/' +
                                                                    normalizePath(ITEM.name)
                                                                )
                                                            );
                                                        }
                                                        finally {
                                                            try {
                                                                await CLIENT.end();
                                                            }
                                                            catch (e) {
                                                                deploy_log.CONSOLE
                                                                          .trace(e, 'clients.ftp.JsFTPClient.list().FI.download()');
                                                            }
                                                        }
                                                    },
                                                    time: time,
                                                    name: ITEM.name,
                                                    path: dir,
                                                    size: size,
                                                    type: deploy_files.FileSystemType.File,
                                                };

                                                newFSIItem = FI;
                                            }
                                            break;

                                        case 1:
                                            // folder
                                            {
                                                const DI: deploy_files.DirectoryInfo = {
                                                    time: time,
                                                    name: ITEM.name,
                                                    path: dir,
                                                    type: deploy_files.FileSystemType.Directory,
                                                };
                                                    
                                                newFSIItem = DI;
                                            }
                                            break;

                                        default:
                                            // unknown
                                            {
                                                const FSI: deploy_files.FileSystemInfo = {
                                                    time: time,
                                                    name: ITEM.name,
                                                    path: dir,
                                                };
                                                    
                                                newFSIItem = FSI;
                                            }
                                            break;
                                    }

                                    RESULT.push(newFSIItem);
                                }
                            }

                            COMPLETED(null, RESULT);
                        });
                    }
                    catch (e) {
                        COMPLETED(e);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public mkdir(dir: string): Promise<void> {
        const ME = this;

        dir = toFTPPath(dir);

        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.raw('mkd', dir, (err) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        COMPLETED(null);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public put(file: string, data: Buffer): Promise<void> {
        const ME = this;

        file = toFTPPath(file);

        if (!data) {
            data = Buffer.alloc(0);
        }

        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.put(data, file, (err) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        COMPLETED(null);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public unlink(path: string): Promise<void> {
        const ME = this;

        path = toFTPPath(path);

        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.raw('dele', path, (err) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        COMPLETED(null);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }
}


/**
 * Creates a new client.
 * 
 * @param {FTPConnectionOptions} opts The options.
 * 
 * @return FtpClientBase The new client.
 */
export function createClient(opts: FTPConnectionOptions): FtpClientBase {
    if (!opts) {
        opts = <any>opts;
    }

    switch (deploy_helpers.normalizeString(opts.engine)) {
        case 'ftp':
            return new FtpClient(opts);
    }

    return new JsFTPClient(opts);
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
 * Opens a connection.
 * 
 * @param {FTPConnectionOptions} opts The options.
 * 
 * @return {Promise<FtpClientBase>} The promise with new client.
 */
export async function openConnection(opts: FTPConnectionOptions): Promise<FtpClientBase> {
    const CLIENT = createClient(opts);

    if (!(await CLIENT.connect())) {
        //TODO: translate
        throw new Error('Could not start FTP connection!');
    }

    return CLIENT;
}

/**
 * Converts to a FTP path.
 * 
 * @param {string} path The path to convert.
 * 
 * @return {string} The converted path. 
 */
export function toFTPPath(path: string) {
    return '/' + normalizePath(path);
}
