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
import * as FS from 'fs';
import * as Minimatch from 'minimatch';
import * as Moment from 'moment';
import * as Path from 'path';
import * as SFTP from 'ssh2-sftp-client';


/**
 * An action that is invoked BEFORE an upload process starts.
 * 
 * @param {SFTPBeforeUploadArguments} args The arguments.
 * 
 * @return {SFTPBeforeUploadResult|PromiseLike<SFTPBeforeUploadResult>} The result.
 */
export type SFTPBeforeUpload = (args: SFTPBeforeUploadArguments) => SFTPBeforeUploadResult | PromiseLike<SFTPBeforeUploadResult>;

/**
 * Arguments for an action that is invoked BEFORE an upload process starts.
 */
export interface SFTPBeforeUploadArguments {
    /**
     * The underlying (raw) connection.
     */
    readonly connection: SFTP;
    /**
     * The data to upload.
     */
    data: Buffer;
    /**
     * The path of the remote file.
     */
    readonly file: string;
    /**
     * The mode for the file (if defined).
     */
    readonly mode: SFTPModeForFile;
}

/**
 * A possible file for an action that is invoked BEFORE an upload process starts.
 */
export type SFTPBeforeUploadResult = void | false;

/**
 * A possible value for a SFTP command.
 */
export type SFTPCommand = SFTPCommandEntry | string;

/**
 * SFTP command settings.
 */
export interface SFTPCommandSettings {
    /**
     * Commands to invoke BEFORE a file is going to be deleted.
     */
    readonly beforeDelete?: SFTPCommand | SFTPCommand[];
    /**
     * Commands to invoke BEFORE a file is going to be downloaded.
     */
    readonly beforeDownload?: SFTPCommand | SFTPCommand[];
    /**
     * Commands to invoke BEFORE a file is going to be uploaed.
     */
    readonly beforeUpload?: SFTPCommand | SFTPCommand[];
    /**
     * Commands to invoke AFTER a connection has been establied.
     */
    readonly connected?: SFTPCommand | SFTPCommand[];
    /**
     * Commands to invoke AFTER a file has been deleted.
     */
    readonly deleted?: SFTPCommand | SFTPCommand[];
    /**
     * Commands to invoke AFTER a file has been downloaded.
     */
    readonly downloaded?: SFTPCommand | SFTPCommand[];
    /**
     * The (output) encoding of the commands.
     */
    readonly encoding?: string;
    /**
     * Commands to invoke AFTER a file has been uploaded.
     */
    readonly uploaded?: SFTPCommand | SFTPCommand[];    
}

/**
 * A SFTP command entry.
 */
export interface SFTPCommandEntry {
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
 * Options for a SFTP connection.
 */
export interface SFTPConnectionOptions {
    /**
     * Name or path to ssh-agent for ssh-agent-based user authentication.
     */
    readonly agent?: string;
    /**
     * Set to (true) to use OpenSSH agent forwarding (auth-agent@openssh.com) for the life of the connection.
     * 'agent' property must also be set to use this feature.
     */
    readonly agentForward?: boolean;
    /**
     * Is invoked BEFORE an upload process starts.
     */
    readonly beforeUpload?: SFTPBeforeUpload;
    /**
     * SFTP commands.
     */
    readonly commands?: SFTPCommandSettings;
    /**
     * Show debug output or not.
     */
    readonly debug?: boolean;
    /**
     * The algorithm to use to verify the fingerprint of a host.
     */
    readonly hashAlgorithm?: string;
    /**
     * One or more hashes to verify.
     */
    readonly hashes?: string | string[];
    /**
     * The hostname
     */
    readonly host?: string;
    /**
     * Defines the modes for files, after they have been uploaded.
     */
    readonly modes?: SFTPFileModeSettings;
    /**
     * The password.
     */
    readonly password?: string;
    /**
     * The custom TCP port.
     */
    readonly port?: number;
    /**
     * Path to the private key file.
     */
    readonly privateKey?: string;
    /**
     * The passphrase for the key file, if needed.
     */
    readonly privateKeyPassphrase?: string;
    /**
     * How long (in milliseconds) to wait for the SSH handshake to complete.
     */
    readonly readyTimeout?: number;
    /**
     * Server supports deep directory creation or not.
     */
    readonly supportsDeepDirectoryCreation?: boolean;
    /**
     * Try keyboard-interactive user authentication if primary user authentication method fails.
     */
    readonly tryKeyboard?: boolean;
    /**
     * The username.
     */
    readonly user?: string;
    /**
     * Is invoked AFTER an upload process.
     */
    readonly uploadCompleted?: SFTPUploadCompleted;
    /**
     * A function that provides values for the connection.
     */
    readonly valueProvider?: deploy_values.ValuesProvider;    
}

/**
 * A value for a file mode.
 */
export type SFTPFileMode = number | string;

/**
 * Patterns with file modes.
 */
export type SFTPFileModePatterns = { [ pattern: string ]: SFTPFileMode };

/**
 * A possible file mode setting value.
 */
export type SFTPFileModeSettings = SFTPFileMode | SFTPFileModePatterns;

/**
 * A mode for a file to set.
 */
export type SFTPModeForFile = number | false;

/**
 * An action that is invoked AFTER an upload process.
 * 
 * @param {SFTPUploadCompletedArguments} args The arguments.
 * 
 * @return {SFTPUploadCompletedResult|PromiseLike<SFTPUploadCompletedResult>} The result.
 */
export type SFTPUploadCompleted = (args: SFTPUploadCompletedArguments) => SFTPUploadCompletedResult | PromiseLike<SFTPUploadCompletedResult>;

/**
 * Arguments for an action that is invoked AFTER an upload process.
 */
export interface SFTPUploadCompletedArguments {
    /**
     * The underlying (raw) connection.
     */
    readonly connection: SFTP;
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
    /**
     * The mode for the file (if defined).
     */
    readonly mode: SFTPModeForFile;
}

/**
 * A possible file for an action that is invoked AFTER an upload process.
 */
export type SFTPUploadCompletedResult = void | boolean;

/**
 * The default value for a host address.
 */
export const DEFAULT_HOST = '127.0.0.1';


/**
 * A basic SFTP client.
 */
export class SFTPClient extends deploy_clients.AsyncFileListBase {
    private _checkedRemoteDirs: { [ path: string ]: boolean } = {};

    /**
     * Initializes a new instance of that class.
     * 
     * @param {SFTP} client The underlying client.
     */
    constructor(public readonly options: SFTPConnectionOptions) {
        super();

        this.client = new SFTP();

        if (deploy_helpers.toBooleanSafe(options.tryKeyboard)) {
            let pwd = deploy_helpers.toStringSafe(options.password);

            this.client['client'].on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
                try {
                    finish([ pwd ]);
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'clients.sftp.SFTPClient(keyboard-interactive)');
                }
            });
        }
    }

    /**
     * Gets the underlying client.
     */
    public readonly client: SFTP;

    private async createDirectoryIfNeeded(dir: string) {
        dir = toSFTPPath(dir);
        
        if ('/' !== dir) {
            if (true !== this._checkedRemoteDirs[dir]) {
                try {
                    // check if exist
                    await this.client.list(dir);
                }
                catch {
                    // no, try to create
                    await this.client.mkdir(dir, true);
                }

                // mark as checked
                this._checkedRemoteDirs[dir] = true;

                return true;
            }
        }

        return false;
    }

    private async createParentDirectoryIfNeeded(dir: string): Promise<boolean> {
        dir = toSFTPPath(dir);
        const PARENT_DIR = toSFTPPath(deploy_helpers.from( dir.split('/') )
                                                    .skipLast()
                                                    .joinToString('/'));
        if (PARENT_DIR === dir) {
            return false;
        }

        return this.createDirectoryIfNeeded(PARENT_DIR);
    }

    /** @inheritdoc */
    public async deleteFile(path: string): Promise<boolean> {
        path = toSFTPPath(path);

        const VALUES: deploy_values.Value[] = [            
        ].concat( this.getValuesForFile(path) );

        try {
            await this.executeCommandsBy(
                (o) => o.commands.beforeDelete,
                VALUES,
            );

            await this.client.delete(path);

            await this.executeCommandsBy(
                (o) => o.commands.deleted,
                VALUES,
            );

            return true;
        }
        catch (e) {
            return false;
        }
    }

    /** @inheritdoc */
    public async downloadFile(path: string): Promise<Buffer> {
        const ME = this;

        path = toSFTPPath(path);

        const VALUES: deploy_values.Value[] = [            
        ].concat( this.getValuesForFile(path) );

        return new Promise<Buffer>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                await this.executeCommandsBy(
                    (o) => o.commands.beforeDownload,
                    VALUES,
                );

                const STREAM = await ME.client.get(path, null, null);

                STREAM.once('error', (err) => {
                    COMPLETED(err);
                });
        
                const DOWNLOADED_DATA = await deploy_helpers.invokeForTempFile(async (tmpFile) => {
                    return new Promise<Buffer>((res, rej) => {
                        const COMP = deploy_helpers.createCompletedAction(res, rej);
        
                        try {
                            const PIPE = STREAM.pipe(
                                FS.createWriteStream(tmpFile)
                            );
        
                            PIPE.once('error', (err) => {
                                COMP(err);
                            });
        
                            STREAM.once('end', () => {
                                deploy_helpers.readFile(tmpFile).then((data) => {
                                    COMP(null, data);
                                }).catch((err) => {
                                    COMP(err);
                                });
                            });
                        }
                        catch (e) {
                            COMP(e);
                        }
                    });
                });

                await this.executeCommandsBy(
                    (o) => o.commands.downloaded,
                    VALUES,
                );
        
                COMPLETED(null, DOWNLOADED_DATA);
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /**
     * Executes commands by using a provider.
     * 
     * @param {Function} provider The provider.
     * @param {deploy_values.Value|deploy_values.Value[]} [additionalValues] One or more additional values.
     * 
     * @return {Promise<Buffer[]>} The promise with the execution results.
     */
    public executeCommandsBy(
        provider: (opts: SFTPConnectionOptions) => SFTPCommand | SFTPCommand[],
        additionalValues?: deploy_values.Value | deploy_values.Value[],
    ): Promise<Buffer[]> {
        return new Promise<Buffer[]>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            if (!this.options.commands) {
                COMPLETED(null, []);
                return;
            }

            try {
                const COMMANDS = deploy_helpers.asArray( provider(this.options) );

                let connectionValues: deploy_values.Value[];
                if (this.options.valueProvider) {
                    connectionValues = deploy_helpers.asArray( this.options.valueProvider() );
                }
                else {
                    connectionValues = [];
                }

                let enc = deploy_helpers.normalizeString( this.options.commands.encoding );
                if ('' === enc) {
                    enc = undefined;
                }

                const EXECUTE_COMMAND = (entry: SFTPCommandEntry) => {
                    return new Promise<Buffer>((res, rej) => {
                        const ADDITIONAL_COMMAND_VALUES: deploy_values.Value[] = [
                        ].concat( deploy_helpers.asArray(additionalValues) );

                        const ALL_COMMAND_VALUES = connectionValues.concat( ADDITIONAL_COMMAND_VALUES )
                                                                   .concat( this.values );

                        let output: Buffer;
                        const COMP = (err: any) => {
                            if (err) {
                                rej( err );
                            }
                            else {
                                try {
                                    const WRITE_TO = deploy_helpers.normalizeString(entry.writeOutputTo);
                                    if ('' !== WRITE_TO) {
                                        let outputToWrite: any = _.isNil(output) ? output
                                                                                 : output.toString(enc);

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

                                    res( output );
                                }
                                catch (e) {
                                    rej( e );
                                }
                            }
                        };

                        try {
                            const COMMAND_TO_EXECUTE = deploy_values.replaceWithValues(
                                ALL_COMMAND_VALUES,
                                entry.command,
                            );

                            if (deploy_helpers.isEmptyString(COMMAND_TO_EXECUTE)) {
                                COMP(null);                                
                                return;
                            }

                            output = Buffer.alloc(0);

                            this.client['client'].exec(entry.command, (err, stream) => {
                                if (err) {
                                    COMP(err);
                                    return;
                                }

                                let dataListener: (chunk: any) => void;
                                let endListener: (chunk: any) => void;
                                let errorListener: (err: any) => void;

                                const CLOSE_STREAM = (err: any) => {
                                    deploy_helpers.tryRemoveListener(stream, 'end', endListener);
                                    deploy_helpers.tryRemoveListener(stream, 'error', errorListener);
                                    deploy_helpers.tryRemoveListener(stream, 'data', dataListener);

                                    if (err) {
                                        COMP(err);
                                    }
                                    else {
                                        COMP(null);
                                    }
                                };

                                errorListener = (streamErr) => {
                                    CLOSE_STREAM( streamErr );
                                };

                                endListener = () => {
                                    CLOSE_STREAM( null );
                                };
                                
                                dataListener = (chunk) => {
                                    if (!chunk) {
                                        return;
                                    }

                                    try {
                                        if (!Buffer.isBuffer(chunk)) {
                                            chunk = new Buffer(deploy_helpers.toStringSafe(chunk), enc);
                                        }

                                        output = Buffer.concat([ output, chunk ]);
                                    }
                                    catch (e) {
                                        CLOSE_STREAM( e );
                                    }
                                };

                                try {
                                    stream.once('error', endListener);                        
                                    stream.once('end', endListener);                        
                                    stream.on('data', dataListener);
                                }
                                catch (e) {
                                    CLOSE_STREAM(err);
                                }
                            });
                        }
                        catch (e) {
                            COMP(e);
                        }
                    });
                };

                const OUTPUTS: Buffer[] = [];

                for (const C of COMMANDS) {
                    let entry: SFTPCommandEntry;
                    if (deploy_helpers.isObject<SFTPCommandEntry>(C)) {
                        entry = C;
                    }
                    else {
                        entry = {
                            command: deploy_helpers.toStringSafe(C),
                        };
                    }

                    OUTPUTS.push(
                        await EXECUTE_COMMAND( entry )
                    );
                }

                COMPLETED(null, OUTPUTS);
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

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

    /** @inheritdoc */
    public async listDirectory(path: string): Promise<deploy_files.FileSystemInfo[]> {
        const ME = this;

        path = toSFTPPath(path);

        const RESULT: deploy_files.FileSystemInfo[] = [];

        const LIST = await ME.client.list(path);

        for (const FI of LIST) {
            if ('d' === FI.type) {
                RESULT.push(
                    {
                        //TODO: exportPath: false,
                        name: FI.name,
                        path: deploy_helpers.normalizePath(path),
                        size: FI.size,
                        time: Moment(FI.modifyTime),
                        type: deploy_files.FileSystemType.Directory,
                    }
                );
            }
            else if ('-' === FI.type) {
                const SFTP_FILE: deploy_files.FileInfo = {
                    download: async () => {
                        const CLIENT = await openConnection(ME.options);
                        try {
                            return await CLIENT.downloadFile(
                                deploy_helpers.normalizePath(path) +
                                '/' +
                                deploy_helpers.normalizePath(FI.name)
                            );
                        }
                        finally {
                            deploy_helpers.tryDispose( CLIENT );
                        }
                    },
                    //TODO: exportPath: false,
                    name: FI.name,
                    path: deploy_helpers.normalizePath(path),
                    size: FI.size,
                    time: Moment(FI.modifyTime),
                    type: deploy_files.FileSystemType.File,
                };

                RESULT.push(SFTP_FILE);
            }
            else {
                RESULT.push(
                    {
                        //TODO: exportPath: false,
                        name: FI.name,
                        path: deploy_helpers.normalizePath(path),
                        size: FI.size,
                        time: Moment(FI.modifyTime),
                    }
                );
            }
        }

        return RESULT;
    }

    /** @inheritdoc */
    protected onDispose() {
        this.client.end().then(() => {
        }).catch((err) => {
            deploy_log.CONSOLE
                      .trace(err, 'clients.sftp.SFTPClient.onDispose(1)');
        });
    }

    /** @inheritdoc */
    public async removeFolder(path: string): Promise<boolean> {
        path = toSFTPPath(path);
        if ('/' === path) {
            return false;  // NOT the root folder!
        }

        try {
            await this.client.rmdir(path, true);

            return true;
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'clients.sftp.SFTPClient.removeFolder(1)');

            return false;
        }
    }

    /** @inheritdoc */
    public get type(): string {
        return 'sftp';
    }

    /** @inheritdoc */
    public uploadFile(path: string, data: Buffer): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const REMOTE_DIR = toSFTPPath(
                    Path.dirname(path)
                );

                path = toSFTPPath(path);

                let fileModes: SFTPFileModePatterns | false = false;
                if (!deploy_helpers.isNullOrUndefined(this.options.modes)) {
                    let modes = this.options.modes;
                    if (!deploy_helpers.isObject<SFTPFileModePatterns>(modes)) {
                        modes = {
                            '**/*': modes
                        };
                    }

                    fileModes = modes;
                }

                // create directories if needed
                if (!deploy_helpers.toBooleanSafe(this.options.supportsDeepDirectoryCreation)) {
                    await this.createParentDirectoryIfNeeded(REMOTE_DIR);
                }
                await this.createDirectoryIfNeeded(REMOTE_DIR);

                let modeToSet: SFTPModeForFile = false;
                if (false !== fileModes) {
                    let matchedPattern: false | string = false;
                    for (const P in fileModes) {
                        let pattern = P;
                        if (!pattern.trim().startsWith('/')) {
                            pattern = '/' + pattern;
                        }

                        const MATCH_OPTS: Minimatch.IOptions = {
                            dot: true,
                            nocase: true,                
                        };

                        if (deploy_helpers.doesMatch(path, pattern, MATCH_OPTS)) {
                            matchedPattern = P;
                            modeToSet = parseInt(deploy_helpers.toStringSafe(fileModes[P]).trim(),
                                                 8);
                            break;
                        }
                    }

                    if (false === matchedPattern) {
                        deploy_log.CONSOLE
                                  .notice(`'${path}' does NOT match with a mode pattern`, 'clients.sftp.uploadFile(3)');
                    }
                    else {
                        deploy_log.CONSOLE
                                  .notice(`'${path}' matches with mode pattern '${matchedPattern}'`, 'clients.sftp.uploadFile(3)');
                    }
                }

                const VALUES: deploy_values.Value[] = [            
                ].concat( this.getValuesForFile(path) );        

                let uploadError: any;
                let hasBeenUploaded = false;
                try {
                    await this.executeCommandsBy(
                        (o) => o.commands.beforeUpload,
                        VALUES,
                    );

                    let doUpload = true;

                    const BEFORE_UPLOAD_ARGS: SFTPBeforeUploadArguments = {
                        connection: this.client,
                        data: data,
                        file: path,
                        mode: modeToSet,
                    };

                    const BEFORE_UPLOAD = this.options.beforeUpload;
                    if (BEFORE_UPLOAD) {
                        const BEFORE_UPLOAD_RESULT = deploy_helpers.toBooleanSafe(await Promise.resolve(
                            BEFORE_UPLOAD( BEFORE_UPLOAD_ARGS )
                        ), true);

                        doUpload = false !== BEFORE_UPLOAD_RESULT;
                    }

                    if (doUpload) {
                        data = await deploy_helpers.asBuffer( BEFORE_UPLOAD_ARGS.data );
                        if (!data) {
                            data = Buffer.alloc(0);
                        }

                        await this.client.put(
                            data,
                            path,
                        );

                        hasBeenUploaded = true;

                        await this.executeCommandsBy(
                            (o) => o.commands.uploaded,
                            VALUES,
                        );
                    }
                }
                catch (e) {
                    uploadError = e;
                }
                finally {
                    let errorHandled = false;

                    const UPLOAD_COMPLETED_ARGS: SFTPUploadCompletedArguments = {
                        connection: this.client,
                        data: data,
                        error: uploadError,
                        file: path,
                        hasBeenUploaded: hasBeenUploaded,
                        mode: modeToSet,
                    };

                    const UPLOAD_COMPLETED = this.options.uploadCompleted;
                    if (UPLOAD_COMPLETED) {
                        const UPLOAD_COMPLETED_RESULT = deploy_helpers.toBooleanSafe(await Promise.resolve(
                            UPLOAD_COMPLETED( UPLOAD_COMPLETED_ARGS )
                        ));

                        errorHandled = false !== UPLOAD_COMPLETED_RESULT;
                    }

                    if (uploadError && !errorHandled) {
                        throw uploadError;
                    }
                }

                if (hasBeenUploaded) {
                    if (false !== modeToSet) {
                        deploy_log.CONSOLE
                                  .info(`Setting mode for '${path}' to ${modeToSet.toString(8)} ...`, 'clients.sftp.uploadFile(1)');
    
                        this.client['sftp'].chmod(path, modeToSet, (err) => {
                            if (err) {
                                deploy_log.CONSOLE
                                          .trace(err, 'clients.sftp.uploadFile(2)');
                            }
    
                            COMPLETED(err);
                        });
                    }
                    else {
                        COMPLETED(null);
                    }
                }
                else {
                    COMPLETED(null);
                }                
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
 * @param {SFTPConnectionOptions} opts The options.
 * 
 * @return {SFTPClient} The new client.
 */
export function createClient(opts: SFTPConnectionOptions): SFTPClient {
    if (!opts) {
        opts = <any>{};
    }

    return new SFTPClient(opts);
}

/**
 * Opens a connection.
 * 
 * @param {SFTPConnectionOptions} opts The options.
 * 
 * @return {Promise<SFTPClient>} The promise with new client.
 */
export async function openConnection(opts: SFTPConnectionOptions): Promise<SFTPClient> {
    const CLIENT = createClient(opts);

    let host = deploy_helpers.normalizeString(opts.host);
    if ('' === host) {
        host = deploy_contracts.DEFAULT_HOST;
    }

    let port = parseInt(
        deploy_helpers.toStringSafe(opts.port).trim()
    );
    if (isNaN(port)) {
        port = 22;
    }

    let agent = deploy_helpers.toStringSafe(opts.agent);
    if (deploy_helpers.isEmptyString(agent)) {
        agent = undefined;
    }

    let hashAlgo: any = deploy_helpers.normalizeString(opts.hashAlgorithm);
    if ('' === hashAlgo) {
        hashAlgo = 'md5';
    }

    // supported hashes
    let hashes = deploy_helpers.asArray(opts.hashes)
                               .map(x => deploy_helpers.normalizeString(x))
                               .filter(x => '' !== x);

    // username and password
    let user = deploy_helpers.toStringSafe(opts.user);
    if ('' === user) {
        user = undefined;
    }
    let pwd = deploy_helpers.toStringSafe(opts.password);
    if ('' === pwd) {
        pwd = undefined;
    }

    let privateKeyFile: string | false = deploy_helpers.toStringSafe(opts.privateKey);
    if (deploy_helpers.isEmptyString(privateKeyFile)) {
        privateKeyFile = false;
    }

    let privateKeyPassphrase = deploy_helpers.toStringSafe(opts.privateKeyPassphrase);
    if ('' === privateKeyPassphrase) {
        privateKeyPassphrase = undefined;
    }

    let readyTimeout = parseInt( deploy_helpers.toStringSafe(opts.readyTimeout).trim() );
    if (isNaN(readyTimeout)) {
        readyTimeout = 20000;
    }

    let privateKey: Buffer;
    if (false !== privateKeyFile) {
        privateKey = await deploy_helpers.readFile(privateKeyFile);
    }

    const DEBUG = deploy_helpers.toBooleanSafe(opts.debug);

    await CLIENT.client.connect({
        agent: agent,
        agentForward: deploy_helpers.toBooleanSafe(opts.agentForward),
        hostHash: hashAlgo,
        hostVerifier: (keyHash) => {
            if (hashes.length < 1) {
                return true;
            }

            keyHash = deploy_helpers.normalizeString(keyHash);
            return hashes.indexOf(keyHash) > -1;
        },
        host: host,
        passphrase: privateKeyPassphrase,
        password: pwd,
        port: port,
        privateKey: privateKey,
        readyTimeout: readyTimeout,
        tryKeyboard: deploy_helpers.toBooleanSafe(opts.tryKeyboard),
        username: user,

        debug: (info) => {
            if (!DEBUG) {
                return;
            }

            deploy_log.CONSOLE
                      .debug(info, `clients.sftp`);
        }
    });

    await CLIENT.executeCommandsBy(
        (o) => o.commands.connected,
    );

    return CLIENT;
}

/**
 * Converts to a SFTP path.
 * 
 * @param {string} p The path to convert.
 * 
 * @return {string} The converted path. 
 */
export function toSFTPPath(p: string) {
    p = deploy_helpers.normalizePath(p);
    if ('.' === p) {
        p = '';
    }

    return '/' + p;
}
