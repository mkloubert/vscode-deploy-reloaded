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
    public get canRemoveFolders() {
        return true;
    }
    

    public async deleteFiles(context: deploy_plugins.DeleteContext<LocalTarget>) {
        const ME = this;

        for (const F of context.files) {
            try {
                const SETTINGS = await ME.getTargetSettings(context, F);

                let targetDir = Path.join(
                    SETTINGS.dir,
                    F.path
                );
                targetDir = Path.resolve(targetDir);

                await F.onBeforeDelete(targetDir);
                if (context.isCancelling) {
                    break;
                }

                const TARGET_FILE = Path.join(
                    targetDir,
                    F.name,
                );

                if (await deploy_helpers.exists(TARGET_FILE)) {
                    if ((await deploy_helpers.lstat(TARGET_FILE)).isFile()) {
                        await deploy_helpers.unlink(TARGET_FILE);
                    }
                    else {
                        throw new Error(
                            ME.t(context.target,
                                 'isNo.file', TARGET_FILE)
                        );
                    }
                }

                await F.onDeleteCompleted(null);
            }
            catch (e) {
                await F.onDeleteCompleted(e);
            }
        }
    }

    public async downloadFiles(context: deploy_plugins.DownloadContext<LocalTarget>) {
        for (const F of context.files) {
            try {
                const SETTINGS = await this.getTargetSettings(context, F);

                let targetDir = Path.join(
                    SETTINGS.dir,
                    F.path
                );
                targetDir = Path.resolve(targetDir);

                await F.onBeforeDownload(targetDir);
                if (context.isCancelling) {
                    break;
                }

                const TARGET_FILE = Path.join(
                    targetDir,
                    F.name,
                );

                const DOWNLOADED_FILE = deploy_plugins.createDownloadedFileFromBuffer(
                    F, await deploy_helpers.readFile(TARGET_FILE),
                );

                await F.onDownloadCompleted(null, DOWNLOADED_FILE);
            }
            catch (e) {
                await F.onDownloadCompleted(e);
            }
        }
    }

    private async getTargetSettings(context: deploy_plugins.FilesContext<LocalTarget>,
                                    item: deploy_workspaces.WorkspaceItem): Promise<TargetSettings> {
        const ME = this;

        const DIR = ME.normalizeDir(context.target, item);

        if (await deploy_helpers.exists(DIR)) {
            if (!(await deploy_helpers.lstat(DIR)).isDirectory()) {
                throw new Error(
                    ME.t(context.target,
                         'isNo.dir', DIR)
                );
            }
        }

        return {
            dir: DIR,
            empty: deploy_helpers.toBooleanSafe(context.target.empty),
        };
    }

    public async listDirectory(context: deploy_plugins.ListDirectoryContext<LocalTarget>) {
        const ME = this;

        const DIR = ME.normalizeDir(context.target, context);

        let targetDir = Path.join(
            DIR,
            context.dir
        );
        targetDir = Path.resolve(targetDir);

        if (!targetDir.startsWith(DIR)) {
            throw new Error(
                ME.t(context.target,
                     'plugins.local.invalidDirectory', context.dir)
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
            info: deploy_files.createDefaultDirectoryInfo(context.dir, {
                exportPath: targetDir,
            }),
            others: [],
            target: context.target,
        };

        if (context.isCancelling) {
            return;
        }

        const FILES_AND_FOLDERS = await deploy_helpers.readDir(targetDir);
        for (const F of FILES_AND_FOLDERS) {
            let fullPath = Path.join(
                targetDir, F
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
                    exportPath: Path.resolve(
                        Path.join(targetDir, F)
                    ),
                    name: F,
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
                    exportPath: Path.resolve(
                        Path.join(targetDir, F)
                    ),
                    name: F,
                    path: relativePath,
                    size: SIZE,
                    time: time,
                    type: deploy_files.FileSystemType.File,
                };

                RESULT.files.push(FI);
            }
            else {
                const FSI: deploy_files.FileSystemInfo = {
                    exportPath: Path.resolve(
                        Path.join(targetDir, F)
                    ),
                    name: F,
                    path: relativePath,
                    size: SIZE,
                    time: time,
                };

                RESULT.others.push(FSI);
            }
        }

        return RESULT;
    }

    private normalizeDir(target: LocalTarget, wsi: deploy_workspaces.WorkspaceItem) {
        let dir = this.replaceWithValues(
            target,
            target.dir
        );
        if (deploy_helpers.isEmptyString(dir)) {
            dir = './out';
        }

        if (!Path.isAbsolute(dir)) {
            dir = Path.join(wsi.workspace.rootPath, dir);
        }
        dir = Path.resolve(dir);

        return dir;
    }

    public async removeFolders(context: deploy_plugins.RemoveFoldersContext<LocalTarget>) {
        const TARGET = context.target;

        for (const F of context.folders) {
            try {
                await F.onBeforeRemove(
                    deploy_helpers.toDisplayablePath(F.path)
                );

                const SETTINGS = await this.getTargetSettings(context, F);

                const TARGET_DIR = Path.resolve(
                    Path.join(
                        SETTINGS.dir, F.path
                    )
                );
        
                if (!this.isPathOf(TARGET, TARGET_DIR) || (SETTINGS.dir === TARGET_DIR)) {
                    throw new Error(
                        this.t(TARGET,
                               'plugins.local.invalidDirectory', F.path)
                    );
                }

                if (!(await deploy_helpers.isDirectory(TARGET_DIR))) {
                    throw new Error(
                        this.t(TARGET,
                               'isNo.directory', TARGET_DIR)
                    );
                }

                await FSExtra.remove(TARGET_DIR);

                await F.onRemoveCompleted();
            }
            catch (e) {
                await F.onRemoveCompleted(e);
            }
        }
    }

    public async uploadFiles(context: deploy_plugins.UploadContext<LocalTarget>) {
        const ME = this;

        const ALREADY_CHECKED = {};
        for (const F of context.files) {
            try {
                const SETTINGS = await ME.getTargetSettings(context, F);

                let targetDir = Path.join(
                    SETTINGS.dir,
                    F.path
                );
                targetDir = Path.resolve(targetDir);

                await F.onBeforeUpload(targetDir);
                if (context.isCancelling) {
                    break;
                }

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
                            throw new Error(
                                ME.t(context.target,
                                     'isNo.dir', targetDir),
                            );
                        }
                    }

                    ALREADY_CHECKED[targetDir] = true;
                }

                const TARGET_FILE = Path.join(
                    targetDir,
                    F.name,
                );

                const DATA = await F.read();
                if (DATA) {
                    await deploy_helpers.writeFile(
                        TARGET_FILE,
                        DATA,
                    );
                }

                await F.onUploadCompleted();
            }
            catch (e) {
                await F.onUploadCompleted(e);
            }
        }
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
