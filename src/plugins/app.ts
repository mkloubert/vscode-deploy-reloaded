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

import * as ChildProcess from 'child_process';
import * as deploy_contracts from '../contracts';
import * as deploy_events from '../events';
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_log from '../log';
import * as deploy_plugins from '../plugins';
import * as deploy_session from '../session';
import * as deploy_targets from '../targets';
import * as deploy_values from '../values';
import * as deploy_workspace from '../workspaces';
import * as Enumerable from 'node-enumerable';
import * as Events from 'events';
import * as Moment from 'moment';
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * Execution arguments for a script that provides arguments for the execution of an app.
 */
export interface AppArgumentsScriptExecutionArguments extends AppScriptArguments {
}

/**
 * A method / function that provides the arguments for the execution of an app.
 * 
 * @param {AppArgumentsScriptExecutionArguments} args The script arguments.
 * 
 * @return {any[]|PromiseLike<any[]>} The result with the arguments to submit.
 */
export type AppArgumentsScriptModuleExecutor = (args: AppArgumentsScriptExecutionArguments) => any[] | PromiseLike<any[]>;

/**
 * A module of a script that provides arguments for the execution of an app.
 */
export interface AppArgumentsScriptModule {
    readonly getArguments: AppArgumentsScriptModuleExecutor;
}


/**
 * Execution arguments for a script that provides the value for stdin.
 */
export interface AppInputScriptExecutionArguments extends AppScriptArguments {
    /**
     * The arguments for the execution.
     */
    readonly arguments: string[];
}

/**
 * A module for providing stdin value for an app.
 */
export interface AppInputScriptModule {
    /**
     * Provides the value for stdin.
     */
    readonly getInput: AppInputScriptModuleExecutor;
}

/**
 * A function / method that provides the value for stdin.
 * 
 * @param {AppInputScriptExecutionArguments} args The arguments for the script.
 * 
 * @return {any} The value for stdin.
 */
export type AppInputScriptModuleExecutor = (args: AppInputScriptExecutionArguments) => any;

/**
 * Script arguments for deployment via app / shell command.
 */
export interface AppScriptArguments extends deploy_contracts.ScriptArguments {
    /**
     * The working directory.
     */
    readonly cwd: string;
    /**
     * The list of files to handle.
     */
    readonly files: string[];
    /**
     * The kind of deploy operaton.
     */
    readonly operation: deploy_contracts.DeployOperation;
    /**
     * The output directory.
     */
    readonly outDirectory: string;
    /**
     * The underlying target.
     */
    readonly target: AppTarget;
    /**
     * The underlying workspace.
     */
    readonly workspace: deploy_workspace.Workspace;
}

/**
 * An 'app' target.
 */
export interface AppTarget extends deploy_targets.Target {
    /**
     * The app / shell command.
     */
    readonly app: string;
    /**
     * Append operation flag to argument list (true)
     * or add as first argument (false).
     */
    readonly appendOperationFlag?: boolean;
    /**
     * One or more arguments for the invokation.
     */
    readonly arguments?: string | any[];
    /**
     * Options for a script that provides arguments.
     */
    readonly argumentScriptOptions?: any;
    /**
     * Submit file list as one argument or not.
     */
    readonly asOneArgument?: boolean;
    /**
     * The custom working directory to use.
     */
    readonly cwd?: string;
    /**
     * The optional operation flag, that indicates if files should be deleted.
     */
    readonly deleteFlag?: string;
    /**
     * The optional operation flag, that indicates if files should be deployed.
     */
    readonly deployFlag?: string;
    /**
     * Dump stdout and stderr to console or not.
     */
    readonly dumpOutput?: string;
    /**
     * An expression that is used to concat a file list to one string.
     */
    readonly fileSeparator?: string;
    /**
     * The value for stdin.
     */
    readonly input?: string;
    /**
     * The encoding to use for stdin.
     */
    readonly inputEncoding?: string;
    /**
     * 'input' is the path to a script that provides the value for stdin or not.
     */
    readonly inputIsScript?: boolean;
    /**
     * Options for the input script.
     */
    readonly inputScriptOptions?: any;
    /**
     * The custom output directory.
     */
    readonly outDirectory?: string;
    /**
     * The custom path separator to use.
     */
    readonly pathSeparator?: string;
    /**
     * At file list at the beginning of the argument list (true)
     * or at the end (false).
     */
    readonly prependFileList?: string;
    /**
     * The optional operation flag, that indicates if files should be pulled.
     */
    readonly pullFlag?: string;
    /**
     * Run in integrated terminal or not.
     */
    readonly runInTerminal?: boolean;
    /**
     * Submit file list or not.
     */
    readonly submitFileList?: boolean;
    /**
     * Use placeholders in arguments or not.
     */
    readonly usePlaceholders?: boolean;
    /**
     * Use relative paths for file lists or not.
     */
    readonly useRelativePaths?: boolean;
}


class AppPlugin extends deploy_plugins.PluginBase<AppTarget> {
    private readonly _ARGS_SCRIPT_EVENTS = new Events.EventEmitter();
    private readonly _ARGS_SCRIPT_STATES: deploy_contracts.KeyValuePairs = {};
    private readonly _GLOBAL_STATE: deploy_contracts.KeyValuePairs = {};
    private readonly _INPUT_SCRIPT_EVENTS = new Events.EventEmitter();
    private readonly _INPUT_SCRIPT_STATES: deploy_contracts.KeyValuePairs = {};


    public get canDelete() {
        return true;
    }
    public get canDownload() {
        return true;
    }
    public get canList() {
        return true;
    }


    public async deleteFiles(context: deploy_plugins.DeleteContext<AppTarget>) {
        const ME = this;

        const FIRST_FILE = Enumerable.from(context.files).firstOrDefault();
        const OTHER_FILES = Enumerable.from(context.files).skip(1).toArray();

        if (!deploy_helpers.isSymbol(FIRST_FILE)) {
            await FIRST_FILE.onBeforeDelete(
                ME.getFileDestination(context.target, FIRST_FILE)
            );
        }

        let err: any;
        try {
            await this.runApp(
                context.target,
                context.files,
                deploy_contracts.DeployOperation.Delete,
                () => context.isCancelling,
            );
        }
        catch (e) {
            err = e;
        }
        finally {
            if (!deploy_helpers.isSymbol(FIRST_FILE)) {
                await FIRST_FILE.onDeleteCompleted(err);
            }
        }

        for (const F of OTHER_FILES) {
            if (context.isCancelling) {
                break;
            }

            await F.onBeforeDelete(
                deploy_helpers.toDisplayablePath(F.path)
            );

            await F.onDeleteCompleted(err);
        }
    }

    public async downloadFiles(context: deploy_plugins.DownloadContext<AppTarget>) {
        const ME = this;

        const FIRST_FILE = Enumerable.from(context.files).firstOrDefault();
        const OTHER_FILES = Enumerable.from(context.files).skip(1).toArray();

        if (!deploy_helpers.isSymbol(FIRST_FILE)) {
            await FIRST_FILE.onBeforeDownload(
                ME.getFileDestination(context.target, FIRST_FILE)
            );
        }

        let err: any;
        try {
            await this.runApp(
                context.target,
                context.files,
                deploy_contracts.DeployOperation.Pull,
                () => context.isCancelling,
            );
        }
        catch (e) {
            err = e;
        }
        finally {
            if (!deploy_helpers.isSymbol(FIRST_FILE)) {
                await FIRST_FILE.onDownloadCompleted(err);
            }
        }

        for (const F of OTHER_FILES) {
            if (context.isCancelling) {
                break;
            }

            await F.onBeforeDownload(
                deploy_helpers.toDisplayablePath(F.path)
            );

            await F.onDownloadCompleted(err);
        }
    }

    private getCwd(target: AppTarget) {
        const WORKSPACE = target.__workspace;

        let cwd = this.replaceWithValues(
            target,
            target.cwd
        );
        if (deploy_helpers.isEmptyString(cwd)) {
            return WORKSPACE.rootPath;
        }

        if (!Path.isAbsolute(cwd)) {
            cwd = Path.join(WORKSPACE.rootPath, cwd);
        }

        return Path.resolve(cwd);
    }

    private getFiles(target: AppTarget,
                     files: deploy_contracts.WithNameAndPath | deploy_contracts.WithNameAndPath[]) {
        files = deploy_helpers.asArray(files)

        const CWD = this.getCwd(target);
        const USE_RELATIVE_PATHS = deploy_helpers.toBooleanSafe(target.useRelativePaths);

        let pathSeparator = this.replaceWithValues(
            target,
            target.pathSeparator
        );
        if (deploy_helpers.isEmptyString(pathSeparator)) {
            pathSeparator = Path.sep;
        }

        return files.map(f => {
            return Path.resolve(
                Path.join(
                    CWD,
                    deploy_helpers.normalizePath(
                        f.path + '/' + f.name,
                    )
                )
            );
        }).map(f => {
            if (USE_RELATIVE_PATHS) {
                if (f.startsWith(CWD)) {
                    f = f.substr(CWD.length);
                }
            }

            return f;
        }).map(f => {
            f = deploy_helpers.replaceAllStrings(f, '/', Path.sep);
            f = deploy_helpers.replaceAllStrings(f, Path.sep, '/');
            f = deploy_helpers.replaceAllStrings(f, '/', pathSeparator);

            return f;
        }).filter(f => !deploy_helpers.isEmptyString(f));
    }

    private getFileDestination(target: AppTarget, file: deploy_contracts.WithNameAndPath): string {
        return deploy_helpers.toStringSafe(target.app);
    }

    private getOutDirectory(target: AppTarget) {
        const WORKSPACE = target.__workspace;
        const CWD = this.getCwd(target);

        let outDir = this.replaceWithValues(
            target,
            target.outDirectory
        );
        if (deploy_helpers.isEmptyString(outDir)) {
            return CWD;
        }

        if (!Path.isAbsolute(outDir)) {
            outDir = Path.join(WORKSPACE.rootPath, outDir);
        }

        return Path.resolve(outDir);
    }

    public async listDirectory(context: deploy_plugins.ListDirectoryContext<AppTarget>) {
        const ME = this;

        const OUT_DIR = ME.getOutDirectory(context.target);

        let targetDir = Path.join(
            OUT_DIR,
            context.dir
        );
        targetDir = Path.resolve(targetDir);

        if (!context.workspace.isPathOf(targetDir)) {
            throw new Error(
                ME.t(context.target,
                     'plugins.app.invalidDirectory', context.dir)
            );
        }

        let relativePath = targetDir.substr(OUT_DIR.length);
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

        const RESULT: deploy_plugins.ListDirectoryResult<AppTarget> = {
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
                        Path.join(OUT_DIR, F)
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
                        Path.join(OUT_DIR, F)
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
                        Path.join(OUT_DIR, F)
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

    protected onDispose() {
        this._ARGS_SCRIPT_EVENTS.removeAllListeners();
        this._INPUT_SCRIPT_EVENTS.removeAllListeners();
    }

    private runApp(target: AppTarget,
                   filesWithPath: deploy_contracts.WithNameAndPath | deploy_contracts.WithNameAndPath[],
                   operation: deploy_contracts.DeployOperation,
                   isCancelling: () => boolean) {
        const ME = this;
        const TARGET_NAME = deploy_targets.getTargetName(target);
        const WORKSPACE = target.__workspace;

        const FILES = ME.getFiles(target, filesWithPath);

        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const CWD = ME.getCwd(target);
                const OUT_DIRECTORY = ME.getOutDirectory(target);  
                const SUBMIT_FILELIST = deploy_helpers.toBooleanSafe(target.submitFileList, true);
                const USE_PLACEHOLDERS = deploy_helpers.toBooleanSafe(target.usePlaceholders);

                const APP = ME.replaceWithValues(
                    target,
                    target.app
                );

                let operationFlagDetector: (t: AppTarget) => string =
                    () => undefined;
                switch (operation) {
                    case deploy_contracts.DeployOperation.Delete:
                        operationFlagDetector = (t) => t.deleteFlag;
                        break;

                    case deploy_contracts.DeployOperation.Deploy:
                        operationFlagDetector = (t) => t.deployFlag;
                        break;

                    case deploy_contracts.DeployOperation.Pull:
                        operationFlagDetector = (t) => t.pullFlag;
                        break;
                }

                let operationFlag: string | false = deploy_helpers.toStringSafe(
                    operationFlagDetector(target)
                );
                if (deploy_helpers.isEmptyString(operationFlag)) {
                    operationFlag = false;
                }

                let fileSeparator = deploy_helpers.toStringSafe(
                    ME.replaceWithValues(
                        target,
                        target.fileSeparator
                    )
                );
                if ('' === fileSeparator) {
                    fileSeparator = ',';
                }

                const ADDITIONAL_VALUES: deploy_values.Value[] = [
                    new deploy_values.FunctionValue(() => {
                        return CWD;
                    }, 'cwd'),
                    new deploy_values.FunctionValue(() => {
                        return FILES.join(fileSeparator);
                    }, 'filesToDeploy'),
                    new deploy_values.FunctionValue(() => {
                        return false === operationFlag ? '' : operationFlag;
                    }, 'operationFlag'),
                    new deploy_values.FunctionValue(() => {
                        return OUT_DIRECTORY;
                    }, 'outDirectory'),
                    new deploy_values.FunctionValue(() => {
                        return target.name;
                    }, 'target'),
                ];

                const REPLACE_WITH_VALUES = (val: any) => {
                    return ME.replaceWithValues(
                        target,
                        val,
                        ADDITIONAL_VALUES,
                    );
                };

                let args: any[];
                if (deploy_helpers.isNullOrUndefined(target.arguments)) {
                    args = [];
                }
                else {
                    if (Array.isArray(target.arguments)) {
                        args = target.arguments;
                    }
                    else {
                        // via script

                        let argsScriptFilePath = REPLACE_WITH_VALUES(target.arguments);

                        let argsScriptFile: string | false = argsScriptFilePath;

                        if (!Path.isAbsolute(argsScriptFile)) {
                            argsScriptFile = await ME.getExistingSettingPath(
                                target,
                                argsScriptFile
                            );
                        }

                        if (false === argsScriptFile) {
                            throw new Error(
                                ME.t(target,
                                     'fileNotFound', argsScriptFilePath),
                            );
                        }

                        argsScriptFile = Path.resolve(argsScriptFile);

                        const SCRIPT_MODULE = await deploy_helpers.loadModule<AppArgumentsScriptModule>(argsScriptFile);
                        if (SCRIPT_MODULE) {
                            const GET_ARGUMENTS = SCRIPT_MODULE.getArguments;
                            if (GET_ARGUMENTS) {
                                const ARGS: AppArgumentsScriptExecutionArguments = {
                                    cwd: CWD,
                                    events: ME._ARGS_SCRIPT_EVENTS,
                                    extension: WORKSPACE.context.extension,
                                    files: FILES.map(f => f),
                                    folder: WORKSPACE.folder,
                                    globalEvents: deploy_events.EVENTS,
                                    globals: WORKSPACE.globals,
                                    globalState: ME._GLOBAL_STATE,
                                    logger: deploy_log.CONSOLE,
                                    operation: operation,
                                    options: deploy_helpers.cloneObject(target.argumentScriptOptions),
                                    outDirectory: OUT_DIRECTORY,
                                    replaceWithValues: (val) => {
                                        return REPLACE_WITH_VALUES(val);
                                    },
                                    require: (id) => {
                                        return deploy_helpers.requireFromExtension(id);
                                    },
                                    sessionState: deploy_session.SESSION_STATE,
                                    state: undefined,
                                    target: target,
                                    workspace: undefined,
                                };

                                // ARGS.state
                                Object.defineProperty(ARGS, 'state', {
                                    enumerable: true,

                                    get: () => {
                                        return ME._ARGS_SCRIPT_STATES[<string>argsScriptFile];
                                    },

                                    set: (newValue) => {
                                        ME._ARGS_SCRIPT_STATES[<string>argsScriptFile] = newValue;
                                    }
                                });

                                // ARGS.workspace
                                Object.defineProperty(ARGS, 'workspace', {
                                    enumerable: true,

                                    get: function () {
                                        return this.target.__workspace;
                                    }
                                });

                                args = await Promise.resolve(
                                    deploy_helpers.applyFuncFor(
                                        GET_ARGUMENTS,
                                        SCRIPT_MODULE,
                                    )(ARGS)
                                );
                            }
                        }
                    }
                }

                if (deploy_helpers.isNullOrUndefined(target.arguments)) {
                    args = [];
                }
                else {
                    args = deploy_helpers.asArray(args, false);
                }

                if (false !== operationFlag) {
                    if (deploy_helpers.toBooleanSafe(target.appendOperationFlag)) {
                        args.push(operationFlag);
                    }
                    else {
                        args = [ operationFlag ].concat( args );
                    }
                }

                if (SUBMIT_FILELIST) {
                    let fileArgs: any[];
                    if (deploy_helpers.toBooleanSafe(target.asOneArgument)) {
                        fileArgs = [
                            FILES.join(fileSeparator)
                        ];
                    }
                    else {
                        fileArgs = FILES;
                    }

                    if (deploy_helpers.toBooleanSafe(target.prependFileList)) {
                        args = fileArgs.concat( args );
                    }
                    else {
                        args = args.concat( fileArgs );
                    }
                }

                args = args.map(a => {
                    if (USE_PLACEHOLDERS) {
                        a = REPLACE_WITH_VALUES(a);
                    }

                    return deploy_helpers.toStringSafe(a);
                });

                if (isCancelling()) {
                    return;
                }

                const GET_ENCODING = () => {
                    let enc: string | false = deploy_helpers.normalizeString(
                        REPLACE_WITH_VALUES(target.inputEncoding)
                    );
                    if ('' === enc) {
                        enc = false;
                    }

                    return enc;
                };

                let stdInput: string | false = false;

                if (!deploy_helpers.isNullOrUndefined(target.input)) {
                    if (deploy_helpers.toBooleanSafe(target.inputIsScript)) {
                        // via script

                        let inputScriptFilePath = REPLACE_WITH_VALUES(target.input);

                        let inputScriptFile: string | false = inputScriptFilePath;

                        if (!Path.isAbsolute(inputScriptFile)) {
                            inputScriptFile = await ME.getExistingSettingPath(
                                target,
                                inputScriptFile
                            );
                        }

                        if (false === inputScriptFile) {
                            throw new Error(
                                ME.t(target,
                                     'fileNotFound', inputScriptFilePath),
                            );
                        }

                        inputScriptFile = Path.resolve(inputScriptFile);

                        const SCRIPT_MODULE = await deploy_helpers.loadModule<AppInputScriptModule>(inputScriptFile);
                        if (SCRIPT_MODULE) {
                            let inputValue: string;

                            const GET_INPUT = SCRIPT_MODULE.getInput;
                            if (GET_INPUT) {
                                const ARGS: AppInputScriptExecutionArguments = {
                                    arguments: args,
                                    cwd: CWD,
                                    events: ME._INPUT_SCRIPT_EVENTS,
                                    extension: WORKSPACE.context.extension,
                                    files: FILES.map(f => f),
                                    folder: WORKSPACE.folder,
                                    globalEvents: deploy_events.EVENTS,
                                    globals: WORKSPACE.globals,
                                    globalState: ME._GLOBAL_STATE,
                                    logger: deploy_log.CONSOLE,
                                    operation: operation,
                                    options: deploy_helpers.cloneObject(target.inputScriptOptions),
                                    outDirectory: OUT_DIRECTORY,
                                    replaceWithValues: (val) => {
                                        return REPLACE_WITH_VALUES(val);
                                    },
                                    require: (id) => {
                                        return deploy_helpers.requireFromExtension(id);
                                    },
                                    sessionState: deploy_session.SESSION_STATE,
                                    state: undefined,
                                    target: target,
                                    workspace: undefined,
                                };

                                // ARGS.state
                                Object.defineProperty(ARGS, 'state', {
                                    enumerable: true,

                                    get: () => {
                                        return ME._INPUT_SCRIPT_STATES[<string>inputScriptFile];
                                    },

                                    set: (newValue) => {
                                        ME._INPUT_SCRIPT_STATES[<string>inputScriptFile] = newValue;
                                    }
                                });

                                // ARGS.workspace
                                Object.defineProperty(ARGS, 'workspace', {
                                    enumerable: true,

                                    get: function () {
                                        return this.target.__workspace;
                                    }
                                });

                                const GET_INPUT_RESULT = await Promise.resolve(
                                    deploy_helpers.applyFuncFor(
                                        GET_INPUT,
                                        SCRIPT_MODULE,
                                    )(ARGS)
                                );

                                if (!deploy_helpers.isNullOrUndefined(GET_INPUT_RESULT)) {
                                    if (deploy_helpers.isString(GET_INPUT_RESULT)) {
                                        inputValue = GET_INPUT_RESULT;
                                    }
                                    else {
                                        const ENC = GET_ENCODING();

                                        const BUFF = await deploy_helpers.asBuffer(GET_INPUT_RESULT);
                                        if (BUFF) {
                                            if (false !== ENC) {
                                                inputValue = BUFF.toString(ENC);
                                            }
                                            else {
                                                inputValue = BUFF.toString();
                                            }
                                        }
                                    }
                                }
                            }

                            stdInput = deploy_helpers.toStringSafe(inputValue);
                        }
                    }
                    else {
                        // from value

                        stdInput = REPLACE_WITH_VALUES(target.input);
                    }
                }

                if ('' === stdInput) {
                    stdInput = false;
                }

                if (deploy_helpers.toBooleanSafe(target.runInTerminal)) {
                    const SHELL_PATH = Path.resolve(
                        Path.join(CWD, APP)
                    );
                    
                    const TERMIMAL = vscode.window.createTerminal({
                        env: process.env,
                        name: deploy_targets.getTargetName(target),
                        shellArgs: args,
                        shellPath: SHELL_PATH,
                    });

                    TERMIMAL.show(false);

                    if (false !== stdInput) {
                        // send to stdin

                        TERMIMAL.sendText(stdInput);
                    }
                }
                else {
                    const ENC = GET_ENCODING();

                    const EXEC_OPTS: ChildProcess.ExecFileSyncOptions = {
                        cwd: CWD,
                        env: process.env,
                    };

                    if (false !== ENC) {
                        EXEC_OPTS.encoding = ENC;
                    }

                    if (false !== stdInput) {
                        EXEC_OPTS.input = stdInput;
                    }

                    let output = ChildProcess.execFileSync(
                        APP, args, EXEC_OPTS
                    );
                    if (!output) {
                        output = Buffer.alloc(0);
                    }

                    if (deploy_helpers.toBooleanSafe(target.dumpOutput, true)) {
                        let outputStr: string;
                        if (false === ENC) {
                            outputStr = output.toString();
                        }
                        else {
                            outputStr = output.toString(ENC);
                        }

                        deploy_log.CONSOLE.debug(
                            outputStr,
                            `plugins.app(${TARGET_NAME})`
                        );
                    }
                }

                COMPLETED(null);
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public async uploadFiles(context: deploy_plugins.UploadContext<AppTarget>) {
        const ME = this;

        const FIRST_FILE = Enumerable.from(context.files).firstOrDefault();
        const OTHER_FILES = Enumerable.from(context.files).skip(1).toArray();

        if (!deploy_helpers.isSymbol(FIRST_FILE)) {
            await FIRST_FILE.onBeforeUpload(
                ME.getFileDestination(context.target, FIRST_FILE)
            );
        }

        let err: any;
        try {
            await this.runApp(
                context.target,
                context.files,
                deploy_contracts.DeployOperation.Deploy,
                () => context.isCancelling,
            );
        }
        catch (e) {
            err = e;
        }
        finally {
            if (!deploy_helpers.isSymbol(FIRST_FILE)) {
                await FIRST_FILE.onUploadCompleted(err);
            }
        }

        for (const F of OTHER_FILES) {
            if (context.isCancelling) {
                break;
            }

            await F.onBeforeUpload(
                deploy_helpers.toDisplayablePath(F.path)
            );

            await F.onUploadCompleted(err);
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
    return new AppPlugin(context);
}
