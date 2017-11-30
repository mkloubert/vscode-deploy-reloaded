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

import * as deploy_contracts from '../contracts';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as FSExtra from 'fs-extra';
import * as Path from 'path';


/**
 * A 'local' target.
 */
export interface LocalTarget extends deploy_targets.Target {
    /**
     * The target directory.
     */
    readonly dir?: string;
    /**
     * Empty directory before deploy or not.
     */
    readonly empty?: boolean;
}

interface TargetSettings {
    readonly dir: string;
    readonly empty?: boolean;
}


class LocalPlugin extends deploy_plugins.PluginBase<LocalTarget> {
    public get canDelete() {
        return true;
    }
    public get canDownload() {
        return true;
    }

    public async deleteFiles(context: deploy_plugins.DeleteContext<LocalTarget>) {
        const ME = this;

        await deploy_helpers.forEachAsync(context.files, async (f) => {
            try {
                const SETTINGS = await ME.getTargetSettings(context, f);

                let targetDir = Path.join(
                    SETTINGS.dir,
                    f.path
                );
                targetDir = Path.resolve(targetDir);

                f.onBeforeDelete(targetDir);

                let targetFile = Path.join(
                    targetDir,
                    f.name,
                );

                if (await deploy_helpers.exists(targetFile)) {
                    if ((await deploy_helpers.lstat(targetFile)).isFile()) {
                        await deploy_helpers.unlink(targetFile);
                    }
                    else {
                        //TODO: translate
                        throw new Error(
                            `'${targetFile}' is NO file!`
                        );
                    }
                }

                await f.onDeleteCompleted(null);
            }
            catch (e) {
                await f.onDeleteCompleted(e);
            }
        });
    }

    public async download(context: deploy_plugins.DownloadContext<LocalTarget>) {
        const ME = this;

        await deploy_helpers.forEachAsync(context.files, async (f) => {
            try {
                const SETTINGS = await ME.getTargetSettings(context, f);

                let targetDir = Path.join(
                    SETTINGS.dir,
                    f.path
                );
                targetDir = Path.resolve(targetDir);

                await f.onBeforeDownload(targetDir);

                let targetFile = Path.join(
                    targetDir,
                    f.name,
                );

                const DOWNLOADED_FILE = deploy_plugins.createDownloadedFileFromBuffer(
                    f, await deploy_helpers.readFile(targetFile),
                );

                await f.onDownloadCompleted(null, DOWNLOADED_FILE);
            }
            catch (e) {
                await f.onDownloadCompleted(e);
            }
        });
    }

    protected async getTargetSettings(context: deploy_plugins.FilesContext<LocalTarget>,
                                      file: deploy_plugins.WorkspaceFile): Promise<TargetSettings> {
        let dir: string | false = deploy_helpers.toStringSafe(context.target.dir);
        if ('' === dir.trim()) {
            dir = './out';
        }

        if (!Path.isAbsolute(dir)) {
            dir = Path.join(file.workspace.FOLDER.uri.fsPath, dir);
        }
        dir = Path.resolve(dir);

        if (await deploy_helpers.exists(dir)) {
            if (!(await deploy_helpers.lstat(dir)).isDirectory()) {
                //TODO: translate
                throw new Error(
                    `'${context.target.dir}' is NO directory!`
                );
            }
        }

        return {
            dir: dir,
            empty: deploy_helpers.toBooleanSafe(context.target.empty),
        };
    }

    public async upload(context: deploy_plugins.UploadContext<LocalTarget>) {
        const ME = this;
        
        const ALREADY_CHECKED = {};
        await deploy_helpers.forEachAsync(context.files, async (f) => {
            try {
                const SETTINGS = await ME.getTargetSettings(context, f);

                let targetDir = Path.join(
                    SETTINGS.dir,
                    f.path
                );
                targetDir = Path.resolve(targetDir);

                await f.onBeforeUpload(targetDir);

                if (true !== ALREADY_CHECKED[targetDir]) {
                    if (await deploy_helpers.exists(targetDir)) {
                        if (SETTINGS.empty) {
                            await FSExtra.remove(targetDir);
                        }
                    }
    
                    if (!(await deploy_helpers.exists(targetDir))) {
                        await FSExtra.mkdirs(targetDir);
                    }
                    else {
                        if (!(await deploy_helpers.lstat(targetDir)).isDirectory()) {
                            //TODO: translate
                            throw new Error(
                                `'${targetDir}' is NO directory!`
                            );
                        }
                    }

                    ALREADY_CHECKED[targetDir] = true;
                }

                let targetFile = Path.join(
                    targetDir,
                    f.name,
                );

                const DATA = await f.read();
                if (DATA) {
                    await deploy_helpers.writeFile(
                        targetFile,
                        DATA,
                    );
                }

                await f.onUploadCompleted();
            }
            catch (e) {
                await f.onUploadCompleted(e);
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
    return new LocalPlugin(context);
}
