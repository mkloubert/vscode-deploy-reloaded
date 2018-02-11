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

import * as deploy_clients_slack from '../clients/slack';
import * as deploy_contracts from '../contracts';
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as Enumerable from 'node-enumerable';
const Zip = require('node-zip');


/**
 * A 'test' target.
 */
export interface SlackTarget extends deploy_targets.Target {
    /**
     * One or more channels to deploy to.
     */
    readonly channels: string | string[];

    /**
     * The API token to use.
     */
    readonly token: string;
}


class SlackPlugin extends deploy_plugins.PluginBase<SlackTarget> {
    public get canList() {
        return true;
    }

    private async invokeForClient<TResult = any>(target: SlackTarget,
                                                 action: (client: deploy_clients_slack.SlackClient, target: SlackTarget) => TResult | PromiseLike<TResult>): Promise<TResult> {
        const CLIENT = deploy_clients_slack.createClient({
            token: deploy_helpers.toStringSafe(
                this.replaceWithValues(target, target.token)
            ).trim(),
        });
        try {
            return await Promise.resolve(
                action(CLIENT, target)
            );
        }
        finally {
            deploy_helpers.tryDispose(CLIENT);
        }
    }

    public async listDirectory(context:  deploy_plugins.ListDirectoryContext<SlackTarget>): Promise<deploy_plugins.ListDirectoryResult<SlackTarget>> {
        const ME = this;

        return await ME.invokeForClient(context.target, async (client, t) => {
            const RESULT: deploy_plugins.ListDirectoryResult<SlackTarget> = {
                dirs: [],
                files: [],
                info: deploy_files.createDefaultDirectoryInfo(context.dir),
                others: [],
                target: t,
            };

            const LIST = await client.listDirectory(context.dir);
            for (const FSI of LIST) {
                if (!FSI) {
                    continue;
                }

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

    public async uploadFiles(context: deploy_plugins.UploadContext<SlackTarget>): Promise<void> {
        const ME = this;

        await ME.invokeForClient(context.target, async (client, t) => {
            const CHANNELS = Enumerable.from(
                deploy_helpers.asArray(t.channels)
            ).selectMany(c => {
                return deploy_helpers.toStringSafe( ME.replaceWithValues(t, c) )
                                     .split(',');
            }).select(c => {
                return c.toUpperCase()
                        .trim();
            }).where(c => {
                return '' !== c;
            }).toArray();

            for (const C of CHANNELS) {
                const FILES_TO_UPLOAD = context.files;

                const FOR_FILE = async (index: number, action: (f: deploy_plugins.FileToUpload) => any) => {
                    const FILE = FILES_TO_UPLOAD[index];

                    try {
                        FILE.onBeforeUpload(
                            CHANNELS.join(', ')
                        );

                        await Promise.resolve(
                            action(FILE)
                        );

                        FILE.onUploadCompleted();
                    }
                    catch (e) {
                        FILE.onUploadCompleted(e);
                    }
                };

                if (1 === FILES_TO_UPLOAD.length) {
                    await FOR_FILE(0, async (f) => {
                        await client.uploadFile(C + '/' + f.name,
                                                await f.read());
                    });
                }
                else {
                    const ZIPFile = new Zip();
                    const ZIPFilename = deploy_targets.getZipFileName(context.target);

                    for (let i = 0; i < FILES_TO_UPLOAD.length; i++) {
                        await FOR_FILE(i, async (f) => {
                            ZIPFile.file(deploy_helpers.normalizePath(f.path + '/' + f.name),
                                         await f.read());
                        });
                    }

                    const ZIPPED_DATA = new Buffer(ZIPFile.generate({
                        base64: false,
                        comment: deploy_contracts.ZIP_COMMENT,
                        compression: 'DEFLATE',
                    }), 'binary');

                    await client.uploadFile(C + '/' + ZIPFilename,
                                            ZIPPED_DATA);
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
    return new SlackPlugin(context);
}
