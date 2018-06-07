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
import * as deploy_clients from '../clients';
import * as deploy_code from '../code';
import * as deploy_contracts from '../contracts';
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_log from '../log';
import * as deploy_values from '../values';
const FTP = require('@icetee/ftp');
const FTP_Legacy = require('ftp');
import * as i18 from '../i18';
const jsFTP = require('jsftp');
import * as Moment from 'moment';
const ParseListening = require("parse-listing");
import * as Path from 'path';


/**
 * An action that is invoked BEFORE an upload process starts.
 * 
 * @param {FTPBeforeUploadArguments} args The arguments.
 * 
 * @return {FTPBeforeUploadResult|PromiseLike<FTPBeforeUploadResult>} The result.
 */
export type FTPBeforeUpload = (args: FTPBeforeUploadArguments) => FTPBeforeUploadResult | PromiseLike<FTPBeforeUploadResult>;

/**
 * Arguments for an action that is invoked BEFORE an upload process starts.
 */
export interface FTPBeforeUploadArguments {
    /**
     * The underlying (raw) connection.
     */
    readonly connection: any;
    /**
     * The data to upload.
     */
    data: Buffer;
    /**
     * The path of the remote file.
     */
    readonly file: string;
}

/**
 * A possible file for an action that is invoked BEFORE an upload process starts.
 */
export type FTPBeforeUploadResult = void | false;

/**
 * A possible value for a FTP command.
 */
export type FTPCommand = FTPCommandEntry | string;

/**
 * A FTP command entry.
 */
export interface FTPCommandEntry {
    /**
     * The command to execute.
     */
    readonly command: string;
    /**
     * The code to execute before output is written via 'writeOutputTo' setting. The result of the execution will be used as value to write.
     */
    readonly executeBeforeWriteOutputTo?: string;
    /**
     * The name of the placeholder where to write the output to.
     */
    readonly writeOutputTo?: string;
}

/**
 * FTP command settings.
 */
export interface FTPCommandSettings {
    /**
     * Commands to invoke BEFORE a file is going to be deleted.
     */
    readonly beforeDelete?: FTPCommand | FTPCommand[];
    /**
     * Commands to invoke BEFORE a file is going to be downloaded.
     */
    readonly beforeDownload?: FTPCommand | FTPCommand[];
    /**
     * Commands to invoke BEFORE a file is going to be uploaed.
     */
    readonly beforeUpload?: FTPCommand | FTPCommand[];
    /**
     * Commands to invoke AFTER a connection has been established.
     */
    readonly connected?: FTPCommand | FTPCommand[];
    /**
     * Commands to invoke AFTER a file has been deleted.
     */
    readonly deleted?: FTPCommand | FTPCommand[];
    /**
     * Commands to invoke AFTER a file has been downloaded.
     */
    readonly downloaded?: FTPCommand | FTPCommand[];
    /**
     * The (output) encoding of the commands.
     */
    readonly encoding?: string;
    /**
     * Commands to invoke AFTER a file has been uploaded.
     */
    readonly uploaded?: FTPCommand | FTPCommand[];    
}

/**
 * Options for a FTP connection.
 */
export interface FTPConnectionOptions {
    /**
     * Is invoked BEFORE an upload process starts.
     */
    readonly beforeUpload?: FTPBeforeUpload;
    /**
     * FTP commands.
     */
    readonly commands?: FTPCommandSettings;
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
     * Reject unauthorized server certificates or not.
     */
    readonly rejectUnauthorized?: boolean;
    /**
     * Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990) Default: false, applies only when engine is set to 'ftp'
     */
    readonly secure?: boolean | string;
    /**
     * Server supports deep directory creation or not.
     */
    readonly supportsDeepDirectoryCreation?: boolean;
    /**
     * Is invoked AFTER an upload process.
     */
    readonly uploadCompleted?: FTPUploadCompleted;
    /**
     * The username.
     */
    readonly user?: string;
    /**
     * A function that provides values for the connection.
     */
    readonly valueProvider?: deploy_values.ValuesProvider;
}

/**
 * An action that is invoked AFTER an upload process.
 * 
 * @param {FTPUploadCompletedArguments} args The arguments.
 * 
 * @return {FTPUploadCompletedResult|PromiseLike<FTPUploadCompletedResult>} The result.
 */
export type FTPUploadCompleted = (args: FTPUploadCompletedArguments) => FTPUploadCompletedResult | PromiseLike<FTPUploadCompletedResult>;

/**
 * Arguments for an action that is invoked AFTER an upload process.
 */
export interface FTPUploadCompletedArguments {
    /**
     * The underlying (raw) connection.
     */
    readonly connection: any;
    /**
     * The data.
     */
    readonly data: Buffer;
    /**
     * The error (if occurred).
     */
    readonly error?: any;
    /**
     * The path of the remote file.
     */
    readonly file: string;
    /**
     * Indicates if file has been uploaded or not.
     */
    readonly hasBeenUploaded: boolean;
}

/**
 * A possible file for an action that is invoked AFTER an upload process.
 */
export type FTPUploadCompletedResult = void | boolean;


/**
 * The default value for a host address.
 */
export const DEFAULT_HOST = '127.0.0.1';


/**
 * A basic FTP client.
 */
export abstract class FTPClientBase extends deploy_clients.AsyncFileListBase {
    /**
     * Stores the internal connection object / value.
     */
    protected _connection: any;
    private _existingRemoteDirs: { [ path: string ]: boolean } = {};

    /**
     * Initializes a new instance of that class.
     * 
     * @param {FTPConnectionOptions} opts The options.
     */
    public constructor(opts: FTPConnectionOptions) {
        super();

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
     * Creates a directory if it does not exist.
     * 
     * @param {string} dir The directory.
     * 
     * @return {Promise<boolean>} The promise that indicates if directory has been created or not.
     */
    protected async createDirectoryIfNeeded(dir: string) {
        dir = toFTPPath(dir);
        if ('/' === dir) {
            return false;
        }

        // check if remote directory exists ...
        if (true === this._existingRemoteDirs[dir]) {
            return false;  // seems to exist
        }

        try {
            await this.cwd(dir);
        }
        catch {
            // no, try to create
            await this.mkdir(dir);
        }

        // mark as checked
        this._existingRemoteDirs[dir] = true;

        return true;
    }

    /**
     * Creates a parent directory if it does not exist.
     * 
     * @param {string} dir The child of the directory to check.
     * 
     * @return {Promise<boolean>} The promise that indicates if parent directory has been created or not.
     */
    protected async createParentDirectoryIfNeeded(dir: string): Promise<boolean> {
        dir = toFTPPath(dir);
        const PARENT_DIR = toFTPPath(deploy_helpers.from( dir.split('/') )
                                                   .skipLast()
                                                   .joinToString('/'));
        if (PARENT_DIR === dir) {
            return false;
        }

        return this.createDirectoryIfNeeded(PARENT_DIR);
    }

    /**
     * Changes the current directory.
     * 
     * @param {string} dir The path to the new directory.
     */
    public abstract cwd(dir: string): Promise<void>;

    /** @inheritdoc */
    public async deleteFile(path: string): Promise<boolean> {
        const VALUES: deploy_values.Value[] = [            
        ].concat( this.getValuesForFile(path) );

        try {
            await this.executeCommandsBy((opts) => opts.commands.beforeDelete,
                                         VALUES);
            
            await this.unlink(path);

            await this.executeCommandsBy((opts) => opts.commands.deleted,
                                         VALUES);
            
            return true;
        }
        catch (e) {
            return false;
        }
    }

    /** @inheritdoc */
    public async downloadFile(path: string): Promise<Buffer> {
        const VALUES: deploy_values.Value[] = [            
        ].concat( this.getValuesForFile(path) );

        let data: Buffer;

        await this.executeCommandsBy((opts) => opts.commands.beforeDownload,
                                     VALUES);
        
        data = await this.get(path);

        await this.executeCommandsBy((opts) => opts.commands.downloaded,
                                     VALUES);

        return data;
    }

    /**
     * Ends the connections.
     * 
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public abstract end(): Promise<boolean>;

    /**
     * Executes a FTP command.
     * 
     * @param {string} cmd The command to execute.
     * 
     * @return {Promise<Buffer>} The promise with the result.
     */
    public abstract execute(cmd: string): Promise<Buffer>;

    /**
     * Executes commands by using a provider.
     * 
     * @param {Function} provider The provider.
     * @param {deploy_values.Value|deploy_values.Value[]} [additionalValues] One or more additional values.
     * 
     * @return {Promise<Buffer[]>} The promise with the execution results.
     */
    public async executeCommandsBy(
        provider: (opts: FTPConnectionOptions) => FTPCommand | FTPCommand[],
        additionalValues?: deploy_values.Value | deploy_values.Value[],
    ): Promise<Buffer[]> {
        if (!this.options.commands) {
            return [];
        }

        let commandValues: deploy_values.Value[];
        if (this.options.valueProvider) {
            commandValues = deploy_helpers.asArray( this.options.valueProvider() );
        }
        else {
            commandValues = [];
        }

        let enc = deploy_helpers.normalizeString( this.options.commands.encoding );
        if ('' === enc) {
            enc = undefined;
        }

        const RESULTS: Buffer[] = [];        

        const COMMANDS = deploy_helpers.asArray( provider(this.options) );

        for (const C of COMMANDS) {
            let entry: FTPCommandEntry;
            if (deploy_helpers.isObject<FTPCommandEntry>(C)) {
                entry = C;
            }
            else {
                entry = {
                    command: deploy_helpers.toStringSafe( C )
                };
            }

            const ADDITIONAL_COMMAND_VALUES: deploy_values.Value[] = [
            ].concat( deploy_helpers.asArray(additionalValues) );

            const ALL_COMMAND_VALUES = commandValues.concat( ADDITIONAL_COMMAND_VALUES )
                                                    .concat( this.values );

            const COMMAND_TO_EXECUTE = deploy_values.replaceWithValues(
                ALL_COMMAND_VALUES,
                entry.command,
            );

            let res: Buffer;

            if (!deploy_helpers.isEmptyString(COMMAND_TO_EXECUTE)) {
                res = await this.execute( COMMAND_TO_EXECUTE );
            }

            RESULTS.push( res );

            const WRITE_TO = deploy_helpers.normalizeString(entry.writeOutputTo);
            if ('' !== WRITE_TO) {
                let outputToWrite: any = _.isNil(res) ? res
                                                      : res.toString(enc);

                const EXECUTE_BEFORE_WRITE = deploy_helpers.toStringSafe( entry.executeBeforeWriteOutputTo );
                if (!deploy_helpers.isEmptyString(EXECUTE_BEFORE_WRITE)) {
                    const EXECUTE_BEFORE_WRITE_VALUES: deploy_values.Value[] = [
                        new deploy_values.StaticValue({
                            value: outputToWrite,
                        }, WRITE_TO),
                    ];

                    outputToWrite = deploy_code.exec({
                        code: EXECUTE_BEFORE_WRITE,
                        context: {
                            command: entry,
                            output: res,
                        },
                        values: ALL_COMMAND_VALUES.concat( EXECUTE_BEFORE_WRITE_VALUES ),
                    });
                }

                this.setValue(WRITE_TO,
                              deploy_helpers.toStringSafe( outputToWrite ));
            }
        }

        return RESULTS;
    }

    /**
     * Downloads a file.
     * 
     * @param {string} file The path of the file.
     * 
     * @return {Promise<Buffer>} The promise with the downloaded data.
     */
    public abstract get(file: string): Promise<Buffer>;

    /**
     * Returns a list of values for a file.
     * 
     * @param {string} file The path of the remote file.
     * 
     * @return {deploy_values.Value[]} The values.
     */
    protected getValuesForFile(file: string): deploy_values.Value[] {
        return [
            new deploy_values.StaticValue({
                value: Path.dirname(file),
            }, 'remote_dir'),
            new deploy_values.StaticValue({
                value: file,
            }, 'remote_file'),
            new deploy_values.StaticValue({
                value: Path.basename(file),
            }, 'remote_name'),
        ];
    }

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

    /** @inheritdoc */
    public async listDirectory(path: string): Promise<deploy_files.FileSystemInfo[]> {
        return await this.list(path);
    }

    /**
     * Creates a directory.
     * 
     * @param {string} dir The path of the directory to create.
     */
    public abstract mkdir(dir: string): Promise<void>;

    /**
     * Invokes the event for an 'before upload' operation.
     * 
     * @param {string} path The path of the remote file.
     * @param {Buffer} data The data to upload.
     * 
     * @param {Promise<Buffer|false>} The promise with the data to upload or (false)
     *                                if the file should NOT be uploaded.
     */
    protected async onBeforeUpload(path: string, data: Buffer): Promise<Buffer | false> {
        let doUpload = true;

        const BEFORE_UPLOAD_ARGS: FTPBeforeUploadArguments = {
            connection: this.connection,
            data: data,
            file: path,
        };

        const BEFORE_UPLOAD = this.options.beforeUpload;
        if (BEFORE_UPLOAD) {
            const BEFORE_UPLOAD_RESULT = deploy_helpers.toBooleanSafe(await Promise.resolve(
                BEFORE_UPLOAD( BEFORE_UPLOAD_ARGS )
            ), true);

            doUpload = false !== BEFORE_UPLOAD_RESULT;
        }

        return doUpload ? BEFORE_UPLOAD_ARGS.data
                        : false;
    }

    /** @inheritdoc */
    protected onDispose() {
        this.end().then(() => {
        }).catch((err) => {
            deploy_log.CONSOLE
                      .trace(err, 'clients.ftp.FTPClientBase.onDispose(1)');
        });
    }

    /**
     * Invokes the event for an 'upload completed' operation.
     * 
     * @param {any} err The error (if occurred).
     * @param {string} path The path of the remote file.
     * @param {Buffer} data The uploaded data.
     * @param {boolean} hasBeenUploaded Indicates if file has been uploaded or not.
     */
    protected async onUploadCompleted(err: any, path: string, data: Buffer, hasBeenUploaded: boolean) {
        let errorHandled = false;

        const UPLOAD_COMPLETED_ARGS: FTPUploadCompletedArguments = {
            connection: this.connection,
            data: data,
            error: err,
            file: path,
            hasBeenUploaded: hasBeenUploaded,
        };

        const UPLOAD_COMPLETED = this.options.uploadCompleted;
        if (UPLOAD_COMPLETED) {
            const UPLOAD_COMPLETED_RESULT = deploy_helpers.toBooleanSafe(await Promise.resolve(
                UPLOAD_COMPLETED( UPLOAD_COMPLETED_ARGS )
            ));

            errorHandled = false !== UPLOAD_COMPLETED_RESULT;
        }

        if (err && !errorHandled) {
            throw err;
        }
    }

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
     * Removes a directory and its sub folders.
     * 
     * @param {string} file The path to the destination directory.
     */
    public abstract async rmdir(path: string): Promise<void>;

    /** @inheritdoc */
    public async removeFolder(path: string): Promise<boolean> {
        path = toFTPPath(path);
        if ('/' === path) {
            return false;  // NOT the root folder!
        }

        try {
            await this.rmdir(path);

            return true;
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'clients.ftp.FTPClientBase.removeFolder(1)');

            return false;
        }
    }

    /** @inheritdoc */
    public get type() {
        return 'ftp';
    }

    /**
     * Deletes a file or folder.
     * 
     * @param {string} path The path to the thing to delete.
     */
    public abstract unlink(path: string): Promise<void>;

    /** @inheritdoc */
    public async uploadFile(path: string, data: Buffer): Promise<void> {
        const VALUES: deploy_values.Value[] = [            
        ].concat( this.getValuesForFile(path) );

        await this.executeCommandsBy(opts => opts.commands.beforeUpload,
                                     VALUES);

        const BEFORE_UPLOAD_RESULT = await this.onBeforeUpload(path, data);
        
        let hasBeenUploaded = false;
        let uploadError: any;
        try {
            if (false === BEFORE_UPLOAD_RESULT) {
                return;
            }
    
            data = await deploy_helpers.asBuffer( BEFORE_UPLOAD_RESULT );
            if (!data) {
                data = Buffer.alloc(0);
            }
    
            await this.put(path, data);

            hasBeenUploaded = true;

            await this.executeCommandsBy(opts => opts.commands.uploaded,
                                         VALUES);
        }
        catch (e) {
            uploadError = e;
        }
        finally {
            await this.onUploadCompleted(
                uploadError,
                path, data,
                hasBeenUploaded,
            );
        }
    }

    
}

class FtpClient extends FTPClientBase {
    public connect(): Promise<boolean> {
        const ME = this;

        let host = deploy_helpers.normalizeString(this.options.host).trim();
        if ('' === host) {
            host = '127.0.0.1';
        }

        const PORT = parseInt(
            deploy_helpers.toStringSafe(this.options.port).trim()
        );

        let user = deploy_helpers.toStringSafe(this.options.user, 'anonymous');

        let pwd = deploy_helpers.toStringSafe(this.options.password);
        if ('' === pwd) {
            pwd = undefined;
        }

        const ENGINE = deploy_helpers.normalizeString(this.options.engine);

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

            if (ME.isConnected) {
                COMPLETED(null, false);
                return;
            }

            try {
                conn = ('ftp-legacy' === ENGINE) ? new FTP_Legacy()
                                                 : new FTP();

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

                let secure: any = this.options.secure;
                let secureOptions: any;
                if (!_.isNil(secure)) {
                    secureOptions = {
                        rejectUnauthorized: deploy_helpers.toBooleanSafe(this.options.rejectUnauthorized),
                    };

                    if (_.isBoolean(secure)) {
                        if (!secure) {
                            secureOptions = undefined;
                        }
                    } else {
                        secure = deploy_helpers.normalizeString(secure);
                        if ('' === secure) {
                            secure = true;
                        }
                    }
                }

                let ftpPort = PORT;
                if (isNaN(ftpPort)) {
                    ftpPort = 21;

                    if (!_.isNil(secure)) {
                        if (false !== secure) {
                            ftpPort = 990;
                        }
                    }
                }        

                conn.connect({
                    host: host, port: ftpPort,
                    user: user, password: pwd,
                    secure: secure,
                    secureOptions: secureOptions,
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public get connection(): any {
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

    public execute(cmd: string): Promise<Buffer> {
        cmd = deploy_helpers.toStringSafe( cmd );

        const ME = this;
        
        return new Promise<any>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const SEND_FUNC: Function = ME.connection['_send'];

                const ARGS = [
                    cmd,
                    (err, respTxt, respCode) => {
                        if (err) {
                            COMPLETED( err );
                        }
                        else {
                            COMPLETED(null,
                                      new Buffer(`${respCode} ${deploy_helpers.toStringSafe(respTxt)}`, 'ascii'));
                        }
                    }
                ];

                SEND_FUNC.apply(ME.connection,
                                ARGS);
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
                                                    throw new Error(i18.t('ftp.couldNotConnectWithJSFTP'));
                                                }

                                                try {
                                                    return await CLIENT.get(
                                                        toFTPPath(
                                                            deploy_helpers.normalizePath(dir) +
                                                            '/' +
                                                            deploy_helpers.normalizePath(ITEM.name)
                                                        )
                                                    );
                                                }
                                                finally {
                                                    try {
                                                        await CLIENT.end();
                                                    }
                                                    catch (e) {
                                                        deploy_log.CONSOLE
                                                                  .trace(e, 'clients.ftp.FTPClient.listDirectory().FI.download()');
                                                    }
                                                }
                                            },
                                            //TODO: exportPath: false,
                                            name: ITEM.name,
                                            path: dir,
                                            size: size,
                                            time: time,
                                            type: deploy_files.FileSystemType.File,
                                        };

                                        newFSIItem = FI;
                                    }
                                    break;

                                case 'd':
                                    // folder
                                    {
                                        const DI: deploy_files.DirectoryInfo = {
                                            //TODO: exportPath: false,
                                            name: ITEM.name,
                                            path: dir,
                                            time: time,
                                            type: deploy_files.FileSystemType.Directory,
                                        };
                                            
                                        newFSIItem = DI;
                                    }
                                    break;

                                default:
                                    // unknown
                                    {
                                        const FSI: deploy_files.FileSystemInfo = {
                                            //TODO: exportPath: false,
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

        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                if (!deploy_helpers.toBooleanSafe(ME.options.supportsDeepDirectoryCreation)) {
                    await ME.createParentDirectoryIfNeeded(dir);
                }

                ME.connection.mkdir(dir, true, (err) => {
                    COMPLETED(err);
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

        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                await ME.createDirectoryIfNeeded(
                    Path.dirname(file)                    
                );

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

    public rmdir(path: string): Promise<void> {
        const ME = this;

        path = toFTPPath(path);

        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.rmdir(path, true, (err) => {
                    COMPLETED(err);
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

class JsFTPClient extends FTPClientBase {
    public connect(): Promise<boolean> {
        const ME = this;
        
        let host = deploy_helpers.normalizeString(ME.options.host);
        if ('' === host) {
            host = deploy_contracts.DEFAULT_HOST;
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
                ME.connection.raw("CWD", [ dir ], (err) => {
                    COMPLETED(err);
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

    public execute(cmd: string): Promise<any> {
        cmd = deploy_helpers.toStringSafe(cmd);

        const ME = this;
        
        return new Promise<any>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const PARTS = cmd.split(' ')
                                 .filter(x => '' !== x.trim());

                let c: string;
                if (PARTS.length > 0) {
                    c = PARTS[0].trim();
                }

                const ARGS = PARTS.filter((a, i) => i > 0);

                ME.connection.raw(c, ARGS, (err, result) => {
                    if (err) {
                        COMPLETED( err );
                    }
                    else {
                        COMPLETED(null,
                                  _.isNil(result.text) ? result.text : new Buffer(result.text, 'ascii'));
                    }
                });
            }
            catch (e) {
                COMPLETED( e );
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

        return new Promise<deploy_files.FileSystemInfo[]>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.list(dir, (err, result) => {
                    if (err) {
                        if (451 == err.code) {
                            COMPLETED(null, []);
                            return;
                        }

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
                                                            throw new Error(i18.t('ftp.couldNotConnectWithJSFTP'));
                                                        }

                                                        try {
                                                            return await CLIENT.get(
                                                                toFTPPath(
                                                                    deploy_helpers.normalizePath(dir) +
                                                                    '/' +
                                                                    deploy_helpers.normalizePath(ITEM.name)
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
                                                    //TODO: exportPath: false,
                                                    name: ITEM.name,
                                                    path: dir,
                                                    size: size,
                                                    time: time,
                                                    type: deploy_files.FileSystemType.File,
                                                };

                                                newFSIItem = FI;
                                            }
                                            break;

                                        case 1:
                                            // folder
                                            {
                                                const DI: deploy_files.DirectoryInfo = {
                                                    //TODO: exportPath: false,
                                                    name: ITEM.name,
                                                    path: dir,
                                                    time: time,
                                                    type: deploy_files.FileSystemType.Directory,
                                                };
                                                    
                                                newFSIItem = DI;
                                            }
                                            break;

                                        default:
                                            // unknown
                                            {
                                                const FSI: deploy_files.FileSystemInfo = {
                                                    //TODO: exportPath: false,
                                                    name: ITEM.name,
                                                    path: dir,
                                                    time: time,
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

        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                if (!deploy_helpers.toBooleanSafe(ME.options.supportsDeepDirectoryCreation)) {
                    await ME.createParentDirectoryIfNeeded(dir);
                }

                ME.connection.raw('mkd', [ dir ], (err) => {
                    COMPLETED(err);
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

        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                await ME.createDirectoryIfNeeded(
                    Path.dirname(file)                    
                );

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

    public rmdir(path: string): Promise<void> {
        const ME = this;

        path = toFTPPath(path);

        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const FILES_AND_FOLDERS = await ME.list(path);

                const TO_PATH = (wnp: deploy_contracts.WithNameAndPath) => {
                    return deploy_helpers.normalizePath(
                        deploy_helpers.normalizePath(wnp.path) + 
                        '/' + 
                        deploy_helpers.normalizePath(wnp.name),
                    );
                };

                // first delete sub folders
                for (const F of <deploy_files.DirectoryInfo[]>FILES_AND_FOLDERS.filter(ff => deploy_files.FileSystemType.Directory === ff.type)) {
                    await ME.removeFolder( TO_PATH(F) );
                }
                
                // then the files
                for (const F of <deploy_files.FileInfo[]>FILES_AND_FOLDERS.filter(ff => deploy_files.FileSystemType.File === ff.type)) {
                    await ME.deleteFile( TO_PATH(F) );
                }

                ME.connection.raw('rmd', path, (err) => {
                    COMPLETED(err);
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
 * @return {FTPClientBase} The new client.
 */
export function createClient(opts: FTPConnectionOptions): FTPClientBase {
    if (!opts) {
        opts = <any>opts;
    }

    switch (deploy_helpers.normalizeString(opts.engine)) {
        case 'ftp':
        case 'ftp-legacy':
            return new FtpClient(opts);
    }

    return new JsFTPClient(opts);
}

/**
 * Opens a connection.
 * 
 * @param {FTPConnectionOptions} opts The options.
 * 
 * @return {Promise<FTPClientBase>} The promise with new client.
 */
export async function openConnection(opts: FTPConnectionOptions): Promise<FTPClientBase> {
    const CLIENT = createClient(opts);

    if (!(await CLIENT.connect())) {
        throw new Error(i18.t('ftp.couldNotConnect'));
    }
    
    await CLIENT.executeCommandsBy(opts => opts.commands.connected);

    return CLIENT;
}

/**
 * Converts to a FTP path.
 * 
 * @param {string} p The path to convert.
 * 
 * @return {string} The converted path. 
 */
export function toFTPPath(p: string) {
    p = deploy_helpers.normalizePath(p);
    if ('.' === p) {
        p = '';
    }

    return '/' + p;
}
