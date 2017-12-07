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

import * as deploy_clients_ftp from '../clients/ftp';
import * as deploy_files from '../files';
import * as deploy_log from '../log';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';


interface FTPContext {
    readonly client: deploy_clients_ftp.FtpClientBase;
    readonly getDir: (subDir: string) => string;
    readonly target: FTPTarget;
}

/**
 * A 'ftp' target.
 */
export interface FTPTarget extends deploy_targets.Target {
    /**
     * The root directory.
     */
    readonly dir?: string;
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


class FTPPlugin extends deploy_plugins.PluginBase<FTPTarget> {
    public get canDelete() {
        return true;
    }
    public get canDownload() {
        return true;
    }
    public get canList() {
        return true;
    }

    public async deleteFiles(context: deploy_plugins.DeleteContext<FTPTarget>): Promise<void> {
        const ME = this;

        await ME.invokeForConnection(context.target, async (ftp) => {
            for (const FILE of context.files) {
                if (context.isCancelling) {
                    break;
                }

                try {
                    const REMOTE_DIR = '/' + ftp.getDir(FILE.path);
                    
                    await FILE.onBeforeDelete(REMOTE_DIR);

                    await ftp.client.unlink(
                        ftp.getDir(FILE.path + '/' + FILE.name)
                    );
                    
                    await FILE.onDeleteCompleted();
                }
                catch (e) {
                    await FILE.onDeleteCompleted(e);
                }
            }
        });
    }

    public async downloadFiles(context: deploy_plugins.DownloadContext<FTPTarget>): Promise<void> {
        const ME = this;

        await ME.invokeForConnection(context.target, async (ftp) => {
            for (const FILE of context.files) {
                if (context.isCancelling) {
                    break;
                }

                try {
                    const REMOTE_DIR = '/' + ftp.getDir(FILE.path);
                    
                    await FILE.onBeforeDownload(REMOTE_DIR);

                    const DOWNLOADED_DATA = await ftp.client.get(
                        ftp.getDir(FILE.path + '/' + FILE.name)
                    );
                    
                    await FILE.onDownloadCompleted(null,
                                                   deploy_plugins.createDownloadedFileFromBuffer(FILE, DOWNLOADED_DATA));
                }
                catch (e) {
                    await FILE.onDownloadCompleted(e);
                }
            }
        });
    }

    private async invokeForConnection<TResult = any>(target: FTPTarget,
                                                     action: (context: FTPContext) => TResult | PromiseLike<TResult>): Promise<TResult> {
        const OPTS: deploy_clients_ftp.FTPConnectionOptions = {
            engine: target.engine,
            host: target.host,
            password: target.password,
            port: target.port,
            user: target.user,
        };

        const CLIENT = await deploy_clients_ftp.openConnection(OPTS);
        try {
            const CTX: FTPContext = {
                client: CLIENT,
                getDir: (subDir) => {
                    return deploy_clients_ftp.normalizePath(
                        deploy_clients_ftp.normalizePath(target.dir) + 
                        '/' + 
                        deploy_clients_ftp.normalizePath(subDir)
                    );
                },
                target: target,
            };

            return await Promise.resolve(
                action(CTX)
            );
        }
        finally {
            try {
                await CLIENT.end();
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'plugins.ftp.invokeForConnection()');
            }
        }
    }

    public async listDirectory(context: deploy_plugins.ListDirectoryContext<FTPTarget>): Promise<deploy_plugins.ListDirectoryResult<FTPTarget>> {
        const ME = this;

        return await ME.invokeForConnection(context.target, async (ftp) => {
            const TARGET_DIR = '/' + ftp.getDir(context.dir);

            const RESULT: deploy_plugins.ListDirectoryResult<FTPTarget> = {
                dirs: [],
                files: [],
                others: [],
                target: context.target,
            };

            const LIST = await ftp.client.list(TARGET_DIR);
            for (const FSI of LIST) {
                switch (FSI.type) {
                    case deploy_files.FileSystemType.Directory:
                        RESULT.dirs.push(<deploy_files.DirectoryInfo>FSI);
                        break;

                    case deploy_files.FileSystemType.File:
                        RESULT.files.push(<deploy_files.FileInfo>FSI);
                        break;

                    default:
                        RESULT.others.push(FSI);
                        break;
                }
            }

            return RESULT;
        });
    }

    public async uploadFiles(context: deploy_plugins.UploadContext<FTPTarget>): Promise<void> {
        const ME = this;

        await ME.invokeForConnection(context.target, async (ftp) => {
            const CHECKED_REMOTE_DIRS: { [name: string]: boolean } = {};

            for (const FILE of context.files) {
                if (context.isCancelling) {
                    break;
                }

                try {
                    const REMOTE_DIR = '/' + ftp.getDir(FILE.path);

                    await FILE.onBeforeUpload(REMOTE_DIR);

                    // check if remote directory exists
                    if (true !== CHECKED_REMOTE_DIRS[REMOTE_DIR]) {
                        try {
                            // check if exist
                            await ftp.client.cwd(REMOTE_DIR);
                        }
                        catch {
                            // no, try to create
                            await ftp.client.mkdir(REMOTE_DIR);
                        }

                        // mark as checked
                        CHECKED_REMOTE_DIRS[FILE.path] = true;
                    }

                    await ftp.client.put(
                        ftp.getDir(FILE.path + '/' + FILE.name),
                        await FILE.read()
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
    return new FTPPlugin(context);
}
