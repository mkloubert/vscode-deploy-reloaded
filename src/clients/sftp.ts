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
import * as deploy_log from '../log';
import * as FS from 'fs';
import * as Moment from 'moment';
import * as Path from 'path';
import * as SFTP from 'ssh2-sftp-client';


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
     * Try keyboard-interactive user authentication if primary user authentication method fails.
     */
    readonly tryKeyboard?: boolean;
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

    /** @inheritdoc */
    public async deleteFile(path: string): Promise<boolean> {
        const ME = this;

        path = toSFTPPath(path);

        try {
            await this.client.delete(path);

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

        return new Promise<Buffer>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const STREAM = await ME.client.get(path);

                STREAM.once('error', (err) => {;
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
        
                COMPLETED(null, DOWNLOADED_DATA);
            }
            catch (e) {
                COMPLETED(e);
            }
        });
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
                        name: FI.name,
                        path: normalizePath(path),
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
                                normalizePath(path) +
                                '/' +
                                normalizePath(FI.name)
                            );
                        }
                        finally {
                            try {
                                await CLIENT.client.end();
                            }
                            catch (e) {
                                deploy_log.CONSOLE
                                          .trace(e, 'clients.sftp.SFTPClient.listDirectory().FI.download()');
                            }
                        }
                    },
                    name: FI.name,
                    path: normalizePath(path),
                    size: FI.size,
                    time: Moment(FI.modifyTime),
                    type: deploy_files.FileSystemType.File,
                };

                RESULT.push(SFTP_FILE);
            }
            else {
                RESULT.push(
                    {
                        name: FI.name,
                        path: normalizePath(path),
                        size: FI.size,
                        time: Moment(FI.modifyTime),
                    }
                );
            }
        }

        return RESULT;
    }

    /** @inheritdoc */
    public get type(): string {
        return 'sftp';
    }

    /** @inheritdoc */
    public async uploadFile(path: string, data: Buffer): Promise<void> {
        const REMOTE_DIR = toSFTPPath(
            Path.dirname(path)
        );
        const FILE = Path.basename(path);

        path = toSFTPPath(path);

        // check if remote directory exists
        if (true !== this._checkedRemoteDirs[REMOTE_DIR]) {
            try {
                // check if exist
                await this.client.list(REMOTE_DIR);
            }
            catch (e) {
                // no, try to create
                await this.client.mkdir(REMOTE_DIR, true);
            }

            // mark as checked
            this._checkedRemoteDirs[REMOTE_DIR] = true;
        }

        await this.client.put(
            data,
            path,
        );
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
 * @param {SFTPConnectionOptions} opts The options.
 * 
 * @return {Promise<SFTPClient>} The promise with new client.
 */
export async function openConnection(opts: SFTPConnectionOptions): Promise<SFTPClient> {
    const CLIENT = createClient(opts);

    let host = deploy_helpers.normalizeString(opts.host);
    if ('' === host) {
        host = '127.0.0.1';
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

    let privateKeyFile: string = deploy_helpers.toStringSafe(opts.privateKey);
    if (deploy_helpers.isEmptyString(privateKeyFile)) {
        privateKeyFile = undefined;
    }

    let privateKeyPassphrase = deploy_helpers.toStringSafe(opts.privateKeyPassphrase);
    if ('' === privateKeyPassphrase) {
        privateKeyPassphrase = undefined;
    }

    let readyTimeout = parseInt( deploy_helpers.toStringSafe(opts.readyTimeout).trim() );
    if (isNaN(readyTimeout)) {
        readyTimeout = 20000;
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
        privateKey: privateKeyFile,
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

    return CLIENT;
}

/**
 * Converts to a SFTP path.
 * 
 * @param {string} path The path to convert.
 * 
 * @return {string} The converted path. 
 */
export function toSFTPPath(path: string) {
    return '/' + normalizePath(path);
}
