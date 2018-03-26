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
import * as ChildProcess from 'child_process';
import * as deploy_code from './code';
import * as deploy_contracts from './contracts';
import * as deploy_log from './log';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as FS from 'fs';
import * as FSExtra from 'fs-extra';
import * as MimeTypes from 'mime-types';
import * as Minimatch from 'minimatch';
import * as OS from 'os';
import * as Path from 'path';
import * as TMP from 'tmp';
import * as URL from 'url';
import * as vscode from 'vscode';
import {
    applyFuncFor, asArray,
    buildWorkflow,
    cloneObject, cloneObjectFlat, compareValuesBy, createCompletedAction,
    doesMatch,
    isEmptyString,
    normalizeString,
    readAll,
    toBooleanSafe, toStringSafe, tryDispose
} from 'vscode-helpers';

export * from 'vscode-helpers';

/**
 * Result of an execution.
 */
export interface ExecResult {
    /**
     * The output from 'standard error' stream.
     */
    readonly stdErr: string;
    /**
     * The output from 'standard output' stream.
     */
    readonly stdOut: string;
    /**
     * The underlying process.
     */
    readonly process: ChildProcess.ChildProcess;
}

/**
 * Options for 'invokeForTempFile' function.
 */
export interface InvokeForTempFileOptions {
    /**
     * The initial data.
     */
    readonly data?: any;
    /**
     * The custom prefix.
     */
    readonly prefix?: string;
    /**
     * The custom postfix / suffix.
     */
    readonly postfix?: string;
    /**
     * Keep file after execution or not.
     */
    readonly keep?: boolean;
}

/**
 * Options for open function.
 */
export interface OpenOptions {
    /**
     * The app (or options) to open.
     */
    readonly app?: string | string[];
    /**
     * The custom working directory.
     */
    readonly cwd?: string;
    /**
     * An optional list of environment variables
     * to submit to the new process.
     */
    readonly env?: any;
    /**
     * Wait until exit or not.
     */
    readonly wait?: boolean;
}

/**
 * A function to setup a new button.
 * 
 * @param {vscode.StatusBarItem} The new button.
 * @param {TButton} desc The description.
 * 
 * @return {NewButtonSetupResult|PromiseLike<NewButtonSetupResult>} The result.
 */
export type NewButtonSetup<TButton extends deploy_contracts.Button = deploy_contracts.Button> =
    (newBtn: vscode.StatusBarItem, desc: TButton) => NewButtonSetupResult | PromiseLike<NewButtonSetupResult>;

/**
 * Possible results for NewButtonSetup<TButton> function.
 */
export type NewButtonSetupResult = void | boolean | null | undefined;


/**
 * Handles a value as string and checks if it does match a file filter.
 * 
 * @param {any} val The value to check.
 * @param {deploy_contracts.FileFilter} filter The filter.
 * 
 * @return {boolean} Does match or not.
 */
export function checkIfDoesMatchByFileFilter(val: any, filter: deploy_contracts.FileFilter) {
    if (!filter) {
        filter = {
            files: '**',
        };
    }

    const OPTS: Minimatch.IOptions = {
        dot: true,
        nocase: true,
    };

    const IS_EXCLUDED = doesMatch(val, filter.exclude, OPTS);
    if (!IS_EXCLUDED) {
        return doesMatch(val, filter.files, OPTS);
    }

    return false;
}

/**
 * Clones an object / value without functions deep.
 * 
 * @param {T} val The value / object to clone.
 * 
 * @return {T} The cloned value / object.
 */
export function cloneObjectWithoutFunctions<T>(val: T): T {
    if (!val) {
        return val;
    }

    const CLONED_OBJ: T = <any>{};
    for (let P in val) {
        let valueToSet: any = val[P];
        if (isFunc(valueToSet)) {
            continue;
        }

        if (Array.isArray(valueToSet)) {
            let newArray = [];
            for (const ITEM of valueToSet) {
                newArray.push(
                    cloneObject(ITEM)
                );
            }

            valueToSet = newArray;
        }

        CLONED_OBJ[P] = valueToSet;
    }

    return CLONED_OBJ;
}

/**
 * Creates a new status bar button.
 * 
 * @param {TButton} buttonDesc The description for the button.
 * @param {Function} [setup] On optional function which setups the new button.
 *                           If you return an explicit (false), the button will be disposed.
 * 
 * @return {Promise<vscode.StatusBarItem>} The promise with new new button.
 */
export async function createButton<TButton extends deploy_contracts.Button = deploy_contracts.Button>(
    buttonDesc: TButton,
    setup?: NewButtonSetup<TButton>
): Promise<vscode.StatusBarItem> {
    if (!buttonDesc) {
        return;
    }

    if (!toBooleanSafe(buttonDesc.enabled, true)) {
        return;
    }

    let newBtn: vscode.StatusBarItem;
    try {
        let alignment = toBooleanSafe(buttonDesc.isRight) ? vscode.StatusBarAlignment.Right
                                                          : vscode.StatusBarAlignment.Left;

        let color: string | vscode.ThemeColor = normalizeString(buttonDesc.color);
        if ('' === color) {
            color = new vscode.ThemeColor('button.foreground');
        }
        if (_.isString(color)) {
            if (!color.startsWith('#')) {
                color = new vscode.ThemeColor(color);
            }
        }

        let prio = parseInt( toStringSafe(buttonDesc.priority).trim() );
        if (isNaN(prio)) {
            prio = undefined;
        }

        let text = toStringSafe(buttonDesc.text);
        if (isEmptyString(text)) {
            text = undefined;
        }

        let tooltip = toStringSafe(buttonDesc.tooltip);
        if (isEmptyString(tooltip)) {
            tooltip = undefined;
        }

        newBtn = vscode.window.createStatusBarItem(alignment, prio);
        newBtn.color = color;
        newBtn.text = text;
        newBtn.tooltip = tooltip;

        let dispose = false;

        if (setup) {
            dispose = !toBooleanSafe(
                await Promise.resolve(
                    setup(newBtn, buttonDesc)
                ),
                true
            );
        }

        if (dispose) {
            if (tryDispose(newBtn)) {
                newBtn = null;
            }
        }

        return newBtn;
    }
    catch (e) {
        tryDispose(newBtn);

        throw e;
    }
}

/**
 * Executes something.
 * 
 * @param {string} command The thing / command to execute. 
 * @param {ChildProcess.ExecOptions} [opts] Custom options.
 * 
 * @return {Promise<ExecResult>} The promise with the result.
 */
export async function exec(command: string, opts?: ChildProcess.ExecOptions) {
    command = toStringSafe(command);

    if (!opts) {
        opts = {};
    }

    if (isNullOrUndefined(opts.env)) {
        opts.env = process.env;
    }

    return new Promise<ExecResult>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            const RESULT: ExecResult = {
                stdErr: undefined,
                stdOut: undefined,
                process: undefined,
            };

            (<any>RESULT)['process'] = ChildProcess.exec(command, opts, (err, stdout, stderr) => {
                if (err) {
                    COMPLETED(err);
                }
                else {
                    (<any>RESULT)['stdErr'] = stderr;
                    (<any>RESULT)['stdOut'] = stdout;

                    COMPLETED(null, RESULT);
                }
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Executes a file.
 * 
 * @param {string} command The thing / command to execute.
 * @param {any[]} [args] One or more argument for the execution.
 * @param {ChildProcess.ExecFileOptions} [opts] Custom options.
 * 
 * @return {Promise<ExecResult>} The promise with the result.
 */
export async function execFile(command: string, args?: any[], opts?: ChildProcess.ExecFileOptions) {
    command = toStringSafe(command);

    if (isNullOrUndefined(args)) {
        args = [];
    }
    else {
        args = asArray(args, false).map(a => {
            return toStringSafe(a);
        });
    }

    if (!opts) {
        opts = {};
    }

    if (isNullOrUndefined(opts.env)) {
        opts.env = process.env;
    }

    return new Promise<ExecResult>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            const RESULT: ExecResult = {
                stdErr: undefined,
                stdOut: undefined,
                process: undefined,
            };

            (<any>RESULT)['process'] = ChildProcess.execFile(command, args, opts, (err, stdout, stderr) => {
                if (err) {
                    COMPLETED(err);
                }
                else {
                    (<any>RESULT)['stdErr'] = stderr;
                    (<any>RESULT)['stdOut'] = stdout;

                    COMPLETED(null, RESULT);
                }
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Filters items with 'if' code.
 * 
 * @param {TItem | TItem[]} items The items to filter.
 * @param {boolean} [throwOnError] Throw on error or not. 
 * @param {any} [errorResult] The custom result when an error occurred.
 * 
 * @return {TItem[]} The filtered items.
 */
export function filterConditionalItems<TItem extends deploy_contracts.ConditionalItem = deploy_contracts.ConditionalItem>(
    items: TItem | TItem[],
    throwOnError = false,
    errorResult: any = false,
) {
    items = asArray(items);
    throwOnError = toBooleanSafe(throwOnError);

    return items.filter(i => {
        return Enumerable.from( asArray(i.if) ).all(c => {
            let res: any;

            try {
                const IF_CODE = toStringSafe(c);
                if (!isEmptyString(IF_CODE)) {
                    res = deploy_code.exec({
                        code: IF_CODE,
                        context: {
                            i: i,
                        },
                        values: [],
                    });
                }
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'helpers.filterConditionalItems()');

                if (throwOnError) {
                    throw e;
                }

                return errorResult;
            }
            
            return toBooleanSafe(res, true);
        });
    });
}

/**
 * Filters platform specific objects.
 * 
 * @param {TItem|TItem[]} items The items to filter.
 * @param {Function} [platformDetector] The custom platform detector.
 * 
 * @return {TItem[]} The filtered items.
 */
export function filterPlatformItems<TItem extends deploy_contracts.PlatformItem = deploy_contracts.PlatformItem>(
    items: TItem | TItem[],
    platformDetector?: () => string,
): TItem[]
{
    if (!platformDetector) {
        platformDetector = () => process.platform;
    }

    const CURRENT_PLATFORM = normalizeString( platformDetector() );

    return asArray(items).filter(i => {
        const PLATFORMS = asArray(i.platforms).map(p => {
            return normalizeString(p);
        }).filter(p => '' !== p);

        if (PLATFORMS.length < 1) {
            return true;
        }

        return PLATFORMS.indexOf(CURRENT_PLATFORM) > -1;
    });
}

/**
 * Returns the (possible path) of the extension's sub folder inside the home directory.
 * 
 * @return {string} The path of the extension's sub folder inside the home directory.
 */
export function getExtensionDirInHome() {
    return Path.resolve(
        Path.join(OS.homedir(),
                  deploy_contracts.HOMEDIR_SUBFOLDER)
    );
}

/**
 * Returns the (possible path) of the extension's log sub folder inside the home directory.
 * 
 * @return {string} The path of the extension's log sub folder inside the home directory.
 */
export function getExtensionLogDirInHome() {
    return Path.resolve(
        Path.join(getExtensionDirInHome(),
                  '.logs')
    );
}

/**
 * Returns the value from a "parameter" object.
 * 
 * @param {Object} params The object.
 * @param {string} name The name of the parameter.
 * @param {TDefault} [defValue] The default value.
 * 
 * @return {string|TDefault} The value of the parameter (if found).
 *                           Otherwise the value of 'defValue'.
 */
export function getUriParam<TDefault = string>(params: Object, name: string, defValue?: TDefault): string | TDefault {
    name = normalizeString(name);

    if (params) {
        for (const P in params) {
            if (normalizeString(P) === name) {
                return toStringSafe(params[P]);
            }
        }
    }

    return defValue;
}

/**
 * Invokes an action for a temporary file.
 * 
 * @param {Function} action The action to invoke. 
 * @param {InvokeForTempFileOptions} [opts] Custom options.
 * 
 * @return {TResult} The result of the action.
 */
export function invokeForTempFile<TResult = any>(action: (path: string) => TResult,
                                                 opts?: InvokeForTempFileOptions) {
    if (!opts) {
        opts = {};
    }

    return new Promise<TResult>((resolve, reject) => {
        let tempFile: string;
        const COMPLETED = (err: any, result?: any) => {
            try {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            }
            finally {
                // remove temp file?
                if (!toBooleanSafe(opts.keep)) {
                    try {
                        if (!isEmptyString(tempFile)) {
                            if (FS.existsSync(tempFile)) {
                                FS.unlinkSync(tempFile);
                            }
                        }
                    }
                    catch (e) {
                        deploy_log.CONSOLE
                                  .trace(e, 'helpers.invokeForTempFile');
                    }
                }
            }
        };

        try {
            TMP.tmpName({
                keep: true,
                prefix: opts.prefix,
                postfix: opts.postfix,
            }, (err, tf) => {
                if (err) {
                    COMPLETED(err);
                }
                else {
                    try {
                        tempFile = Path.resolve(tf);

                        buildWorkflow().next(async () => {
                            if (!isNullOrUndefined(opts.data)) {
                                await writeFile(tempFile, opts.data);
                            }
                        }).next(async () => {
                            return await Promise.resolve(
                                action(tf)
                            );
                        }).start().then((result) => {
                            COMPLETED(null, result);
                        }, (err) => {
                            COMPLETED(err);
                        });
                    }
                    catch (e) {
                        COMPLETED(e);
                    }
                }
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Checks if a value is a boolean or not.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is boolean or not. 
 */
export function isBool(val: any): val is boolean {
    return _.isBoolean(val);
}

/**
 * Checks if a value is a function or not.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is function or not. 
 */
export function isFunc<TFunc extends Function = Function>(val: any): val is TFunc {
    return _.isFunction(val);
}

/**
 * Checks if a value represents a hex string.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Represents a hex string or not.
 */
export function isHex(val: any) {
    return (/^([a-f|0-9]+)$/i).test(
        normalizeString(val)
    );
}

/**
 * Checks if a value is (null) or (undefined).
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is (null)/(undefined) or not.
 */
export function isNullOrUndefined(val: any): boolean {
    return _.isNil(val);
}

/**
 * Checks if a value is an object or not.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is object or not. 
 */
export function isObject<TObj = Object>(val: any): val is TObj {
    return !isNullOrUndefined(val) &&
           !Array.isArray(val) &&
           'object' === typeof val;
}

/**
 * Checks if a value is a string or not.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is string or not. 
 */
export function isString(val: any): val is string {
    return !isNullOrUndefined(val) &&
           'string' === typeof val;
}

/**
 * Checks if a value is a symbol or not.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is symbol or not. 
 */
export function isSymbol(val: any): val is symbol {
    return _.isSymbol(val);
}

/**
 * Promise version of 'FS.lstat()' function.
 * 
 * @param {string|Buffer} path The path.
 * 
 * @return {Promise<FS.Stats>} The promise with the stats.
 */
export function lstat(path: string | Buffer) {
    return new Promise<FS.Stats>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            FS.lstat(path, (err, stats) => {
                if (err) {
                    COMPLETED(err);
                }
                else {
                    COMPLETED(null, stats);
                }
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Merges objects by their names. Last items win.
 * 
 * @param {TObj | TObj[]} objs The object(s) to merge.
 * @param {Function} [nameResolver] The custom name resolver.
 * @param {Function} [nameNormalizer] The custom name normalizer.
 * 
 * @return {TObj[]} The merged objects.
 */
export function mergeByName<TObj extends deploy_contracts.WithOptionalName = deploy_contracts.WithOptionalName>(
    objs: TObj | TObj[],
    nameResolver?: (obj: TObj) => string,
    nameNormalizer?: (name: string) => string,
) {
    if (isNullOrUndefined(objs)) {
        return objs;
    }

    objs = asArray(objs);

    if (!nameResolver) {
        nameResolver = (o) => o.name;
    }

    if (!nameNormalizer) {
        nameNormalizer = (n) => normalizeString(n);
    }

    const TEMP: { [name: string]: TObj } = {};
    objs.forEach(o => {
        const NAME = toStringSafe(
            nameNormalizer(
                nameResolver(o)
            )
        );

        TEMP[NAME] = o;
    });

    const RESULT: TObj[] = [];
    for (const N in TEMP) {
        RESULT.push( TEMP[N] );
    }

    return RESULT;
}

/**
 * Promise version of 'FSExtra.mkdirs()' function.
 * 
 * @param {string} dir The directory to create.
 */
export function mkdirs(dir: string) {
    dir = toStringSafe(dir);

    return new Promise<void>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            FSExtra.mkdirs(dir, (err) => {
                COMPLETED(err);
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Normalizes a path.
 * 
 * @param {string} path The path to normalize.
 * 
 * @return {string} The normalized path. 
 */
export function normalizePath(path: string) {
    path = toStringSafe(path);
    path = replaceAllStrings(path, Path.sep, '/');

    if (isEmptyString(path)) {
        path = '';
    }

    while (path.startsWith('/')) {
        path = path.substr(1);
    }
    while (path.endsWith('/')) {
        path = path.substr(0, path.length - 1);
    }

    return path;
}

/**
 * Opens a target.
 * 
 * @param {string} target The target to open.
 * @param {OpenOptions} [opts] The custom options to set.
 * 
 * @param {Promise<ChildProcess.ChildProcess>} The promise with the child process.
 */
export function open(target: string, opts?: OpenOptions): Promise<ChildProcess.ChildProcess> {
    if (!opts) {
        opts = {};
    }

    target = toStringSafe(target);
    const WAIT = toBooleanSafe(opts.wait, true);
    
    return new Promise((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);
        
        try {
            let app = opts.app;
            let cmd: string;
            let appArgs: string[] = [];
            let args: string[] = [];
            let cpOpts: ChildProcess.SpawnOptions = {
                cwd: opts.cwd,
                env: opts.env,
            };

            if (Array.isArray(app)) {
                appArgs = app.slice(1);
                app = opts.app[0];
            }

            if (process.platform === 'darwin') {
                // Apple

                cmd = 'open';

                if (WAIT) {
                    args.push('-W');
                }

                if (app) {
                    args.push('-a', app);
                }
            }
            else if (process.platform === 'win32') {
                // Microsoft

                cmd = 'cmd';
                args.push('/c', 'start', '""');
                target = target.replace(/&/g, '^&');

                if (WAIT) {
                    args.push('/wait');
                }

                if (app) {
                    args.push(app);
                }

                if (appArgs.length > 0) {
                    args = args.concat(appArgs);
                }
            }
            else {
                // Unix / Linux

                if (app) {
                    cmd = app;
                } else {
                    cmd = Path.join(__dirname, 'xdg-open');
                }

                if (appArgs.length > 0) {
                    args = args.concat(appArgs);
                }

                if (!WAIT) {
                    // xdg-open will block the process unless
                    // stdio is ignored even if it's unref'd
                    cpOpts.stdio = 'ignore';
                }
            }

            args.push(target);

            if (process.platform === 'darwin' && appArgs.length > 0) {
                args.push('--args');
                args = args.concat(appArgs);
            }

            let cp = ChildProcess.spawn(cmd, args, cpOpts);

            if (WAIT) {
                cp.once('error', (err) => {
                    COMPLETED(err);
                });

                cp.once('close', function (code) {
                    if (code > 0) {
                        COMPLETED(new Error('Exited with code ' + code));
                        return;
                    }

                    COMPLETED(null, cp);
                });
            }
            else {
                cp.unref();

                COMPLETED(null, cp);
            }
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Opens and shows a text document.
 * 
 * @param {string|object} [filenameOrOptions] Optional filename or options.
 * 
 * @return {Promise<vscode.TextEditor>} The promise with the new text editor.
 */
export async function openAndShowTextDocument(filenameOrOptions?: string | { language?: string; content?: string; }) {
    return await vscode.window.showTextDocument(
        await vscode.workspace.openTextDocument
                              .apply(null, arguments)
    );
}

/**
 * Promise version of 'FS.readdir()' function.
 * 
 * @param {string|Buffer} path The path.
 * 
 * @return {Promise<string[]>} The promise with the file and folder names.
 */
export function readDir(path: string | Buffer) {
    return new Promise<string[]>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            FS.readdir(path, (err, result) => {
                if (err) {
                    COMPLETED(err);
                }
                else {
                    COMPLETED(null, result);
                }
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Promise version of 'FS.readFile()' function.
 * 
 * @param {string} filename The file to read.
 * 
 * @return {Promise<FS.Stats>} The promise with the stats.
 */
export function readFile(filename: string) {
    return new Promise<Buffer>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            FS.readFile(filename, (err, data) => {
                if (err) {
                    COMPLETED(err);
                }
                else {
                    COMPLETED(null, data);
                }
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Reads the content of a stream.
 * 
 * @param {NodeJS.ReadableStream} stream The stream.
 * 
 * @returns {Promise<Buffer>} The promise with the content.
 */
export function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise<Buffer>(async (resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        if (!stream) {
            COMPLETED(null);
            return;
        }

        stream.once('error', (err) => {
            COMPLETED(err);
        });

        try {
            const DATA = await invokeForTempFile((tmpFile) => {
                return new Promise<Buffer>((res, rej) => {
                    const COMP = createCompletedAction(res, rej);

                    try {
                        const PIPE = stream.pipe( FS.createWriteStream(tmpFile) );

                        PIPE.once('error', (err) => {
                            COMP(err);
                        });

                        stream.once('end', () => {
                            readFile(tmpFile).then((d) => {
                                COMP(null, d);
                            }).catch((err) => {
                                COMP(err);
                            });
                        });
                    }
                    catch (e) {
                        COMP(e);
                    }
                });
            });

            COMPLETED(null, DATA);
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Replaces all occurrences of a string.
 * 
 * @param {string} str The input string.
 * @param {string} searchValue The value to search for.
 * @param {string} replaceValue The value to replace 'searchValue' with.
 * 
 * @return {string} The output string.
 */
export function replaceAllStrings(str: string, searchValue: string, replaceValue: string) {
    str = toStringSafe(str);
    searchValue = toStringSafe(searchValue);
    replaceValue = toStringSafe(replaceValue);

    return str.split(searchValue)
              .join(replaceValue);
}

/**
 * Imports a module from extension context.
 * 
 * @param {any} id The ID of the module.
 * 
 * @return {TModule} The imported module.
 */
export function requireFromExtension<TModule = any>(id: any): TModule {
    return require(
        toStringSafe(id)
    );
}

/**
 * Promise (and safe) version of 'vscode.window.showErrorMessage()' function.
 * 
 * @param {string} msg The message to display.
 * @param {TItem[]} [items] The optional items.
 * 
 * @return {Promise<TItem>} The promise with the selected item.
 */
export async function showErrorMessage<TItem extends vscode.MessageItem = vscode.MessageItem>(msg: string, ...items: TItem[]): Promise<TItem> {
    try {
        msg = toStringSafe(msg);

        return await vscode.window.showErrorMessage
                                  .apply(null, [ <any>`${msg}`.trim() ].concat(items));
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'helpers.showErrorMessage()');
    }
}

/**
 * Promise (and safe) version of 'vscode.window.showInformationMessage()' function.
 * 
 * @param {string} msg The message to display.
 * @param {TItem[]} [items] The optional items.
 * 
 * @return {Promise<TItem>} The promise with the selected item.
 */
export async function showInformationMessage<TItem extends vscode.MessageItem = vscode.MessageItem>(msg: string, ...items: TItem[]): Promise<TItem> {
    try {
        msg = toStringSafe(msg);

        return await vscode.window.showInformationMessage
                                  .apply(null, [ <any>`${msg}`.trim() ].concat(items));
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'helpers.showInformationMessage()');
    }
}

/**
 * Promise (and safe) version of 'vscode.window.showWarningMessage()' function.
 * 
 * @param {string} msg The message to display.
 * @param {TItem[]} [items] The optional items.
 * 
 * @return {Promise<TItem>} The promise with the selected item.
 */
export async function showWarningMessage<TItem extends vscode.MessageItem = vscode.MessageItem>(msg: string, ...items: TItem[]): Promise<TItem> {
    try {
        msg = toStringSafe(msg);

        return await vscode.window.showWarningMessage
                                  .apply(null, [ <any>`${msg}`.trim() ].concat(items));
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'helpers.showWarningMessage()');
    }
}

/**
 * Sorts items by its label.
 * 
 * @param {T|T[]} items The item(s).
 * @param {Function} [valueResolver] The value resolver whats result is used for comparison.
 * 
 * @return {T[]} The sorted items.
 */
export function sortByLabel<T extends { label?: any }>(
    items: T | T[],
    valueResolver?: (item: T) => any,
): T[] {
    if (!valueResolver) {
        valueResolver = (i) => i.label;
    }

    return asArray(items).sort((x, y) => {
        return compareValuesBy(x, y,
                               i => normalizeString( valueResolver(i) ));
    });
}


/**
 * Promise version of 'FS.stat()' function.
 * 
 * @param {string|Buffer} path The path.
 * 
 * @return {Promise<FS.Stats>} The promise with the stats.
 */
export function stat(path: string | Buffer) {
    return new Promise<FS.Stats>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            FS.stat(path, (err, stats) => {
                if (err) {
                    COMPLETED(err);
                }
                else {
                    COMPLETED(null, stats);
                }
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Converts a path to a "displayable" one.
 * 
 * @param {string} path The input value.
 * 
 * @return {string} The output value. 
 */
export function toDisplayablePath(path: string): string {
    path = toStringSafe(path);
    path = replaceAllStrings(path, Path.sep, '/');

    if (!path.trim().startsWith('/')) {
        path = '/' + path;
    }

    return path;
}

/**
 * Converts a file filter to a 'minimatch' compatible one.
 * 
 * @param {TFilter} filter The filter to convert.
 * 
 * @return {TFilter} The converted filter.
 */
export function toMinimatchFileFilter<TFilter extends deploy_contracts.FileFilter = deploy_contracts.FileFilter>
(
    filter: TFilter
) {
    filter = cloneObjectFlat(filter);
    if (filter) {
        const NORMALIZE_PATTERNS = (patterns: string | string[]) => {
            return asArray(patterns).map(p => {
                return toStringSafe(p);
            }).filter(p => {
                return !isEmptyString(p);
            }).map(p => {
                if (!p.trim().startsWith('/')) {
                    p = '/' + p;
                }
    
                return p;
            });
        };

        (<any>filter)['files'] = NORMALIZE_PATTERNS(filter.files);
        if ((<string[]>filter.files).length < 1) {
            (<any>filter)['files'] = '/**/*';
        }

        (<any>filter)['exclude'] = NORMALIZE_PATTERNS(filter.exclude);
        if ((<string[]>filter.exclude).length < 1) {
            delete (<any>filter)['exclude'];
        }
    }

    return filter;
}

/**
 * Tries to find a language ID by filename.
 * 
 * @param {string} file The (name of the) file.
 * 
 * @return {Promise<string>} The promise with the language ID (if found). 
 */
export async function tryFindLanguageIdByFilename(file: string) {
    file = toStringSafe(file);

    let langId: string;

    if (!isEmptyString(file)) {
        try {
            const EXT = Path.extname(file).substr(1);
            switch (EXT) {
                case 'cs':
                    return 'csharp';
                
                case 'coffee':
                    return 'coffeescript';

                case 'ts':
                    return 'typescript';
            }

            const ALL_LANGUAGES = await vscode.languages.getLanguages();
            for (let i = 0; i < ALL_LANGUAGES.length; i++) {
                try {
                    const LANG = ALL_LANGUAGES[i];
                    
                    const CONTENT_TYPE = MimeTypes.lookup(LANG);
                    if (false !== CONTENT_TYPE) {
                        const MIME_EXT = MimeTypes.extension(CONTENT_TYPE);

                        if (EXT === MIME_EXT) {
                            langId = LANG;
                        }
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'helpers.tryFindLanguageIdByFilename(2)');
                }
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'helpers.tryFindLanguageIdByFilename(1)');
        }
    }

    return langId;
}

/**
 * Promise version of 'FS.unlink()' function.
 * 
 * @param {string|Buffer} path The path.
 */
export function unlink(path: string | Buffer) {
    return new Promise<void>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            FS.unlink(path, (err) => {
                COMPLETED(err);
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

/**
 * Extracts the query parameters of an URI to an object.
 * 
 * @param {URL.Url|vscode.Uri} uri The URI.
 * 
 * @return {deploy_contracts.KeyValuePairs<string>} The parameters of the URI as object.
 */
export function uriParamsToObject(uri: URL.Url | vscode.Uri): deploy_contracts.KeyValuePairs<string> {
    if (!uri) {
        return <any>uri;
    }

    let params: any;
    if (!isEmptyString(uri.query)) {
        // s. https://css-tricks.com/snippets/jquery/get-query-params-object/
        params = uri.query.replace(/(^\?)/,'')
                          .split("&")
                          .map(function(n) { return n = n.split("="), this[normalizeString(n[0])] =
                                                                           toStringSafe(decodeURIComponent(n[1])), this; }
                          .bind({}))[0];
    }

    return params || {};
}

/**
 * Promise version of 'FS.unlink()' function.
 * 
 * @param {string} filename The file to write to.
 * @param {any} data The data to write.
 */
export function writeFile(filename: string, data: any) {
    return new Promise<void>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            FS.writeFile(filename, data, (err) => {
                if (err) {
                    COMPLETED(err);
                }
                else {
                    COMPLETED(null);
                }
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}
