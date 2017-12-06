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
import * as deploy_log from '../log';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as FS from 'fs';
import * as Moment from 'moment';
import * as OS from 'os';
import * as Path from 'path';
import * as SFTP from 'ssh2-sftp-client';


interface SFTPContext {
    readonly connection: SFTP;
    readonly getDir: (subDir: string) => string;
    readonly root: string;
    readonly target: SFTPTarget;
}

/**
 * A 'sftp' target.
 */
export interface SFTPTarget extends deploy_targets.Target {
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
     * The remote directory.
     */
    readonly dir?: string;
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


function normalizePath(path: string) {
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

class SFTPPlugin extends deploy_plugins.PluginBase<SFTPTarget> {
     /** @inheritdoc */
     public get canDelete() {
        return true;
    }
    
    /** @inheritdoc */
    public get canDownload() {
        return true;
    }
    
    /** @inheritdoc */
    public get canList() {
        return true;
    }

    /** @inheritdoc */
    public async deleteFiles(context: deploy_plugins.DeleteContext<SFTPTarget>): Promise<void> {
        const ME = this;

        await ME.invokeForConnection(context.target, async (sftp) => {
            for (const FILE of context.files) {
                try {
                    const REMOTE_DIR = sftp.getDir(FILE.path);

                    FILE.onBeforeDelete(REMOTE_DIR);

                    await sftp.connection.delete('/' + REMOTE_DIR + '/' + FILE.name);

                    FILE.onDeleteCompleted();
                }
                catch (e) {
                    FILE.onDeleteCompleted(e);
                }
            }
        });
    }

    /** @inheritdoc */
    public async downloadFiles(context: deploy_plugins.DownloadContext<SFTPTarget>): Promise<void> {
        const ME = this;

        await ME.invokeForConnection(context.target, async (sftp) => {
            for (const FILE of context.files) {
                try {
                    const REMOTE_DIR = sftp.getDir(FILE.path);

                    await FILE.onBeforeDownload(REMOTE_DIR);

                    const DOWNLOAD_FILE = deploy_plugins.createDownloadedFileFromBuffer(
                        FILE,
                        await ME.downloadSingleFile(sftp,
                                                    FILE.path, FILE.name)
                    );

                    await FILE.onDownloadCompleted(null, DOWNLOAD_FILE);
                }
                catch (e) {
                    await FILE.onDownloadCompleted(e);
                }
            }
        });
    }

    private async downloadSingleFile(sftp: SFTPContext, dir: string, file: string) {
        const ME = this;

        return new Promise<Buffer>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const STREAM = await sftp.connection.get('/' + sftp.getDir(dir) + '/' + file);

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

    private async invokeForConnection<TResult = any>(target: SFTPTarget,
                                                     action: (sftp: SFTPContext) => TResult): Promise<TResult> {
        const CTX = await this.openConnection(target);
        try {
            return await Promise.resolve(
                action(CTX)
            );
        }
        finally {
            try {
                await CTX.connection.end();
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'plugins.sftp.invokeForConnection()');
            }
        }
    }

    /** @inheritdoc */
    public async listDirectory(context: deploy_plugins.ListDirectoryContext<SFTPTarget>): Promise<deploy_plugins.ListDirectoryResult<SFTPTarget>> {
        const ME = this;
        
        return await ME.invokeForConnection(context.target, async (sftp) => {
            const RESULT: deploy_plugins.ListDirectoryResult<SFTPTarget> = {
                dirs: [],
                files: [],
                others: [],
                target: sftp.target,
            };

            const LIST = await sftp.connection.list('/' + sftp.getDir(context.dir));
            for (const FI of LIST) {
                if ('d' === FI.type) {
                    RESULT.dirs.push(
                        {
                            name: FI.name,
                            path: context.dir,
                            size: FI.size,
                            time: Moment(FI.modifyTime),
                            type: deploy_files.FileSystemType.Directory,
                        }
                    );
                }
                else if ('-' === FI.type) {
                    RESULT.files.push(
                        {
                            download: async () => {
                                return ME.invokeForConnection(sftp.target, async (c) => {
                                    return await ME.downloadSingleFile(sftp,
                                                                       context.dir, FI.name);
                                });
                            },
                            name: FI.name,
                            path: context.dir,
                            size: FI.size,
                            time: Moment(FI.modifyTime),
                            type: deploy_files.FileSystemType.File,
                        }
                    );
                }
                else {
                    RESULT.others.push(
                        {
                            name: FI.name,
                            path: context.dir,
                            size: FI.size,
                            time: Moment(FI.modifyTime),
                        }
                    );
                }
            }

            return RESULT;
        });
    }

    private async openConnection(target: SFTPTarget): Promise<SFTPContext> {
        let host = deploy_helpers.normalizeString(target.host);
        if ('' === host) {
            host = '127.0.0.1';
        }

        let port = parseInt(
            deploy_helpers.toStringSafe(target.port).trim()
        );
        if (isNaN(port)) {
            port = 22;
        }

        let agent = deploy_helpers.toStringSafe(target.agent);
        agent = target.__workspace.replaceWithValues(agent);
        if (deploy_helpers.isEmptyString(agent)) {
            agent = undefined;
        }

        let hashAlgo: any = deploy_helpers.normalizeString(target.hashAlgorithm);
        if ('' === hashAlgo) {
            hashAlgo = 'md5';
        }

        // supported hashes
        let hashes = deploy_helpers.asArray(target.hashes)
                                   .map(x => deploy_helpers.normalizeString(x))
                                   .filter(x => '' !== x);

        // username and password
        let user = deploy_helpers.toStringSafe(target.user);
        if ('' === user) {
            user = undefined;
        }
        let pwd = deploy_helpers.toStringSafe(target.password);
        if ('' === pwd) {
            pwd = undefined;
        }

        let privateKeyFile: string | false = deploy_helpers.toStringSafe(target.privateKey);
        privateKeyFile = target.__workspace.replaceWithValues(privateKeyFile);
        if (deploy_helpers.isEmptyString(privateKeyFile)) {
            privateKeyFile = undefined;
        }
        else {
            privateKeyFile = await target.__workspace.getExistingSettingPath(privateKeyFile);
        }

        if (false === privateKeyFile) {
            //TODO: translate
            throw new Error(`Private key file '${target.privateKey}' not found!`);
        }

        let privateKeyPassphrase = deploy_helpers.toStringSafe(target.privateKeyPassphrase);
        if ('' === privateKeyPassphrase) {
            privateKeyPassphrase = undefined;
        }

        let readyTimeout = parseInt( deploy_helpers.toStringSafe(target.readyTimeout).trim() );
        if (isNaN(readyTimeout)) {
            readyTimeout = 20000;
        }

        const DEBUG = deploy_helpers.toBooleanSafe(target.debug);

        const CONN = new SFTP();
        await CONN.connect({
            agent: agent,
            agentForward: deploy_helpers.toBooleanSafe(target.agentForward),
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
            tryKeyboard: deploy_helpers.toBooleanSafe(target.tryKeyboard),
            username: user,

            debug: (info) => {
                if (!DEBUG) {
                    return;
                }

                deploy_log.CONSOLE
                          .debug(info, `plugins.sftp('${deploy_targets.getTargetName(target)}')`);
            }
        });

        let rootDir = deploy_helpers.toStringSafe(target.dir);
        rootDir = target.__workspace.replaceWithValues(rootDir);

        return {
            connection: CONN,
            getDir: function (subDir) {
                return normalizePath(
                    normalizePath(this.root) + '/' + normalizePath(subDir),
                );
            },
            root: '/' + normalizePath(rootDir),
            target: target,
        };
    }

    /** @inheritdoc */
    public async uploadFiles(context: deploy_plugins.UploadContext<SFTPTarget>): Promise<void> {
        const ME = this;

        await this.invokeForConnection(context.target, async (sftp) => {
            const CHECKED_REMOTE_DIRS: { [name: string]: boolean } = {};

            for (const FILE of context.files) {
                if (context.isCancelling) {
                    break;
                }

                try {
                    const REMOTE_DIR = sftp.getDir(FILE.path);

                    await FILE.onBeforeUpload(REMOTE_DIR);

                    // check if remote directory exists
                    if (true !== CHECKED_REMOTE_DIRS[REMOTE_DIR]) {
                        try {
                            // check if exist
                            await sftp.connection.list(REMOTE_DIR);
                        }
                        catch {
                            // no, try to create
                            await sftp.connection.mkdir(REMOTE_DIR, true);
                        }

                        // mark as checked
                        CHECKED_REMOTE_DIRS[FILE.path] = true;
                    }

                    await sftp.connection.put(
                        await FILE.read(),
                        '/' + REMOTE_DIR + '/' + FILE.name,
                    );

                    await FILE.onUploadCompleted();
                }
                catch (e) {
                    await FILE.onUploadCompleted(e);
                }
            }
        });
    }
}

/**
 * Creates a new instance of that plugin.
 * 
 * @param {deploy_plugins.PluginContext} context The context for the plugin.
 * 
 * @return {deploy_plugins.Plugin} The new plugin.
 */
export function createPlugins(context: deploy_plugins.PluginContext) {
    return new SFTPPlugin(context);
}
