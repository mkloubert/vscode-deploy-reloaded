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
import * as Moment from 'moment';
import * as Path from 'path';


/**
 * A 'test' target.
 */
export interface TestTarget extends deploy_targets.Target {
}

//TODO: implement removeFolders()
class TestPlugin extends deploy_plugins.PluginBase<TestTarget> {
    public get canDelete() {
        return true;
    }
    public get canDownload() {
        return true;
    }
    public get canList() {
        return true;
    }

    public async deleteFiles(context: deploy_plugins.DeleteContext<TestTarget>) {
        for (const F of context.files) {
            if (context.isCancelling) {
                break;
            }

            try {
                await F.onBeforeDelete(
                    deploy_helpers.toDisplayablePath(F.path)
                );

                await deploy_helpers.readFile(
                    F.file,
                );

                await F.onDeleteCompleted(null, false);
            }
            catch (e) {
                await F.onDeleteCompleted(e);
            }
        }
    }

    public async downloadFiles(context: deploy_plugins.DownloadContext<TestTarget>) {
        for (const F of context.files) {
            if (context.isCancelling) {
                break;
            }

            try {
                await F.onBeforeDownload(
                    deploy_helpers.toDisplayablePath(F.path)
                );

                await deploy_helpers.readFile(
                    F.file,
                );

                await F.onDownloadCompleted(null);
            }
            catch (e) {
                await F.onDownloadCompleted(e);
            }
        }
    }

    public async listDirectory(context: deploy_plugins.ListDirectoryContext<TestTarget>) {
        const ME = this;

        const WORKSPACE_DIR = context.workspace.rootPath;

        let targetDir = Path.join(
            WORKSPACE_DIR,
            context.dir
        );
        targetDir = Path.resolve(targetDir);

        if (!context.workspace.isPathOf(targetDir)) {
            throw new Error(
                ME.t(context.target,
                     'plugins.test.invalidDirectory', context.dir)
            );
        }

        let relativePath = targetDir.substr(WORKSPACE_DIR.length);
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

        const RESULT: deploy_plugins.ListDirectoryResult<TestTarget> = {
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

    public async uploadFiles(context: deploy_plugins.UploadContext<TestTarget>) {
        for (const F of context.files) {
            if (context.isCancelling) {
                break;
            }

            try {
                await F.onBeforeUpload(
                    deploy_helpers.toDisplayablePath(F.path)
                );

                await F.read();

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
    return new TestPlugin(context);
}
