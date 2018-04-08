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

import * as CopyPaste from 'copy-paste';
import * as deploy_contracts from './contracts';
import * as deploy_files from './files';
import * as deploy_gui from './gui';
import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as deploy_plugins from './plugins';
import * as deploy_targets from './targets';
import * as deploy_transformers from './transformers';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as FileSize from 'filesize';
import * as IsStream from 'is-stream';
import * as Path from 'path';
import * as vscode from 'vscode';


type SyncFoldersAction = (
    target: deploy_targets.Target,
    sourceDir: string, targetDir: string,
    transformer: deploy_transformers.DataTransformer,
    progress: deploy_helpers.ProgressContext,
    recursive: boolean,
    depth?: number, maxDepth?: number
) => PromiseLike<void>;

interface SyncFoldersActionOptions {
    readonly action: SyncFoldersAction;
    readonly label: string;
    readonly recursive: boolean;
    readonly title: string;
}


let nextPullCancelBtnCommandId = Number.MIN_SAFE_INTEGER;

async function createPullDataTransformer(target: deploy_targets.Target): Promise<deploy_transformers.DataTransformer> {
    const WORKSPACE = target.__workspace;

    const TARGET_NAME = deploy_targets.getTargetName(target);

    const TRANSFORMER = await WORKSPACE.loadDataTransformer(target);
    if (false === TRANSFORMER) {
        throw new Error(WORKSPACE.t('targets.errors.couldNotLoadDataTransformer',
                                    TARGET_NAME));
    }

    return deploy_transformers.toDataTransformerSafe(
        deploy_transformers.toPasswordTransformer(TRANSFORMER, target)
    );
}

function createPullDataTransformerContext(file: deploy_contracts.WithNameAndPath,
                                          target: deploy_targets.Target)
    : deploy_transformers.DataTransformerContext
{
    const STATE_KEY = deploy_helpers.toStringSafe(target.__id);
    const WORKSPACE = target.__workspace;

    const TRANSFORMER_OPTIONS = deploy_helpers.cloneObject(target.transformerOptions);

    const CTX: deploy_transformers.DataTransformerContext = {
        _: require('lodash'),
        context: {
            deployOperation: deploy_contracts.DeployOperation.Pull,
            remoteFile: deploy_helpers.normalizePath(
                deploy_helpers.normalizePath(file.path) + 
                '/' + 
                deploy_helpers.normalizePath(file.name)
            ),
            target: target,
        },
        events: WORKSPACE.workspaceSessionState['pull']['events'],
        extension: WORKSPACE.context.extension,
        folder: WORKSPACE.folder,
        globalEvents: deploy_helpers.EVENTS,
        globals: WORKSPACE.globals,
        globalState: WORKSPACE.workspaceSessionState['pull']['states']['global'],
        homeDir: deploy_helpers.getExtensionDirInHome(),
        logger: WORKSPACE.createLogger(),
        mode: deploy_transformers.DataTransformerMode.Restore,
        options: TRANSFORMER_OPTIONS,
        output: WORKSPACE.output,
        replaceWithValues: (val) => {
            return WORKSPACE.replaceWithValues(val);
        },
        require: (id) => {
            return deploy_helpers.requireFromExtension(id);
        },
        sessionState: deploy_helpers.SESSION,
        settingFolder: WORKSPACE.settingFolder,
        state: undefined,
        workspaceRoot: WORKSPACE.rootPath,
    };

    // CTX.state
    Object.defineProperty(CTX, 'state', {
        enumerable: true,

        get: () => {
            return WORKSPACE.workspaceSessionState['pull']['states']['data_transformers'][STATE_KEY];
        },

        set: (newValue) => {
            WORKSPACE.workspaceSessionState['pull']['states']['data_transformers'][STATE_KEY] = newValue;
        }
    });

    return CTX;
}

function createSelectFileAction(file: deploy_files.FileInfo,
                                target: deploy_targets.Target,
                                transformer: deploy_transformers.DataTransformer) {
    if (!file) {
        return;
    }

    return async () => {
        if (file.download) {
            const EXT = Path.extname(file.name);

            await deploy_helpers.invokeForTempFile(
                async (tempFile) => {
                    let downloadedData: any = await Promise.resolve(
                        file.download()
                    );

                    // keep sure to have a buffer here
                    downloadedData = await deploy_helpers.asBuffer(
                        downloadedData,
                    );

                    if (downloadedData) {
                        if (transformer) {
                            const CTX = createPullDataTransformerContext(
                                file,
                                target
                            );

                            downloadedData = await Promise.resolve(
                                transformer(downloadedData, CTX)
                            );    
                        }
                    }

                    await deploy_helpers.writeFile(
                        tempFile,
                        downloadedData,
                    );

                    const EDITOR = await vscode.workspace.openTextDocument(tempFile);

                    await vscode.window.showTextDocument(EDITOR);
                }, {
                    keep: true,
                    postfix: EXT,
                    prefix: Path.basename(file.name, EXT) + '-',
                }
            );
        }
    };
}

/**
 * List a directory of a target.
 * 
 * @param {deploy_targets.Target} target The target. 
 * @param {string} [dir] The path to the sub directory.
 */
export async function listDirectory(target: deploy_targets.Target, dir?: string) {
    const ME: deploy_workspaces.Workspace = this;

    target = ME.prepareTarget(target);

    if (ME.isInFinalizeState) {
        return;
    }

    let fromCache = false;

    const LAST_DIR_CACHE = ME.workspaceSessionState['list']['lastDirectories'];

    const TARGET_NAME = deploy_targets.getTargetName(target);
    const TARGET_CACHE_KEY = target.__index + '::' + deploy_targets.getTargetIdHash(target);

    const PULL_TRANSFORMER = await createPullDataTransformer(target);

    if (arguments.length < 2) {
        // try to get last directory
        // from cache

        const LAST_DIR = LAST_DIR_CACHE[TARGET_CACHE_KEY];
        if (!deploy_helpers.isEmptyString(LAST_DIR)) {
            fromCache = true;

            dir = LAST_DIR;
        }
    }

    dir = deploy_helpers.toStringSafe(dir);

    let wholeOperationHasFailed = false;
    try {
        const PLUGINS = ME.getListPlugins(target);
        if (PLUGINS.length < 1) {
            ME.showWarningMessage(
                ME.t('targets.noPluginsFound')
            );

            return;
        }

        let displayDir = dir;
        if (deploy_helpers.isEmptyString(displayDir)) {
            displayDir = '/';
        }

        let selfInfo: deploy_files.DirectoryInfo;
        const FILES_AND_FOLDERS = await deploy_helpers.withProgress(async (progress) => {
            const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();

            progress.cancellationToken.onCancellationRequested(() => {
                try {
                    CANCELLATION_SOURCE.cancel();
                }
                catch (e) {
                    ME.logger
                      .trace(e, 'list.listDirectory(3)');
                }
            });
            if (progress.cancellationToken.isCancellationRequested) {
                CANCELLATION_SOURCE.cancel();
            }

            try {
                const LOADED_FILES_AND_FILES: deploy_files.FileSystemInfo[] = [];

                let index = -1;
                const TOTAL_COUNT = PLUGINS.length;
                while (PLUGINS.length > 0) {
                    if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                        return false;
                    }

                    const PI = PLUGINS.shift();

                    progress.increment = 1 / TOTAL_COUNT * 100.0;
                    progress.message = ME.t('listDirectory.loading',
                                            displayDir);

                    const CTX: deploy_plugins.ListDirectoryContext = {
                        cancellationToken: CANCELLATION_SOURCE.token,
                        dir: dir,
                        isCancelling: undefined,
                        target: target,
                        workspace: ME,
                    };

                    // CTX.isCancelling
                    Object.defineProperty(CTX, 'isCancelling', {
                        enumerable: true,

                        get: function () {
                            return this.cancellationToken.isCancellationRequested;
                        }
                    });

                    const ITEMS = await PI.listDirectory(CTX);
                    if (ITEMS) {
                        selfInfo = ITEMS.info;

                        const LOADED_ITEMS: deploy_files.FileSystemInfo[] = deploy_helpers.asArray(
                            <any>ITEMS.dirs,
                        ).concat(
                            <any>deploy_helpers.asArray(
                                ITEMS.files
                            )
                        ).concat(
                            <any>deploy_helpers.asArray(
                                ITEMS.others
                            )
                        );

                        LOADED_FILES_AND_FILES.push
                                              .apply(LOADED_FILES_AND_FILES, LOADED_ITEMS);
                    }
                }

                return LOADED_FILES_AND_FILES;
            }
            finally {
                deploy_helpers.tryDispose(CANCELLATION_SOURCE);
            }
        }, {
            cancellable: true,
            location: vscode.ProgressLocation.Notification,
            title: `[${TARGET_NAME}]`,
        });

        if (false === FILES_AND_FOLDERS) {
            return;
        }

        const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = [];
        const FUNC_QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = [];

        const SHOW_QUICK_PICKS = async () => {
            let placeHolder = dir.trim();
            if (!placeHolder.startsWith('/')) {
                placeHolder = '/' + placeHolder;
            }

            let quickPicksToShow: deploy_contracts.ActionQuickPick[] = QUICK_PICK_ITEMS.map(qp => qp);
            if (FUNC_QUICK_PICK_ITEMS.length > 0) {
                // functions

                // separator
                quickPicksToShow.push({
                    action: () => {
                        SHOW_QUICK_PICKS();
                    },
    
                    label: '-',
                    description: '',
                });

                quickPicksToShow = quickPicksToShow.concat(
                    FUNC_QUICK_PICK_ITEMS
                );
            }

            const SELECTED_ITEM = await vscode.window.showQuickPick(
                quickPicksToShow,
                {
                    placeHolder: ME.t('listDirectory.currentDirectory',
                                      placeHolder, TARGET_NAME),
                }
            );
            if (SELECTED_ITEM) {
                if (SELECTED_ITEM.action) {
                    await Promise.resolve(
                        SELECTED_ITEM.action()
                    );
                }
            }
        };  // SHOW_QUICK_PICKS()

        const LIST_DIRECTORY = async (d: string) => {
            listDirectory.apply(
                ME,
                [ target, d ]
            );
        };  // LIST_DIRECTORY()

        const SELECT_TARGET_DIR_FOR_SYNC_FOLDERS = async (label: string) => {
            let relPathOfDir = dir;
            if (deploy_helpers.isEmptyString(relPathOfDir)) {
                relPathOfDir = './';
            }

            const LOCAL_DIR = Path.resolve(
                Path.join(ME.rootPath, relPathOfDir)
            );

            return await vscode.window.showInputBox({
                placeHolder: label,
                prompt: ME.t('listDirectory.pull.enterLocalFolder'),
                value: LOCAL_DIR,
            });
        };  // SELECT_TARGET_DIR_FOR_SYNC_FOLDERS()

        const EXECUTE_SYNC_FOLDERS_ACTION = async (opts: SyncFoldersActionOptions) => {
            const TARGET_DIR = await SELECT_TARGET_DIR_FOR_SYNC_FOLDERS(opts.label);
            if (deploy_helpers.isEmptyString(TARGET_DIR)) {
                return;
            }

            await deploy_helpers.withProgress(async (progress) => {
                await opts.action(
                    target,
                    dir, TARGET_DIR,
                    PULL_TRANSFORMER,
                    progress,
                    opts.recursive
                );
            }, {
                cancellable: true,
                location: vscode.ProgressLocation.Notification,
                title: opts.title,
            });
        };  // EXECUTE_SYNC_FOLDERS_ACTION()

        let numberOfDirs = 0;
        let numberOfFiles = 0;
        FILES_AND_FOLDERS.sort((x, y) => {
            // first by type:
            // 
            // 1. directories
            // 2. others
            const COMP0 = deploy_helpers.compareValuesBy(x, y, (f) => {
                return deploy_files.FileSystemType.Directory == f.type ? 0 : 1; 
            });
            if (0 !== COMP0) {
                return COMP0;
            }

            // custom comparer?
            if (x.type == y.type) {
                if (x.compareTo) {
                    const COMP1 = x.compareTo(y);
                    if (0 != COMP1) {
                        return COMP1;
                    }
                }
            }

            // then by name
            const COMP2 = deploy_helpers.compareValuesBy(x, y, (f) => {
                return deploy_helpers.normalizeString(f.name);
            });
            if (0 !== COMP2) {
                return COMP2;
            }

            // then by timestamp (DESC)
            return deploy_helpers.compareValuesBy(y, x, (f) => {
                const LT = deploy_helpers.asLocalTime(f.time);
                if (LT) {
                    return LT.unix();
                }
            });
        }).forEach(f => {
            let label = deploy_helpers.toStringSafe(f.name).trim();
            if ('' === label) {
                label = ME.t('listDirectory.noName');
            }

            const DETAIL_ITEMS: string[] = [];

            const GET_ICON_SAFE = (defaultIcon: string) => {
                let icon = deploy_helpers.toStringSafe(f.icon).trim();
                if ('' === icon) {
                    icon = defaultIcon;
                }

                return '$(' + icon + ')  ';
            };

            let action: () => any;
            if (deploy_files.FileSystemType.Directory == f.type) {
                // directory

                label = GET_ICON_SAFE('file-directory') + label;

                action = async () => {
                    let pathPart = f.internal_name;
                    if (deploy_helpers.isEmptyString(pathPart)) {
                        pathPart = f.name;
                    }

                    LIST_DIRECTORY(
                        dir + '/' + pathPart,
                    );
                };

                ++numberOfDirs;
            }
            else if (deploy_files.FileSystemType.File == f.type) {
                // file

                label = GET_ICON_SAFE('file-binary') + label;
                
                action = createSelectFileAction(
                    <deploy_files.FileInfo>f,
                    target,
                    PULL_TRANSFORMER,
                );

                ++numberOfFiles;
            }
            else {
                label = GET_ICON_SAFE('question') + label;
            }

            if (deploy_files.FileSystemType.Directory != f.type) {
                if (!isNaN(f.size)) {
                    DETAIL_ITEMS.push(
                        ME.t('listDirectory.size',
                             FileSize(f.size, {round: 2}))
                    );
                }
            }

            const LOCAL_TIME = deploy_helpers.asLocalTime(f.time);
            if (LOCAL_TIME && LOCAL_TIME.isValid()) {
                DETAIL_ITEMS.push(
                    ME.t('listDirectory.lastModified',
                         LOCAL_TIME.format( ME.t('time.dateTimeWithSeconds') ))
                );
            }

            QUICK_PICK_ITEMS.push({
                label: label,
                description: '',
                detail: DETAIL_ITEMS.join(', '),
                action: action,
            });
        });

        if (!deploy_helpers.isEmptyString(dir)) {
            let parentDir = Enumerable.from(
                dir.split('/')
            ).skipLast()
             .joinToString('/');

            QUICK_PICK_ITEMS.unshift({
                label: '..',
                description: '',
                detail: ME.t('listDirectory.parentDirectory'),

                action: async () => {
                    LIST_DIRECTORY(
                        parentDir
                    );
                }
            });
        }

        if (QUICK_PICK_ITEMS.length < 1) {
            QUICK_PICK_ITEMS.push({
                label: ME.t('listDirectory.directoryIsEmpty'),
                description: '',
            });
        }

        // functions
        {
            if (deploy_helpers.isObject(selfInfo)) {
                let exportPath = deploy_helpers.toStringSafe(selfInfo.exportPath);
                if (deploy_helpers.isEmptyString(exportPath)) {
                    exportPath = dir;
                }

                if (!deploy_helpers.isEmptyString(exportPath)) {
                    // copy path to clipboard
                    FUNC_QUICK_PICK_ITEMS.push({
                        action: async () => {
                            try {
                                await Promise.resolve(
                                    CopyPaste.copy(exportPath)
                                );
                            }
                            catch (e) {
                                deploy_log.CONSOLE
                                          .trace(e, 'list.listDirectory(1)');

                                ME.showWarningMessage(
                                    ME.t('listDirectory.copyPathToClipboard.errors.failed',
                                         exportPath)
                                );
                            }
                        },

                        label: '$(clippy)  ' + ME.t('listDirectory.copyPathToClipboard.label'),
                        description: ME.t('listDirectory.copyPathToClipboard.description'),
                    });
                }
            }

            if (numberOfDirs > 0 || numberOfFiles > 0) {
                // pull files
                {
                    // pull files
                    FUNC_QUICK_PICK_ITEMS.push({
                        action: async function() {
                            await EXECUTE_SYNC_FOLDERS_ACTION({
                                action: pullAllFilesFromDir,
                                label: ME.t('listDirectory.pull.folder.label'),
                                recursive: false,
                                title: ME.t('listDirectory.pull.folder.title'),
                            });
                        },

                        label: '$(cloud-download)  ' + ME.t('listDirectory.pull.folder.label'),
                        description: ME.t('listDirectory.pull.folder.description'),
                    });

                    // pull files with sub folders
                    FUNC_QUICK_PICK_ITEMS.push({
                        action: async function () {
                            await EXECUTE_SYNC_FOLDERS_ACTION({
                                action: pullAllFilesFromDir,
                                label: ME.t('listDirectory.pull.folderWithSubfolders.label'),
                                recursive: true,
                                title: ME.t('listDirectory.pull.folderWithSubfolders.title'),
                            });
                        },

                        label: '$(cloud-download)  ' + ME.t('listDirectory.pull.folderWithSubfolders.label'),
                        description: ME.t('listDirectory.pull.folderWithSubfolders.description'),
                    });
                }
            }

            if (deploy_helpers.isObject(selfInfo)) {
                let exportPath = deploy_helpers.toStringSafe(selfInfo.exportPath);
                if (deploy_helpers.isEmptyString(exportPath)) {
                    exportPath = dir;
                }

                if (!deploy_helpers.isEmptyString(exportPath)) {
                    // delete folder
                    FUNC_QUICK_PICK_ITEMS.push({
                        action: async function () {
                            const SELECTED_ITEM = await vscode.window.showWarningMessage<deploy_contracts.MessageItemWithValue>(
                                ME.t('listDirectory.removeFolder.askBeforeRemove',
                                     exportPath),
                                {
                                    isCloseAffordance: true,
                                    title: ME.t('no'),
                                    value: 0,
                                },
                                {                                
                                    title: ME.t('yes'),
                                    value: 1,
                                }
                            );

                            if (!SELECTED_ITEM || 1 !== SELECTED_ITEM.value) {
                                return;
                            }

                            await deploy_helpers.withProgress(async (progress) => {
                                await removeFolder(
                                    target, exportPath,
                                    progress,
                                );
                            }, {
                                cancellable: true,
                                location: vscode.ProgressLocation.Notification,
                                title: ME.t('listDirectory.removeFolder.removing',
                                            exportPath)
                            });
                        },

                        label: '$(trashcan)  ' + ME.t('listDirectory.removeFolder.label'),
                        description: ME.t('listDirectory.removeFolder.description'),
                    });
                }
            }
        }

        await SHOW_QUICK_PICKS();
    }
    catch (e) {
        wholeOperationHasFailed = true;

        if (fromCache) {
            // reset and retry

            delete LAST_DIR_CACHE[TARGET_CACHE_KEY];

            await listDirectory.apply(this, arguments);
        }
        else {
            ME.logger
              .trace(e, 'list.listDirectory(2)');

            ME.showErrorMessage(
                ME.t('listDirectory.errors.failed',
                     deploy_helpers.toDisplayablePath(dir), TARGET_NAME)
            );
        }
    }
    finally {
        if (!wholeOperationHasFailed) {
            // cache
            LAST_DIR_CACHE[TARGET_CACHE_KEY] = dir;
        }
    }
}

async function pullAllFilesFromDir(
    target: deploy_targets.Target,
    sourceDir: string, targetDir: string,
    transformer: deploy_transformers.DataTransformer,
    progress: deploy_helpers.ProgressContext,
    recursive: boolean,
    depth?: number, maxDepth?: number
)
{
    const TARGET_NAME = deploy_targets.getTargetName(target);
    const WORKSPACE = target.__workspace;

    sourceDir = deploy_helpers.toStringSafe(sourceDir);

    targetDir = deploy_helpers.toStringSafe(targetDir);
    if (!Path.isAbsolute(targetDir)) {
        targetDir = Path.join(WORKSPACE.rootPath, targetDir);
    }
    targetDir = Path.resolve(targetDir);

    recursive = deploy_helpers.toBooleanSafe(recursive);

    if (isNaN(maxDepth)) {
        maxDepth = 64;
    }

    if (isNaN(depth)) {
        depth = 0;
    }

    if (depth >= maxDepth) {
        throw new Error(WORKSPACE.t('listDirectory.pull.errors.maxPathDepthReached',
                                    maxDepth));
    }

    if (progress.cancellationToken.isCancellationRequested) {
        return;
    }

    WORKSPACE.output.appendLine('');
    WORKSPACE.output.appendLine(WORKSPACE.t('listDirectory.pull.pullingFrom',
                                            sourceDir, targetDir));

    try {
        if (!(await deploy_helpers.exists(targetDir))) {
            await deploy_helpers.mkdirs(targetDir);
        }

        const PLUGINS = WORKSPACE.getListPlugins(target);
        while (PLUGINS.length > 0) {
            if (progress.cancellationToken.isCancellationRequested) {
                return;
            }
            
            const P = PLUGINS.shift();

            const CTX: deploy_plugins.ListDirectoryContext = {
                cancellationToken: progress.cancellationToken,
                dir: sourceDir,
                isCancelling: undefined,
                target: target,
                workspace: WORKSPACE,
            };

            // CTX.isCancelling
            Object.defineProperty(CTX, 'isCancelling', {
                enumerable: true,

                get: () => {
                    return CTX.cancellationToken.isCancellationRequested;
                }
            });

            const FILES_AND_FOLDERS = await P.listDirectory(CTX);
            if (!FILES_AND_FOLDERS) {
                continue;
            }

            const FILES = deploy_helpers.asArray(FILES_AND_FOLDERS.files).filter(f => {
                return deploy_helpers.isFunc(f.download);
            });

            if (FILES.length > 0) {
                const POPUP_STATS: deploy_gui.ShowPopupWhenFinishedStats = {
                    failed: [],
                    operation: deploy_contracts.DeployOperation.Pull,
                    succeeded: [],
                };

                const FILES_TO_DOWNLOAD: deploy_plugins.FileToDownload[] = [];
                FILES.forEach(f => {
                    const NAME_AND_PATH: deploy_contracts.WithNameAndPath = {
                        path: deploy_helpers.normalizePath(sourceDir),
                        name: deploy_helpers.normalizePath(f.name),
                    };

                    const LOCAL_FILE = Path.resolve(
                        Path.join(targetDir, f.name)
                    );

                    const SF = new deploy_plugins.SimpleFileToDownload(
                        WORKSPACE,
                        LOCAL_FILE,
                        NAME_AND_PATH
                    );

                    const UPDATE_PROGRESS = (message: string) => {
                        progress.increment = 1 / FILES.length * 100.0;
                        progress.message = message;
                    };

                    SF.onBeforeDownload = async function(source?) {
                        const NOW = deploy_helpers.now();

                        if (arguments.length < 1) {
                            source = NAME_AND_PATH.path;
                        }
                        source = `${deploy_helpers.toStringSafe(source)} (${TARGET_NAME})`;

                        const PULL_TEXT = WORKSPACE.t('listDirectory.pull.pullingFile',
                                                      deploy_helpers.toDisplayablePath(
                                                          deploy_helpers.normalizePath(NAME_AND_PATH.path + '/' + NAME_AND_PATH.name)
                                                      ));

                        WORKSPACE.output.append(
                            `\t[${NOW.format( WORKSPACE.t('time.timeWithSeconds') )}] 🚚 ` +
                            PULL_TEXT + ' '
                        );

                        UPDATE_PROGRESS( `🚚 ` + PULL_TEXT );

                        if (progress.cancellationToken.isCancellationRequested) {
                            WORKSPACE.output.appendLine(`✖️`);
                        }
                    };

                    SF.onDownloadCompleted = async function(err, downloadedFile?) {
                        let disposeDownloadedFile = false;
                        try {
                            if (err) {
                                throw err;
                            }

                            let dataToWrite: any;

                            if (downloadedFile) {
                                if (Buffer.isBuffer(downloadedFile)) {
                                    dataToWrite = downloadedFile;
                                }
                                else if (IsStream(downloadedFile)) {
                                    dataToWrite = downloadedFile;
                                }
                                else if (deploy_helpers.isObject<deploy_plugins.DownloadedFile>(downloadedFile)) {
                                    disposeDownloadedFile = true;

                                    dataToWrite = await Promise.resolve(
                                        downloadedFile.read()
                                    );
                                }
                                else {
                                    dataToWrite = downloadedFile;
                                }

                                // keep sure we have a buffer here
                                dataToWrite = await deploy_helpers.asBuffer(
                                    dataToWrite
                                );

                                const CONTEXT = createPullDataTransformerContext(
                                    NAME_AND_PATH,
                                    target
                                );

                                if (transformer) {
                                    dataToWrite = await Promise.resolve(
                                        transformer(dataToWrite, CONTEXT)
                                    );
                                }
                            }

                            if (dataToWrite) {
                                await deploy_helpers.writeFile(
                                    LOCAL_FILE, dataToWrite
                                );
                            }

                            WORKSPACE.output
                                     .appendLine(`✅`);

                            POPUP_STATS.succeeded.push( LOCAL_FILE );
                        }
                        catch (e) {
                            WORKSPACE.output
                                     .append(`[🔥: '${ deploy_helpers.toStringSafe(e) }']`);

                            POPUP_STATS.failed.push( LOCAL_FILE );
                            
                            UPDATE_PROGRESS( WORKSPACE.t('error', e) );
                        }
                        finally {
                            if (disposeDownloadedFile) {
                                deploy_helpers.tryDispose(<vscode.Disposable>downloadedFile);
                            }

                            WORKSPACE.output
                                     .appendLine('');
                        }
                    };

                    FILES_TO_DOWNLOAD.push(SF);
                });
                
                const DL_CTX: deploy_plugins.DownloadContext = {
                    cancellationToken: progress.cancellationToken,
                    files: FILES_TO_DOWNLOAD,
                    isCancelling: undefined,
                    target: target,
                };

                // DL_CTX.isCancelling
                Object.defineProperty(DL_CTX, 'isCancelling', {
                    enumerable: true,

                    get: () => {
                        return DL_CTX.cancellationToken.isCancellationRequested;
                    }
                });

                await P.downloadFiles(DL_CTX);
            }

            WORKSPACE.output.appendLine(`[${WORKSPACE.t('done')}]`);

            if (recursive) {
                // sub folders

                for (const D of deploy_helpers.asArray(FILES_AND_FOLDERS.dirs)) {
                    const NEW_SOURCE_DIR = deploy_helpers.normalizePath(
                        deploy_helpers.normalizePath(sourceDir) + 
                        '/' + 
                        deploy_helpers.normalizePath(D.name)
                    );

                    const NEW_TARGET_DIR = Path.join(
                        targetDir, deploy_helpers.toStringSafe(D.name),
                    );

                    await pullAllFilesFromDir(
                        target,
                        NEW_SOURCE_DIR, NEW_TARGET_DIR,
                        transformer,
                        progress,
                        recursive,
                        depth + 1,
                    );
                }
            }
        }
    }
    catch (e) {
        WORKSPACE.output.appendLine(`[🔥: '${deploy_helpers.toStringSafe( e )}']`);
    }
    finally {
        if (progress.cancellationToken.isCancellationRequested) {
            WORKSPACE.output.appendLine(`✖️`);
        }
    }
}

async function removeFolder(
    target: deploy_targets.Target, dir: string,
    progress: deploy_helpers.ProgressContext,
) {
    const WORKSPACE = target.__workspace;

    const PROGRESS_MSG = WORKSPACE.t('listDirectory.removeFolder.removing',
                                     dir);

    WORKSPACE.output.appendLine('');
    WORKSPACE.output.append(PROGRESS_MSG + ' ');

    try {
        const PLUGINS = WORKSPACE.getRemoveFolderPlugins(target);

        const UPDATE_PROGRESS = (index: number, message: string) => {
            progress.increment = 1 / PLUGINS.length * 100.0;
            progress.message = message;
        };

        for (let i = 0; i < PLUGINS.length; i++) {
            if (progress.cancellationToken.isCancellationRequested) {
                break;
            }

            const P = PLUGINS[i];
    
            UPDATE_PROGRESS(i, PROGRESS_MSG);

            const CTX: deploy_plugins.RemoveFoldersContext = {
                cancellationToken: progress.cancellationToken,
                folders: [
                    new deploy_plugins.SimpleFolderToRemove(
                        WORKSPACE,
                        undefined,
                        {
                            name: deploy_helpers.normalizePath(
                                Path.basename(dir)
                            ),
                            path: deploy_helpers.normalizePath(
                                Path.dirname(dir)
                            ),
                        }
                    )
                ],
                isCancelling: undefined,
                target: target,
            };

            // CTX.isCancelling
            Object.defineProperty(CTX, 'isCancelling', {
                enumerable: true,

                get: function () {
                    return this.cancellationToken.isCancellationRequested;
                }
            });

            await P.removeFolders(CTX);
        }    

        WORKSPACE.output.appendLine(`✅`);
    }
    catch (e) {
        if (progress.cancellationToken.isCancellationRequested) {
            WORKSPACE.output.appendLine(`✖️`);
        }
        else {
            WORKSPACE.output.appendLine(`🔥: '${ deploy_helpers.toStringSafe(e) }'`);   
        }        
    }
}
