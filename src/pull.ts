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

import * as _ from 'lodash';
import * as deploy_contracts from './contracts';
import * as deploy_files from './files';
import * as deploy_gui from './gui';
import * as deploy_helpers from './helpers';
import * as deploy_html from './html';
import * as deploy_log from './log';
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_targets from './targets';
import * as deploy_transformers from './transformers';
import * as deploy_workspaces from './workspaces';
import * as FS from 'fs';
import * as HtmlEntities from 'html-entities';
import * as i18 from './i18';
import * as IsStream from 'is-stream';
import * as Path from 'path';
import * as vscode from 'vscode';


async function checkBeforePull(
    target: deploy_targets.Target,
    plugin: deploy_plugins.Plugin,
    files: string[],
    mappingScopeDirs: string[],
    cancelToken: vscode.CancellationToken,
): Promise<boolean> {
    const TARGET_NAME = deploy_targets.getTargetName(target);
    const WORKSPACE = target.__workspace;

    if (!deploy_helpers.toBooleanSafe(target.checkBeforePull)) {
        return true;
    }

    if (!deploy_plugins.canList(plugin, target)) {
        let selectedValue: number;

        const SELECTED_ITEM = await WORKSPACE.showWarningMessage(
            WORKSPACE.t('pull.checkBeforePull.notSupported', TARGET_NAME),
            {
                isCloseAffordance: true,
                title: WORKSPACE.t('no'),
                value: 0,
            },
            {
                title: WORKSPACE.t('yes'),
                value: 1,
            }
        );
        if (SELECTED_ITEM) {
            selectedValue = SELECTED_ITEM.value;
        }

        if (1 !== selectedValue) {
            return false;
        }
    }

    WORKSPACE.output
             .append( WORKSPACE.t('pull.checkBeforePull.beginOperation', TARGET_NAME) + ' ');
    try {
        const LIST_RESULTS: deploy_contracts.KeyValuePairs<deploy_plugins.ListDirectoryResult> = {};

        const FILES_AND_PATHS: deploy_contracts.KeyValuePairs<deploy_contracts.WithNameAndPath> = {};
        for (const F of files) {
            const NAME_AND_PATH = deploy_targets.getNameAndPathForFileDeployment(target, F,
                                                                                 mappingScopeDirs);
            if (false !== NAME_AND_PATH) {
                FILES_AND_PATHS[F] = NAME_AND_PATH;
            }
        }

        for (const F in FILES_AND_PATHS) {            
            if (cancelToken.isCancellationRequested) {
                return false;
            }

            try {
                const NAME_AND_PATH = FILES_AND_PATHS[F];

                const KEY = NAME_AND_PATH.path;
                if (!_.isNil( LIST_RESULTS[KEY] )) {
                    continue;
                }

                const CTX: deploy_plugins.ListDirectoryContext = {
                    cancellationToken: cancelToken,
                    dir: NAME_AND_PATH.path,
                    isCancelling: undefined,
                    target: target,
                    workspace: WORKSPACE,
                };

                // CTX.isCancelling
                Object.defineProperty(CTX, 'isCancelling', {
                    get: () => cancelToken.isCancellationRequested,
                });

                const LIST = await plugin.listDirectory(CTX);
                if (LIST) {
                    LIST_RESULTS[KEY] = LIST;
                }
            }
            catch (e) {
                WORKSPACE.logger
                         .trace(e, 'pull.checkBeforePull(1)');
            }
        }

        const OLDER_FILES: deploy_contracts.KeyValuePairs<deploy_files.FileInfo[]> = {};
        for (const PATH in LIST_RESULTS) {
            const LIST = LIST_RESULTS[PATH];

            for (const F in FILES_AND_PATHS) {
                const NAME_AND_PATH = FILES_AND_PATHS[F];
                if (PATH !== NAME_AND_PATH.path) {
                    continue;
                }

                const FILE_NAME = Path.basename(F);
                const FILE_STATS = await deploy_helpers.lstat(F);

                for (const RF of deploy_helpers.asArray(LIST.files)) {
                    if (RF.name !== FILE_NAME) {
                        continue;
                    }

                    const REMOTE_MTIME = deploy_helpers.asUTC(RF.time);
                    if (REMOTE_MTIME) {
                        const LOCAL_TIME = deploy_helpers.asUTC(FILE_STATS.mtime);
                        if (LOCAL_TIME) {
                            if (REMOTE_MTIME.isBefore(LOCAL_TIME)) {
                                if (_.isNil(OLDER_FILES[F])) {
                                    OLDER_FILES[F] = [];
                                }

                                OLDER_FILES[F].push(RF);
                            }
                        }
                    }
                }
            }
        }

        WORKSPACE.output
                 .appendLine( `[${ WORKSPACE.t('done') }]` );

        const NEWER_FILES = Object.keys(OLDER_FILES).sort((x, y) => {
            return deploy_helpers.compareValuesBy(x, y,
                                                  i => deploy_helpers.normalizeString(i));
        });
        if (NEWER_FILES.length > 0) {
            let selectedValue: number;

            const SELECTED_ITEM = await WORKSPACE.showWarningMessage(
                WORKSPACE.t('pull.checkBeforePull.olderFilesFound', NEWER_FILES.length),
                {
                    isCloseAffordance: true,
                    title: WORKSPACE.t('no'),
                    value: 0,
                },
                {
                    title: WORKSPACE.t('yes'),
                    value: 1,
                }
            );
            if (SELECTED_ITEM) {
                selectedValue = SELECTED_ITEM.value;
            }

            switch (selectedValue) {
                case 0:
                    {
                        const HTML_ENCODER = new HtmlEntities.AllHtmlEntities();

                        const TITLE = WORKSPACE.t('pull.checkBeforePull.report.title', TARGET_NAME);

                        const TABLE_HEADER_LOCAL_FILE = HTML_ENCODER.encode(
                            WORKSPACE.t('pull.checkBeforePull.report.localFile')
                        );
                        const TABLE_HEADER_REMOTE_FILE = HTML_ENCODER.encode(
                            WORKSPACE.t('pull.checkBeforePull.report.remoteFile')
                        );
                        const TABLE_HEADER_LAST_CHANGE = HTML_ENCODER.encode(
                            WORKSPACE.t('pull.checkBeforePull.report.lastChange')
                        );
                        const TABLE_HEADER_SIZE = HTML_ENCODER.encode(
                            WORKSPACE.t('pull.checkBeforePull.report.size')
                        );

                        let md = `# ${HTML_ENCODER.encode(TITLE)}\n`;
                        
                        md += `\n`;
                        md += `${TABLE_HEADER_LOCAL_FILE} | ${TABLE_HEADER_LAST_CHANGE} | ${TABLE_HEADER_SIZE} | ${TABLE_HEADER_REMOTE_FILE} | ${TABLE_HEADER_LAST_CHANGE} | ${TABLE_HEADER_SIZE}\n`;
                        md += `------------|:-------------:|:-------------:|-------------|:-------------:|:-------------:\n`;

                        for (const F of NEWER_FILES) {
                            const OLD_FILE_LIST = OLDER_FILES[F];

                            const STATS = await deploy_helpers.lstat(F);
                            const LOCAL_MTIME = deploy_helpers.asLocalTime(STATS.mtime);
                            const LOCAL_SIZE = deploy_helpers.toStringSafe(STATS.size);

                            for (const RF of OLD_FILE_LIST) {
                                const REMOTE_MTIME = deploy_helpers.asLocalTime(RF.time);
                                const REMOTE_SIZE = deploy_helpers.toStringSafe(RF.size);

                                const TABLE_CELL_LOCAL_FILE = HTML_ENCODER.encode(F);
                                const TABLE_CELL_LOCAL_FILE_MTIME = HTML_ENCODER.encode(
                                    LOCAL_MTIME.format( WORKSPACE.t('time.dateTimeWithSeconds') )
                                );
                                const TABLE_CELL_LOCAL_FILE_SIZE = HTML_ENCODER.encode(LOCAL_SIZE);
                                
                                const TABLE_CELL_REMOTE_FILE = HTML_ENCODER.encode(
                                    '/' + 
                                    deploy_helpers.normalizePath(
                                        '/' +
                                        deploy_helpers.normalizePath(RF.path) + 
                                        '/' +
                                        deploy_helpers.normalizePath(RF.name)
                                    )
                                );
                                const TABLE_CELL_REMOTE_FILE_MTIME = HTML_ENCODER.encode(
                                    REMOTE_MTIME.format( WORKSPACE.t('time.dateTimeWithSeconds') )
                                );
                                const TABLE_CELL_REMOTE_FILE_SIZE = HTML_ENCODER.encode(REMOTE_SIZE);

                                md += `${TABLE_CELL_LOCAL_FILE} | ${TABLE_CELL_LOCAL_FILE_MTIME} | ${TABLE_CELL_LOCAL_FILE_SIZE} | ${TABLE_CELL_REMOTE_FILE} | ${TABLE_CELL_REMOTE_FILE_MTIME} | ${TABLE_CELL_REMOTE_FILE_SIZE}\n`;
                            }
                        }

                        await deploy_html.openMarkdownDocument(md, {
                            documentTitle: TITLE,
                        });
                    }
                    return false;

                case 1:
                    break;  // start deployment

                default:
                    return false;
            }
        }

        return !cancelToken.isCancellationRequested;
    }
    catch (e) {
        WORKSPACE.output
                 .appendLine( `[${ WORKSPACE.t('error', e) }]` );

        return false;
    }
}

/**
 * Pulls all opened files.
 * 
 * @param {deploy_workspaces.Workspace|deploy_workspaces.Workspace[]} workspaces The available workspaces.
 */
export async function pullAllOpenFiles(workspaces: deploy_workspaces.Workspace | deploy_workspaces.Workspace[]) {
    workspaces = deploy_helpers.asArray(workspaces);
    if (workspaces.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('workspaces.noneFound')
        );

        return;
    }

    const DOCUMENTS = deploy_helpers.asArray(vscode.workspace.textDocuments).filter(d => {
        return !d.isClosed &&
               !d.isUntitled;
    });
    if (DOCUMENTS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('editors.noOpen')
        );

        return;
    }

    const CREATE_FILE_LIST_RELOADER = (ws: deploy_workspaces.Workspace): () => string[] => {
        return () => {
            return DOCUMENTS.map(doc => {
                if (!deploy_helpers.isEmptyString(doc.fileName)) {
                    if (ws.isPathOf(doc.fileName)) {
                        return doc;
                    }
                }
    
                return false;
            }).filter(e => {
                return false !== e;
            }).map((doc: vscode.TextDocument) => {
                return Path.resolve(doc.fileName);
            }).filter(f => {
                return FS.existsSync(f) &&
                       FS.lstatSync(f).isFile();
            });
        };
    };

    for (const WS of workspaces) {
        const RELOADER = CREATE_FILE_LIST_RELOADER(WS);

        const FILES = RELOADER();
        if (FILES.length < 1) {
            continue;
        }

        const TARGET = await deploy_targets.showTargetQuickPick(
            WS.context.extension,
            WS.getDownloadTargets(),
            {
                placeHolder: WS.t('workspaces.selectSource',
                                  WS.name),
            },
        );
        if (!TARGET) {
            continue;
        }

        const TARGET_NAME = deploy_targets.getTargetName(TARGET);

        try {
            await deploy_helpers.applyFuncFor(
                pullFilesFrom,
                WS
            )(FILES, TARGET,
              RELOADER);
        }
        catch (e) {
            WS.showErrorMessage(
                WS.t('pull.errors.operationForSourceFailed',
                     TARGET_NAME, e),
            );
        }
    }
}

/**
 * Pulls a file from a target.
 * 
 * @param {string} file The file to pull.
 * @param {deploy_targets.Target} target The target from where to pull from.
 */
export async function pullFileFrom(file: string, target: deploy_targets.Target) {
    const ME: deploy_workspaces.Workspace = this;

    if (ME.isInFinalizeState) {
        return;
    }

    if (!target) {
        return;
    }

    if (!ME.canBeHandledByMe(target)) {
        throw new Error(ME.t('pull.errors.invalidWorkspace',
                             file, ME.name));
    }

    await deploy_helpers.applyFuncFor(
        pullFilesFrom,
        ME
    )([ file ], target,
      null);
}

/**
 * Pulls a files from a file list of the active text editor.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export async function pullFileList(context: vscode.ExtensionContext) {
    const WORKSPACE = await deploy_workspaces.showWorkspaceQuickPick(
        context,
        deploy_workspaces.getAllWorkspaces(),
        {
            placeHolder: i18.t('workspaces.selectWorkspace'),
        }
    );
    if (!WORKSPACE) {
        return;
    }

    await WORKSPACE.startDeploymentOfFilesFromActiveDocument(
        async (target, files) => {
            await deploy_helpers.applyFuncFor(
                pullFilesFrom,
                target.__workspace,
            )(files, target,
              () => files);
        }
    );
}

/**
 * Pulls files from a target.
 * 
 * @param {string[]} files The files to pull.
 * @param {deploy_targets.Target} target The target from where to pull from.
 * @param {deploy_contracts.Reloader<string>} fileListReloader A function that reloads the list of files.
 */
export async function pullFilesFrom(files: string[],
                                    target: deploy_targets.Target,
                                    fileListReloader: deploy_contracts.Reloader<string>) {
    const ME: deploy_workspaces.Workspace = this;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        cancellable: true,
        title: ME.t('pull.pullingFiles'),
    }, async (progress, cancelToken) => {
        await deploy_helpers.applyFuncFor(
            pullFilesFromWithProgress,
            ME,
        )(progress, cancelToken,
          files,
          target,
          fileListReloader);
    });
}

async function pullFilesFromWithProgress(progress: vscode.Progress<deploy_contracts.VSCodeProgress>, progressCancelToken: vscode.CancellationToken,
                                         files: string[],
                                         target: deploy_targets.Target,
                                         fileListReloader: deploy_contracts.Reloader<string>) {
    const ME: deploy_workspaces.Workspace = this;

    target = ME.prepareTarget(target);

    if (ME.isInFinalizeState) {
        return;
    }
    
    if (!files) {
        return;
    }

    const NORMALIZE_FILE_LIST = () => {
        files = files.filter(f => !ME.isFileIgnored(f));
    };

    if (!fileListReloader) {
        const INITIAL_LIST = files.map(f => f);

        fileListReloader = () => INITIAL_LIST;
    }

    NORMALIZE_FILE_LIST();

    // preparements
    let reloadFileList = false;
    const PREPARE_CANCELLED = !deploy_helpers.toBooleanSafe(
        await deploy_targets.executePrepareTargetOperations({
            files: files,
            deployOperation: deploy_contracts.DeployOperation.Pull,
            onReloadFileList: () => {
                reloadFileList = true;
            },
            target: target,
        }),
        true
    );
    if (PREPARE_CANCELLED) {
        return;
    }

    if (reloadFileList) {
        files = deploy_helpers.asArray(
            await Promise.resolve(
                fileListReloader()
            )
        );

        NORMALIZE_FILE_LIST();
    }

    if (files.length < 1) {
        return;
    }

    if (!target) {
        return;
    }

    const TARGET_NAME = deploy_targets.getTargetName(target);
    const STATE_KEY = deploy_helpers.toStringSafe(target.__id);

    const PLUGINS = ME.getDownloadPlugins(target);
    if (PLUGINS.length < 1) {
        ME.showWarningMessage(
            ME.t('targets.noPluginsFound')
        );

        return;
    }

    let transformer = await ME.loadDataTransformer(target);
    if (false === transformer) {
        throw new Error(ME.t('targets.errors.couldNotLoadDataTransformer',
                             TARGET_NAME));
    }

    transformer = deploy_transformers.toDataTransformerSafe(
        deploy_transformers.toPasswordTransformer(transformer, target)
    );

    const TRANSFORMER_OPTIONS = deploy_helpers.cloneObject(target.transformerOptions);

    const MAPPING_SCOPE_DIRS = await deploy_targets.getScopeDirectoriesForTargetFolderMappings(target);

    const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();

    progressCancelToken.onCancellationRequested(() => {
        try {
            CANCELLATION_SOURCE.cancel();
        }
        catch (e) {
            ME.logger
              .trace(e, 'pull.pullFilesFromWithProgress().progressCancelToken.onCancellationRequested()');
        }
    });
    if (progressCancelToken.isCancellationRequested) {
        CANCELLATION_SOURCE.cancel();
    }

    const TARGET_SESSION = await deploy_targets.waitForOtherTargets(target);
    try {
        while (PLUGINS.length > 0) {
            if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                break;
            }    

            const PI = PLUGINS.shift();

            const POPUP_STATS: deploy_gui.ShowPopupWhenFinishedStats = {
                failed: [],
                operation: deploy_contracts.DeployOperation.Pull,
                succeeded: [],
            };
            try {
                if (!(await checkBeforePull(target, PI, files, MAPPING_SCOPE_DIRS, CANCELLATION_SOURCE.token))) {
                    continue;
                }

                progress.report({ /* increment: 0, */ percentage: 0 });
                
                ME.output.appendLine('');
                
                const UPDATE_PROGRESS = (message: string) => {
                    const PERCENTAGE = Math.floor(
                        (POPUP_STATS.succeeded.length + POPUP_STATS.failed.length) / files.length * 100.0
                    );

                    progress.report({
                        // increment: PERCENTAGE,
                        message: message,
                        percentage: PERCENTAGE,
                    });
                };

                if (files.length > 1) {
                    ME.output.appendLine(
                        ME.t('pull.startOperation',
                             TARGET_NAME)
                    );
                }

                const FILES_TO_PULL = files.map(f => {
                    const NAME_AND_PATH = deploy_targets.getNameAndPathForFileDeployment(target, f,
                                                                                         MAPPING_SCOPE_DIRS);
                    if (false === NAME_AND_PATH) {
                        return null;
                    }

                    const SF = new deploy_plugins.SimpleFileToDownload(ME, f, NAME_AND_PATH);
                    SF.onBeforeDownload = async function(source?) {
                        if (arguments.length < 1) {
                            source = NAME_AND_PATH.path;
                        }
                        source = `${deploy_helpers.toStringSafe(source)} (${TARGET_NAME})`;

                        ME.output.append(
                            ME.t('pull.pullingFile',
                                 f, source) + ' '
                        );

                        UPDATE_PROGRESS(
                            ME.t('pull.pullingFile',
                                 f, source)
                        );

                        if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                            ME.output.appendLine(`[${ME.t('canceled')}]`);
                        }
                    };
                    SF.onDownloadCompleted = async (err?, downloadedFile?) => {
                        let disposeDownloadedFile = false;
                        try {
                            if (err) {
                                throw err;
                            }
                            else {
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

                                    const CONTEXT: deploy_transformers.DataTransformerContext = {
                                        _: require('lodash'),
                                        context: {
                                            deployOperation: deploy_contracts.DeployOperation.Pull,
                                            file: f,
                                            remoteFile: deploy_helpers.normalizePath(
                                                NAME_AND_PATH.path + '/' + NAME_AND_PATH.name,
                                            ),
                                            target: target,
                                        },
                                        events: ME.workspaceSessionState['pull']['events'],
                                        extension: ME.context.extension,
                                        folder: ME.folder,
                                        globalEvents: deploy_helpers.EVENTS,
                                        globals: ME.globals,
                                        globalState: ME.workspaceSessionState['pull']['states']['global'],
                                        homeDir: deploy_helpers.getExtensionDirInHome(),
                                        logger: ME.createLogger(),
                                        mode: deploy_transformers.DataTransformerMode.Restore,
                                        options: TRANSFORMER_OPTIONS,
                                        output: ME.output,
                                        replaceWithValues: (val) => {
                                            return ME.replaceWithValues(val);
                                        },
                                        require: (id) => {
                                            return deploy_helpers.requireFromExtension(id);
                                        },
                                        sessionState: deploy_helpers.SESSION,
                                        settingFolder: ME.settingFolder,
                                        state: undefined,
                                        workspaceRoot: ME.rootPath,
                                    };

                                    // CONTEXT.state
                                    Object.defineProperty(CONTEXT, 'state', {
                                        enumerable: true,

                                        get: () => {
                                            return ME.workspaceSessionState['pull']['states']['data_transformers'][STATE_KEY];
                                        },

                                        set: (newValue) => {
                                            ME.workspaceSessionState['pull']['states']['data_transformers'][STATE_KEY] = newValue;
                                        }
                                    });

                                    dataToWrite = await (<deploy_transformers.DataTransformer>transformer)(
                                        dataToWrite, CONTEXT
                                    );
                                }

                                if (dataToWrite) {
                                    await deploy_helpers.writeFile(
                                        f, dataToWrite
                                    );
                                }

                                ME.output.appendLine(`[${ME.t('ok')}]`);
                                
                                POPUP_STATS.succeeded.push( f );
                            }
                        }
                        catch (e) {
                            ME.output.appendLine(`[${ME.t('error', e)}]`);

                            POPUP_STATS.failed.push( f );
                            
                            UPDATE_PROGRESS( ME.t('error', e) );
                        }
                        finally {
                            if (disposeDownloadedFile) {
                                deploy_helpers.tryDispose(<vscode.Disposable>downloadedFile);
                            }
                        }
                    };

                    return SF;
                }).filter(f => !_.isNil(f));

                const CTX: deploy_plugins.DownloadContext = {
                    cancellationToken: CANCELLATION_SOURCE.token,
                    files: FILES_TO_PULL,
                    isCancelling: undefined,
                    target: target,
                };

                // CTX.isCancelling
                Object.defineProperty(CTX, 'isCancelling', {
                    enumerable: true,

                    get: () => {
                        return CTX.cancellationToken.isCancellationRequested;
                    }
                });

                const SHOW_CANCELED_BY_OPERATIONS_MESSAGE = () => {
                    ME.output.appendLine(
                        ME.t('pull.canceledByOperation',
                             TARGET_NAME)
                    );
                };

                let operationIndex: number;

                const GET_OPERATION_NAME = (operation: deploy_targets.TargetOperation) => {
                    let operationName = deploy_helpers.toStringSafe(operation.name).trim();
                    if ('' === operationName) {
                        operationName = deploy_helpers.normalizeString(operation.type);
                        if ('' === operationName) {
                            operationName = deploy_targets.DEFAULT_OPERATION_TYPE;
                        }

                        operationName += ' #' + (operationIndex + 1);
                    }

                    return operationName;
                };

                // beforePull
                operationIndex = -1;
                ME.output.appendLine('');
                const BEFORE_PULL_ABORTED = !deploy_helpers.toBooleanSafe(
                    await deploy_targets.executeTargetOperations({
                        files: FILES_TO_PULL.map(ftu => {
                            return ftu.path + '/' + ftu.name;
                        }),
                        onBeforeExecute: async (operation) => {
                            ++operationIndex;

                            ME.output.append(
                                ME.t('targets.operations.runningBeforePull',
                                     GET_OPERATION_NAME(operation))
                            );
                        },
                        onExecutionCompleted: async (operation, err, doesContinue) => {
                            if (err) {
                                ME.output.appendLine(`[${ME.t('error', err)}]`);
                            }
                            else {
                                ME.output.appendLine(`[${ME.t('ok')}]`);
                            }
                        },
                        operation: deploy_targets.TargetOperationEvent.BeforePull,
                        target: target,
                    })
                , true);
                if (BEFORE_PULL_ABORTED) {
                    SHOW_CANCELED_BY_OPERATIONS_MESSAGE();
                    continue;
                }

                await Promise.resolve(
                    PI.downloadFiles(CTX)
                );

                // pulled
                operationIndex = -1;
                const AFTER_PULLED_ABORTED = !deploy_helpers.toBooleanSafe(
                    await deploy_targets.executeTargetOperations({
                        files: FILES_TO_PULL.map(ftu => {
                            return ftu.path + '/' + ftu.name;
                        }),
                        onBeforeExecute: async (operation) => {
                            ++operationIndex;

                            ME.output.append(
                                ME.t('targets.operations.runningAfterPulled',
                                     GET_OPERATION_NAME(operation))
                            );
                        },
                        onExecutionCompleted: async (operation, err, doesContinue) => {
                            if (err) {
                                ME.output.appendLine(`[${ME.t('error', err)}]`);
                            }
                            else {
                                ME.output.appendLine(`[${ME.t('ok')}]`);
                            }
                        },
                        operation: deploy_targets.TargetOperationEvent.AfterPulled,
                        target: target,
                    })
                , true);
                if (AFTER_PULLED_ABORTED) {
                    SHOW_CANCELED_BY_OPERATIONS_MESSAGE();
                    continue;
                }

                if (files.length > 1) {
                    ME.output.appendLine(
                        ME.t('pull.finishedOperation',
                             TARGET_NAME)
                    );
                }
            }
            catch (e) {
                ME.output.appendLine(
                    ME.t('pull.finishedOperationWithErrors',
                         TARGET_NAME, e)
                );

                POPUP_STATS.failed = files;
                POPUP_STATS.succeeded = [];
            }
            finally {
                deploy_helpers.applyFuncFor(
                    deploy_gui.showPopupWhenFinished,
                    ME
                )( POPUP_STATS );
            }
        }
    }
    finally {
        deploy_helpers.tryDispose(CANCELLATION_SOURCE);

        deploy_targets.unmarkTargetAsInProgress(
            target, TARGET_SESSION
        );
    }
}

/**
 * Pulls a package.
 * 
 * @param {deploy_packages.Package} pkg The package to pull.
 * @param {deploy_targets.TargetResolver} targetResolver A function to receive optional targets.
 */
export async function pullPackage(pkg: deploy_packages.Package, targetResolver: deploy_targets.TargetResolver) {
    const ME: deploy_workspaces.Workspace = this;

    if (ME.isInFinalizeState) {
        return;
    }

    if (!pkg) {
        return;
    }

    if (!ME.canBeHandledByMe(pkg)) {
        throw new Error(ME.t('pull.errors.invalidWorkspaceForPackage',
                             deploy_packages.getPackageName(pkg), ME.name));
    }

    const RELOADER = async () => {
        const FILES_FROM_FILTER = await ME.findFilesByFilter(
            deploy_packages.preparePackageForFileFilter(pkg)
        );
        
        await deploy_packages.importPackageFilesFromGit(
            pkg,
            deploy_contracts.DeployOperation.Pull,
            FILES_FROM_FILTER,
        );

        return FILES_FROM_FILTER;
    };

    const FILES_TO_PULL = await RELOADER();
    if (FILES_TO_PULL.length < 1) {
        ME.showWarningMessage(
            ME.t('noFiles')
        );

        return;
    }

    const TARGETS = deploy_helpers.applyFuncFor(deploy_packages.getTargetsOfPackage, ME)(
        pkg, targetResolver
    );
    if (false === TARGETS) {
        return;
    }

    const SELECTED_TARGET = await deploy_targets.showTargetQuickPick(
        ME.context.extension,
        TARGETS.filter(t => deploy_targets.isVisibleForPackage(t, pkg)),
        {
            placeHolder: ME.t('pull.selectSource'),
        }
    );
    if (!SELECTED_TARGET) {
        return;
    }

    await deploy_helpers.applyFuncFor(
        pullFilesFrom, ME
    )(FILES_TO_PULL,
      SELECTED_TARGET,
      RELOADER);
}

/**
 * Registers commands for pull operations.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function registerPullCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        // pull
        vscode.commands.registerCommand('extension.deploy.reloaded.pull', async () => {
            try {
                const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
                    {
                        action: async () => {
                            await vscode.commands.executeCommand('extension.deploy.reloaded.pullFile');
                        },
                        label: '$(cloud-download)  ' + i18.t('pull.currentFile.label'),
                        description: i18.t('pull.currentFile.description'),
                    },

                    {
                        action: async () => {
                            await vscode.commands.executeCommand('extension.deploy.reloaded.pullWorkspace');
                        },
                        label: '$(cloud-download)  ' + i18.t('pull.package.label'),
                        description: i18.t('pull.package.description'),
                    },

                    {
                        action: async () => {
                            await vscode.commands.executeCommand('extension.deploy.reloaded.pullAllOpenFiles');
                        },
                        label: '$(cloud-download)  ' + i18.t('pull.allOpenFiles.label'),
                        description: i18.t('pull.allOpenFiles.description'),
                    },
                    
                    {
                        action: async () => {
                            await vscode.commands.executeCommand('extension.deploy.reloaded.pullFileList');
                        },
                        label: '$(list-ordered)  ' + i18.t('pull.fileList.label'),
                        description: i18.t('pull.fileList.description'),
                    }
                ];

                const SELECTED_ITEM = await vscode.window.showQuickPick(QUICK_PICKS);
                if (SELECTED_ITEM) {
                    await Promise.resolve(
                        SELECTED_ITEM.action()
                    );
                }
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.pull');

                deploy_helpers.showErrorMessage(
                    i18.t('pull.errors.operationFailed')
                );
            }
        }),

        // pull file list
        vscode.commands.registerCommand('extension.deploy.reloaded.pullFileList', async () => {
            try {
                await pullFileList(context);
            }
            catch (e) {
                deploy_log.CONSOLE
                            .trace(e, 'extension.deploy.reloaded.pullFileList');
                
                deploy_helpers.showErrorMessage(
                    i18.t('pull.errors.operationFailed')
                );
            }
        }),   
        
        // pull workspace
        vscode.commands.registerCommand('extension.deploy.reloaded.pullWorkspace', async () => {
            try {
                const PKG = await deploy_packages.showPackageQuickPick(
                    context,
                    deploy_packages.getAllPackagesSorted(),
                    {
                        placeHolder: i18.t('packages.selectPackage'),
                    }
                );

                if (PKG) {
                    await PKG.__workspace
                             .pullPackage(PKG);
                }
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.pullWorkspace');

                deploy_helpers.showErrorMessage(
                    i18.t('pull.errors.operationFailed')
                );
            }
        }),

        // pull current file
        vscode.commands.registerCommand('extension.deploy.reloaded.pullFile', async () => {
            try {
                await deploy_targets.invokeForActiveEditorAndTarget(
                    i18.t('pull.selectSource'),
                    async (file, target) => {
                        await target.__workspace
                                    .pullFileFrom(file, target);
                    }
                );
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.pullFile');

                deploy_helpers.showErrorMessage(
                    i18.t('pull.errors.operationFailed')
                );
            }
        }),

        // pull all open files
        vscode.commands.registerCommand('extension.deploy.reloaded.pullAllOpenFiles', async () => {
            try {
                await pullAllOpenFiles(
                    deploy_workspaces.getActiveWorkspaces()
                );
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.pullAllOpenFiles');

                deploy_helpers.showErrorMessage(
                    i18.t('pull.errors.operationFailed')
                );
            }
        }),
    );
}
