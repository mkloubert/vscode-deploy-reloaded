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

import * as deploy_clients_dropbox from '../clients/dropbox';
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_log from '../log';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';


interface DropboxContext {
    readonly client: deploy_clients_dropbox.DropBoxClient;
    readonly target: DropboxTarget;
}

/**
 * A 'Dropbox' target.
 */
export interface DropboxTarget extends deploy_targets.Target {
    /**
     * The root directory.
     */
    readonly dir?: string;
    /**
     * The API token to use.
     */
    readonly token: string;
}


class DropboxPlugin extends deploy_plugins.PluginBase<DropboxTarget> {
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


    public async deleteFiles(context: deploy_plugins.DeleteContext<DropboxTarget>): Promise<void> {
        const ME = this;

        await ME.invokeForConnection(context.target, async (dropbox) => {
            for (const FILE of context.files) {
                try {
                    const REMOTE_DIR = '/' + FILE.path;

                    await FILE.onBeforeDelete(REMOTE_DIR);

                    await dropbox.client.deleteFile(
                        FILE.path + '/' + FILE.name,
                    );

                    await FILE.onDeleteCompleted();
                }
                catch (e) {
                    await FILE.onDeleteCompleted(e);
                }
            }
        });
    }

    public async downloadFiles(context: deploy_plugins.DownloadContext<DropboxTarget>): Promise<void> {
        const ME = this;

        await ME.invokeForConnection(context.target, async (dropbox) => {
            for (const FILE of context.files) {
                try {
                    const REMOTE_DIR = '/' + FILE.path;

                    await FILE.onBeforeDownload(REMOTE_DIR);

                    const DOWNLOADED_DATA = await dropbox.client.downloadFile(
                        FILE.path + '/' + FILE.name
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

    private async invokeForConnection<TResult = any>(target: DropboxTarget,
                                                     action: (context: DropboxContext) => TResult | PromiseLike<TResult>): Promise<TResult> {
        let accessToken = deploy_helpers.toStringSafe(target.token).trim();
        if ('' === accessToken) {
            accessToken = undefined;
        }
        
        const CLIENT = deploy_clients_dropbox.createClient({ 
            accessToken: accessToken
        });
        try {
            const CTX: DropboxContext = {
                client: CLIENT,
                target: target,
            };

            return await Promise.resolve(
                action(CTX)
            );
        }
        finally {
            deploy_helpers.tryDispose(CLIENT);
        }
    }

    public async listDirectory(context: deploy_plugins.ListDirectoryContext<DropboxTarget>): Promise<deploy_plugins.ListDirectoryResult<DropboxTarget>> {
        const ME = this;

        return await ME.invokeForConnection(context.target, async (dropbox) => {
            const RESULT: deploy_plugins.ListDirectoryResult<DropboxTarget> = {
                dirs: [],
                files: [],
                others: [],
                target: context.target,
            };

            const LIST = await dropbox.client.listDirectory(context.dir);
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

    public async uploadFiles(context: deploy_plugins.UploadContext<DropboxTarget>): Promise<void> {
        const ME = this;

        await ME.invokeForConnection(context.target, async (dropbox) => {
            for (const FILE of context.files) {
                try {
                    const REMOTE_DIR = '/' + FILE.path;

                    await FILE.onBeforeUpload(REMOTE_DIR);

                    await dropbox.client.uploadFile(
                        FILE.path + '/' + FILE.name,
                        await FILE.read(),
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
    return new DropboxPlugin(context);
}
