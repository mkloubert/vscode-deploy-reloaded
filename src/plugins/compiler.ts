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

import * as deploy_compilers from '../compilers';
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as deploy_workspaces from '../workspaces';
const MergeDeep = require('merge-deep');
import * as Moment from 'moment';
import * as Path from 'path';


interface CompilerContext {
    compiler: deploy_compilers.Compiler;
    outputDirectory?: string;
    sourceExtension: string;
    target?: CompilerTarget;
    targetExtension: string;
    workspace?: deploy_workspaces.Workspace;
}

/**
 * A 'compiler' target.
 */
export interface CompilerTarget extends deploy_targets.Target {
    /**
     * The name of the compiler to use.
     */
    readonly compiler: string;
    /**
     * The custom output directory.
     */
    readonly dir?: string;
    /**
     * Additional options for the compiler.
     */
    readonly options?: Object;
}

//TODO: implement removeFolders()
class CompilerPlugin extends deploy_plugins.PluginBase<CompilerTarget> {
    public get canDelete() {
        return true;
    }
    public get canList() {
        return true;
    }

    private async createCompilerContext(target: CompilerTarget): Promise<CompilerContext> {
        const ME = this;

        let context: CompilerContext | false = false;

        const COMPILER = deploy_helpers.normalizeString(
            ME.replaceWithValues(target, target.compiler)
        );
        switch (COMPILER) {
            case 'coffee':
            case 'coffeescript':
                context = {
                    compiler: deploy_compilers.Compiler.CoffeeScript,
                    sourceExtension: 'coffee',
                    targetExtension: 'js',
                };
                break;

            case 'html-min':
            case 'html-minifier':
            case 'htmlmin':
            case 'htmlminifier':
                context = {
                    compiler: deploy_compilers.Compiler.HtmlMinifier,
                    sourceExtension: 'html',
                    targetExtension: 'min.html',
                };
                break;

            case 'less':
                context = {
                    compiler: deploy_compilers.Compiler.Less,
                    sourceExtension: 'less',
                    targetExtension: 'css',
                };
                break;

            case 'pug':
                context = {
                    compiler: deploy_compilers.Compiler.Pug,
                    sourceExtension: 'pug',
                    targetExtension: 'html',
                };
                break;

            case 'uglify-js':
            case 'uglifyjs':
                context = {
                    compiler: deploy_compilers.Compiler.UglifyJS,
                    sourceExtension: 'js',
                    targetExtension: 'min.js',
                };
                break;
        }

        if (false === context) {
            throw new Error(ME.t(target,
                                 'compilers.notSupported', COMPILER));
        }

        context.target = target;
        context.workspace = target.__workspace;

        if (!deploy_helpers.isEmptyString(target.dir)) {
            context.outputDirectory = ME.replaceWithValues(target, target.dir);

            if (!Path.isAbsolute(context.outputDirectory)) {
                context.outputDirectory = Path.join(
                    context.workspace.rootPath,
                    context.outputDirectory
                );
            }

            context.outputDirectory = Path.resolve(context.outputDirectory);
        }

        if (deploy_helpers.isEmptyString(context.outputDirectory)) {
            context.outputDirectory = context.workspace.rootPath;
        }

        return context;
    }

    public async deleteFiles(context: deploy_plugins.DeleteContext<CompilerTarget>) {
        const ME = this;

        const COMPILER = await ME.createCompilerContext(context.target);

        for (const F of context.files) {
            if (context.isCancelling) {
                break;
            }

            try {
                const TARGET_DIR = Path.resolve(
                    Path.join(
                        COMPILER.outputDirectory,
                        F.path,
                    )
                );

                await F.onBeforeDelete(TARGET_DIR);

                const FILENAME = Path.basename(
                    F.file,
                    Path.extname(F.file)
                );
                
                const TARGET_FILE = Path.resolve(
                    Path.join(
                        COMPILER.outputDirectory,
                        F.path + '/' + FILENAME + '.' + COMPILER.targetExtension,
                    )
                );

                await deploy_helpers.unlink(TARGET_FILE);

                await F.onDeleteCompleted(null, false);
            }
            catch (e) {
                await F.onDeleteCompleted(e);
            }
        }
    }

    public async listDirectory(context: deploy_plugins.ListDirectoryContext<CompilerTarget>) {
        const ME = this;

        const COMPILER = await ME.createCompilerContext(context.target);

        let targetDir = Path.join(
            COMPILER.outputDirectory,
            context.dir
        );
        targetDir = Path.resolve(targetDir);

        if (!targetDir.startsWith(COMPILER.outputDirectory)) {
            throw new Error(
                ME.t(context.target,
                     'plugins.compiler.invalidDirectory', context.dir)
            );
        }

        let relativePath = targetDir.substr(COMPILER.outputDirectory.length);
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

        const RESULT: deploy_plugins.ListDirectoryResult<CompilerTarget> = {
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

    public async uploadFiles(context: deploy_plugins.UploadContext<CompilerTarget>) {
        const COMPILER = await this.createCompilerContext(context.target);

        const FILES_TO_COMPILERS: string[] = [];
        for (const F of context.files) {
            if (context.isCancelling) {
                break;
            }

            try {
                const TARGET_DIR = Path.resolve(
                    Path.join(
                        COMPILER.outputDirectory,
                        F.path,
                    )
                );

                await F.onBeforeUpload(TARGET_DIR);

                await F.read();
                FILES_TO_COMPILERS.push(
                    '/' + deploy_helpers.normalizePath(
                        F.path + '/' + F.name
                    )
                );

                await F.onUploadCompleted();
            }
            catch (e) {
                await F.onUploadCompleted(e);
            }
        }

        const DEFAULT_OPTS: deploy_compilers.CompileOptions = {
            files: FILES_TO_COMPILERS,
            options: deploy_helpers.cloneObject(COMPILER.target.options),
            outDirectory: COMPILER.outputDirectory,
            workspace: COMPILER.workspace,
        };

        const RESULT = await deploy_compilers.compile(
            COMPILER.compiler,
            MergeDeep(DEFAULT_OPTS, COMPILER.target.options)
        );

        //TODO: show result messages
        if (RESULT) {
            for (const MSG of deploy_helpers.asArray(RESULT.messages)) {
                switch (MSG.category) {
                    case deploy_compilers.CompileResultMessageCategory.Error:
                        throw new Error(MSG.message);

                    case deploy_compilers.CompileResultMessageCategory.Warning:
                        break;
                }
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
    return new CompilerPlugin(context);
}
