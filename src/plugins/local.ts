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
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as deploy_workspaces from '../workspaces';
import * as FSExtra from 'fs-extra';
import * as Moment from 'moment';
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
    public get canList() {
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

    public async downloadFiles(context: deploy_plugins.DownloadContext<LocalTarget>) {
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
                                      file: deploy_workspaces.WorkspaceFile): Promise<TargetSettings> {
        const DIR = this.normalizeDir(context.target, file);

        if (await deploy_helpers.exists(DIR)) {
            if (!(await deploy_helpers.lstat(DIR)).isDirectory()) {
                //TODO: translate
                throw new Error(
                    `'${context.target.dir}' is NO directory!`
                );
            }
        }

        return {
            dir: DIR,
            empty: deploy_helpers.toBooleanSafe(context.target.empty),
        };
    }

    public async listDirectory(context: deploy_plugins.ListDirectoryContext<LocalTarget>) {
        const DIR = this.normalizeDir(context.target, context);

        let targetDir = Path.join(
            DIR,
            context.dir
        );
        targetDir = Path.resolve(targetDir);

        if (!targetDir.startsWith(DIR)) {
            //TODO: translate
            throw new Error(
                `'${context.dir}' is an invalid directory!`
            );
        }

        let relativePath = targetDir.substr(DIR.length);
        relativePath = deploy_helpers.replaceAllStrings(relativePath, Path.sep, '/');

        while (relativePath.startsWith('/')) {
            relativePath = relativePath.substr(1);
        }
        while (relativePath.endsWith('/')) {
            relativePath = relativePath.substr(0, relativePath.length - 1);
        }

        if (deploy_helpers.isEmptyString(relativePath)) {
            relativePath = '';
        }

        const RESULT: deploy_plugins.ListDirectoryResult<LocalTarget> = {
            dirs: [],
            files: [],
            others: [],
            target: context.target,
        };

        const FILES_AND_FOLDERS = await deploy_helpers.readDir(targetDir);
        await deploy_helpers.forEachAsync(FILES_AND_FOLDERS, async (f) => {
            let fullPath = Path.join(
                targetDir, f
            );

            const STATS = await deploy_helpers.lstat(fullPath);

            let time: Moment.Moment;
            if (STATS.mtime) {
                time = Moment(STATS.mtime);
                if (time.isValid() && !time.isUTC()) {
                    time = time.utc();
                }
            }

            const SIZE = STATS.size;

            if (STATS.isDirectory()) {
                const DI: deploy_files.DirectoryInfo = {
                    name: f,
                    path: relativePath,
                    size: SIZE,
                    time: time,
                    type: deploy_files.FileSystemType.Directory,
                };

                RESULT.dirs.push(DI);
            }
            else if (STATS.isFile()) {
                const FI: deploy_files.FileInfo = {
                    download: async () => {
                        return deploy_helpers.readFile(fullPath);
                    },
                    name: f,
                    path: relativePath,
                    size: SIZE,
                    time: time,
                    type: deploy_files.FileSystemType.File,
                };

                RESULT.files.push(FI);
            }
            else {
                const FSI: deploy_files.FileSystemInfo = {
                    name: f,
                    path: relativePath,
                    size: SIZE,
                    time: time,
                };

                RESULT.others.push(FSI);
            }
        });

        return RESULT;
    }

    private normalizeDir(target: LocalTarget, wsi: deploy_workspaces.WorkspaceItem) {
        let dir = deploy_helpers.toStringSafe(target.dir);
        if (deploy_helpers.isEmptyString(dir)) {
            dir = './out'
        }

        if (!Path.isAbsolute(dir)) {
            dir = Path.join(wsi.workspace.folder.uri.fsPath, dir);
        }
        dir = Path.resolve(dir);

        return dir;
    }

    public async uploadFiles(context: deploy_plugins.UploadContext<LocalTarget>) {
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
