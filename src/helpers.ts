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
import * as deploy_code from './code';
import * as deploy_contracts from './contracts';
import * as deploy_log from './log';
import * as deploy_mappings from './mappings';
import * as deploy_workflows from './workflows';
import * as Enumerable from 'node-enumerable';
import * as FS from 'fs';
import * as FSExtra from 'fs-extra';
import * as Glob from 'glob';
import * as i18 from './i18';
const IsBinaryFile = require("isbinaryfile");
import * as IsStream from 'is-stream';
const MergeDeep = require('merge-deep');
import * as MimeTypes from 'mime-types';
import * as Minimatch from 'minimatch';
import * as Moment from 'moment';
import * as Path from 'path';
import * as Stream from "stream";
import * as TMP from 'tmp';
import * as URL from 'url';
import * as vscode from 'vscode';


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
    app?: string | string[];
    /**
     * The custom working directory.
     */
    cwd?: string;
    /**
     * An optional list of environment variables
     * to submit to the new process.
     */
    env?: any;
    /**
     * Wait until exit or not.
     */
    wait?: boolean;
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
 * A progress context.
 */
export interface ProgressContext {
    /**
     * Gets or sets the status message.
     */
    message: string;
}

/**
 * Progress options.
 */
export interface ProgressOptions {
    /**
     * The location.
     */
    readonly location?: vscode.ProgressLocation;
    /**
     * The title.
     */
    readonly title?: string;
}

/**
 * A progress result.
 */
export type ProgressResult<TResult = any> = TResult | PromiseLike<TResult>;

/**
 * A progress task.
 * 
 * @param {ProgressContext} context The underlying context.
 * 
 * @return {ProgressResult<TResult>} The result.
 */
export type ProgressTask<TResult = any> = (context: ProgressContext) => ProgressResult<TResult>;

/**
 * Describes a simple 'completed' action.
 * 
 * @param {any} err The occurred error.
 * @param {TResult} [result] The result.
 */
export type SimpleCompletedAction<TResult> = (err: any, result?: TResult) => void;


/**
 * Applies a function for a specific object / value.
 * 
 * @param {TFunc} func The function. 
 * @param {any} [thisArgs] The object to apply to the function.
 * 
 * @return {TFunc} The wrapped function.
 */
export function applyFuncFor<TFunc extends Function = Function>(
    func: TFunc,
    thisArgs: any
): TFunc {
    if (!func) {
        return <any>func;
    }

    return <any>function() {
        return func.apply(thisArgs, arguments);
    };
}

/**
 * Returns a value as array.
 * 
 * @param {T|T[]} val The value.
 * @param {boolean} [removeEmpty] Remove items that are (null)/(undefined) or not.
 * 
 * @return {T[]} The value as array.
 */
export function asArray<T>(val: T | T[], removeEmpty = true): T[] {
    removeEmpty = toBooleanSafe(removeEmpty, true);

    return (Array.isArray(val) ? val : [ val ]).filter(i => {
        if (removeEmpty) {
            return !isNullOrUndefined(i);
        }

        return true;
    });
}

/**
 * Returns a value as buffer.
 * 
 * @param {any} val The value to convert / cast.
 * @param {string} enc The custom encoding for the string parsers.
 * @param {number} [maxDepth] The custom value for the max depth of wrapped functions. Default: 63
 * 
 * @return {Promise<Buffer>} The promise with the buffer.
 */
export async function asBuffer(val: any, enc?: string, maxDepth?: number): Promise<Buffer> {
    return await asBufferInner(val, enc, null, maxDepth);
}

async function asBufferInner(val: any, enc?: string,
                             funcDepth?: number, maxDepth?: number) {
    if (isNaN(funcDepth)) {
        funcDepth = 0;
    }

    if (isNaN(maxDepth)) {
        maxDepth = 63;
    }

    if (funcDepth > maxDepth) {
        throw new Error(i18.t('maxDepthReached',
                              maxDepth));
    }

    if (Buffer.isBuffer(val) || isNullOrUndefined(val)) {
        return val;
    }

    if (isFunc(val)) {
        // wrapped

        return await asBufferInner(
            await Promise.resolve(
                val(enc, funcDepth, maxDepth),  
            ),
            enc,
            funcDepth + 1, maxDepth,
        );
    }

    enc = normalizeString(enc);
    if ('' === enc) {
        enc = undefined;
    }

    if (IsStream.readable(val)) {
        // stream
        return await readAll(val);
    }

    if (isObject(val) || Array.isArray(val)) {
        // JSON object
        return new Buffer(JSON.stringify(val),
                          enc);
    }

    // handle as string
    return new Buffer(toStringSafe(val),
                      enc);
}

/**
 * Returns a value as local Moment instance.
 * 
 * @param {Moment.Moment} val The input value.
 * 
 * @return {Moment.Moment} The output value.
 */
export function asLocalTime(val: any): Moment.Moment {
    let localTime: Moment.Moment;
    
    if (!isNullOrUndefined(val)) {
        if (Moment.isMoment(val)) {
            localTime = val;
        }
        else if (Moment.isDate(val)) {
            localTime = Moment(val);
        }
        else {
            localTime = Moment( toStringSafe(val) );
        }
    }

    if (localTime) {
        if (!localTime.isLocal()) {
            localTime = localTime.local();
        }
    }

    return localTime;
}

/**
 * Returns a value as UTC Moment instance.
 * 
 * @param {Moment.Moment} val The input value.
 * 
 * @return {Moment.Moment} The output value.
 */
export function asUTC(val: any): Moment.Moment {
    let utcTime: Moment.Moment;
    
    if (!isNullOrUndefined(val)) {
        if (Moment.isMoment(val)) {
            utcTime = val;
        }
        else if (Moment.isDate(val)) {
            utcTime = Moment(val);
        }
        else {
            utcTime = Moment( toStringSafe(val) );
        }
    }

    if (utcTime) {
        if (!utcTime.isUTC()) {
            utcTime = utcTime.utc();
        }
    }

    return utcTime;
}

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
        nonull: false,
    };

    const IS_EXCLUDED = doesMatch(val, filter.exclude, OPTS);
    if (!IS_EXCLUDED) {
        return doesMatch(val, filter.files, OPTS);
    }

    return false;
}

/**
 * Clones an object / value deep.
 * 
 * @param {T} val The value / object to clone.
 * 
 * @return {T} The cloned value / object.
 */
export function cloneObject<T>(val: T): T {
    if (!val) {
        return val;
    }

    return JSON.parse(
        JSON.stringify(val)
    );
}

/**
 * Clones an value flat.
 * 
 * @param {T} val The object to clone.
 * @param {boolean} [useNewObjectForFunctions] Use new object as thisArgs for functions or not.
 * 
 * @return {T} The cloned object.
 */
export function cloneObjectFlat<T>(val: T,
                                   useNewObjectForFunctions = true): T {
    useNewObjectForFunctions = toBooleanSafe(useNewObjectForFunctions, true);

    if (!val) {
        return val;
    }

    const CLONED_OBJ: T = <any>{};
    const ADD_PROPERTY = (prop: string, v: any) => {
        Object.defineProperty(CLONED_OBJ, prop, {
            configurable: true,
            enumerable: true,

            get: () => {
                return v;
            },
            set: (newValue) => {
                v = newValue;
            },
        });
    };

    const THIS_ARGS: any = useNewObjectForFunctions ? CLONED_OBJ : val;

    for (const P in val) {
        let valueToSet: any = val[P];
        if (isFunc(valueToSet)) {
            const FUNC = valueToSet;
            
            valueToSet = function() {
                return FUNC.apply(THIS_ARGS, arguments);
            };
        }

        ADD_PROPERTY(P, valueToSet);
    }

    return CLONED_OBJ;
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
 * Compares two values for a sort operation.
 * 
 * @param {T} x The left value.
 * @param {T} y The right value.
 * 
 * @return {number} The "sort value".
 */
export function compareValues<T>(x: T, y: T): number {
    if (x === y) {
        return 0;
    }

    if (x > y) {
        return 1;
    }

    if (x < y) {
        return -1;
    }

    return 0;
}

/**
 * Compares values by using a selector.
 * 
 * @param {T} x The left value. 
 * @param {T} y The right value.
 * @param {Function} selector The selector.
 * 
 * @return {number} The "sort value".
 */
export function compareValuesBy<T, U>(x: T, y: T,
                                      selector: (t: T) => U): number {
    if (!selector) {
        selector = (t) => <any>t;
    }

    return compareValues<U>(selector(x),
                            selector(y));
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

        let color = normalizeString(buttonDesc.color);
        if ('' === color) {
            color = '#ffffff';
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
 * Creates a simple 'completed' callback for a promise.
 * 
 * @param {Function} resolve The 'succeeded' callback.
 * @param {Function} reject The 'error' callback.
 * 
 * @return {SimpleCompletedAction<TResult>} The created action.
 */
export function createCompletedAction<TResult = any>(resolve: (value?: TResult | PromiseLike<TResult>) => void,
                                                     reject?: (reason: any) => void): SimpleCompletedAction<TResult> {
    let completedInvoked = false;

    return (err, result?) => {
        if (completedInvoked) {
            return;
        }
        completedInvoked = true;
        
        if (err) {
            if (reject) {
                reject(err);
            }
        }
        else {
            if (resolve) {
                resolve(result);
            }
        }
    };
}

/**
 * Handles a value as string and checks if it does match at least one (minimatch) pattern.
 * 
 * @param {any} val The value to check.
 * @param {string|string[]} patterns One or more patterns.
 * @param {Minimatch.IOptions} [options] Additional options.
 * 
 * @return {boolean} Does match or not.
 */
export function doesMatch(val: any, patterns: string | string[], options?: Minimatch.IOptions): boolean {
    val = toStringSafe(val);
    
    patterns = asArray(patterns).map(p => {
        return toStringSafe(p);
    });

    for (const P of patterns) {
        if (Minimatch(val, P, options)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Promise version of 'FS.exists()' function.
 * 
 * @param {string|Buffer} path The path.
 * 
 * @return {Promise<boolean>} The promise that indicates if path exists or not.
 */
export function exists(path: string | Buffer) {
    return new Promise<boolean>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            FS.exists(path, (doesExist) => {
                COMPLETED(null, doesExist);
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
 */
export function filterConditionalItems<TItem extends deploy_contracts.ConditionalItem = deploy_contracts.ConditionalItem>(
    items: TItem | TItem[],
    throwOnError = false,
    errorResult: any = false,
): TItem[] {
    if (isNullOrUndefined(items)) {
        return <any>items;
    }

    items = asArray(items, false);
    throwOnError = toBooleanSafe(throwOnError);

    return items.filter(i => {
        try {
            if (!isNullOrUndefined(i)) {
                const CONDITION = toStringSafe(i.if);
                if ('' !== CONDITION.trim()) {
                    const CTX: deploy_code.CodeExecutionContext = {
                        code: CONDITION,
                        values: [],
                    };

                    return deploy_code.exec( CTX );
                }
            }

            return true;
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'helpers.filterConditionalItems()');

            if (throwOnError) {
                throw e;
            }

            return errorResult;
        }
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
 * Async 'forEach'.
 * 
 * @param {Enumerable.Sequence<T>} items The items to iterate.
 * @param {Function} action The item action.
 * @param {any} [thisArg] The underlying object / value for the item action.
 * 
 * @return {TResult} The result of the last action call.
 */
export async function forEachAsync<T, TResult>(items: Enumerable.Sequence<T>,
                                               action: (item: T, index: number, array: T[]) => TResult | PromiseLike<TResult>,
                                               thisArg?: any) {
    if (!isNullOrUndefined(items)) {
        if (!Array.isArray(items)) {
            items = Enumerable.from(items)
                              .toArray();
        }
    }

    let lastResult: TResult;

    if (action) {
        for (let i = 0; i < (<T[]>items).length; i++) {
            lastResult = await Promise.resolve(
                action.apply(thisArg,
                             [ items[i], i, items ]),
            );
        }
    }

    return lastResult;
}

/**
 * Formats a string.
 * 
 * @param {any} formatStr The value that represents the format string.
 * @param {any[]} [args] The arguments for 'formatStr'.
 * 
 * @return {string} The formated string.
 */
export function format(formatStr: any, ...args: any[]): string {
    return formatArray(formatStr, args);
}

/**
 * Formats a string.
 * 
 * @param {any} formatStr The value that represents the format string.
 * @param {any[]} [args] The arguments for 'formatStr'.
 * 
 * @return {string} The formated string.
 */
export function formatArray(formatStr: any, args: any[]): string {
    if (!args) {
        args = [];
    }

    formatStr = toStringSafe(formatStr);

    // apply arguments in
    // placeholders
    return formatStr.replace(/{(\d+)(\:)?([^}]*)}/g, (match, index, formatSeparator, formatExpr) => {
        index = parseInt(toStringSafe(index).trim());
        
        let resultValue = args[index];

        if (':' === formatSeparator) {
            // collect "format providers"
            let formatProviders = toStringSafe(formatExpr).split(',')
                                                          .map(x => x.toLowerCase().trim())
                                                          .filter(x => x);

            // transform argument by
            // format providers
            formatProviders.forEach(fp => {
                switch (fp) {
                    case 'ending_space':
                        resultValue = toStringSafe(resultValue);
                        if ('' !== resultValue) {
                            resultValue = resultValue + ' ';
                        }
                        break;

                    case 'leading_space':
                        resultValue = toStringSafe(resultValue);
                        if ('' !== resultValue) {
                            resultValue = ' ' + resultValue;
                        }
                        break;

                    case 'lower':
                        resultValue = toStringSafe(resultValue).toLowerCase();
                        break;

                    case 'trim':
                        resultValue = toStringSafe(resultValue).trim();
                        break;

                    case 'upper':
                        resultValue = toStringSafe(resultValue).toUpperCase();
                        break;

                    case 'surround':
                        resultValue = toStringSafe(resultValue);
                        if ('' !== resultValue) {
                            resultValue = "'" + toStringSafe(resultValue) + "'";
                        }
                        break;
                }
            });
        }

        if ('undefined' === typeof resultValue) {
            return match;
        }

        return toStringSafe(resultValue);        
    });
}

/**
 * Returns a mapped path (if possible).
 * 
 * @param {deploy_mappings.FolderMappings} mappings The folder mappings.
 * @param {string} path The path to check. 
 * @param {Minimatch.IOptions} [opts] Custom options.
 * 
 * @return {string|false} The new path or (false) if path could not be mapped.
 */
export function getMappedPath(mappings: deploy_mappings.FolderMappings, path: string,
                              opts?: Minimatch.IOptions): string | false {
    path = toStringSafe(path);
    if (!path.trim().startsWith('/')) {
        path = '/' + path;
    }
    
    if (!opts) {
        opts = {
            dot: true,
            nocase: false,
            nonull: false,
        };
    }

    if (mappings) {
        for (const P in mappings) {
            let pattern = toStringSafe(P);
            if (!pattern.trim().startsWith('/')) {
                pattern = '/' + pattern;
            }

            let entry = mappings[P];
            if (!isObject<deploy_mappings.FolderMappingSettings>(entry)) {
                entry = {
                    to: toStringSafe(entry),
                };
            }

            if (doesMatch(path, pattern, opts)) {
                return toStringSafe(entry.to);
            }
        }
    }
    
    return false;
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
 * Promise version of 'Glob()' function.
 * 
 * @param {string|string[]} patterns One or more patterns.
 * @param {Glob.IOptions} [opts] Custom options.
 * 
 * @return {Promise<string[]>} The promise with the matches.
 */
export async function glob(patterns: string | string[], opts?: Glob.IOptions) {
    const DEFAULT_OPTS: Glob.IOptions = {
        absolute: true,
        dot: false,
        nocase: true,
        nodir: true,
        nonull: false,
        nosort: false,
        sync: false,
    };

    opts = MergeDeep({}, DEFAULT_OPTS, opts);

    const WF = deploy_workflows.build();

    WF.next(() => {
        return [];
    });

    asArray(patterns).forEach(p => {
        WF.next((allMachtes: string[]) => {
            return new Promise<string[]>((res, rej) => {
                const COMP = createCompletedAction(res, rej);

                try {
                    Glob(p, opts, (err, matches) => {
                        if (err) {
                            COMP(err);
                        }
                        else {
                            allMachtes.push
                                      .apply(allMachtes, matches);

                            COMP(null, allMachtes);
                        }
                    });
                }
                catch (e) {
                    COMP(e);
                }
            });
        });
    });

    return Enumerable.from( await WF.start<string[]>() )
                     .select(f => Path.resolve(f))
                     .distinct()
                     .toArray();
}

/**
 * Invokes an action after a timeout.
 * 
 * @param {Function} action The action to invoke. 
 * @param {number} [ms] The custom time, in milliseconds, after the action should be invoked.
 * @param {any[]} [args] One or more arguments for the action.
 * 
 * @return {Promise<TResult>} The promise with the result. 
 */
export function invokeAfter<TResult = any>(action: (...args: any[]) => TResult, ms: number = 1000, ...args: any[]) {
    const ACTION_ARGS = args.filter((x, index) => {
        return index >= 2;
    });

    return new Promise<TResult>((resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);

        try {
            setTimeout(() => {
                try {
                    if (action) {
                        Promise.resolve(
                            action.apply(null, ACTION_ARGS),
                        ).then((result: TResult) => {
                            COMPLETED(null, result);
                        }).catch((err) => {
                            COMPLETED(err);
                        });
                    }
                    else {
                        COMPLETED(null);
                    }
                }
                catch (e) {
                    COMPLETED(e);
                }
            }, ms);
        }
        catch (e) {
            COMPLETED(e);
        }
    });
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

                        deploy_workflows.build().next(async () => {
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
 * Checks if data is binary or text content.
 * 
 * @param {Buffer} data The data to check.
 * 
 * @returns {Promise<boolean>} The promise.
 */
export function isBinaryContent(data: Buffer): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const COMPLETED = createCompletedAction<boolean>(resolve, reject);

        if (!data) {
            COMPLETED(null, <any>data);
            return;
        }

        try {
            IsBinaryFile(data, data.length, (err, result) => {
                if (err) {
                    COMPLETED(err);
                }
                else {
                    COMPLETED(null, toBooleanSafe(result));
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
    return 'boolean' === typeof val;
}

/**
 * Checks if the string representation of a value is empty
 * or contains whitespaces only.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is empty or not.
 */
export function isEmptyString(val: any) {
    return '' === toStringSafe(val).trim();
}

/**
 * Checks if a value is a function or not.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is function or not. 
 */
export function isFunc<TFunc extends Function = Function>(val: any): val is TFunc {
    return 'function' === typeof val;
}

/**
 * Checks if a value is (null) or (undefined).
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is (null)/(undefined) or not.
 */
export function isNullOrUndefined(val: any): boolean {
    return null === val ||
           'undefined' === typeof val;
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
    return 'string' === typeof val;
}

/**
 * Checks if a value is a symbol or not.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is symbol or not. 
 */
export function isSymbol(val: any): val is symbol {
    return 'symbol' === typeof val;
}

/**
 * Loads a module from a script.
 * 
 * @param {string} file The path to the script. 
 * @param {boolean} [fromCache] Cache module or not.
 * 
 * @return {TModule} The loaded module.
 */
export function loadModule<TModule = any>(file: string, fromCache = false): TModule {
    file = toStringSafe(file);
    if (isEmptyString(file)) {
        file = './module.js';
    }
    if (!Path.isAbsolute(file)) {
        file = Path.join(process.cwd(), file);
    }
    file = Path.resolve(file);

    fromCache = toBooleanSafe(fromCache);

    if (!fromCache) {
        delete require.cache[file];
    }

    return require(file);
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
 * Clones an object and makes it non disposable.
 * 
 * @param {TObj} obj The object to clone.
 * @param {boolean} [throwOnDispose] Throw error when coll 'dispose()' method or not.
 * 
 * @return {TObj} The cloned object. 
 */
export function makeNonDisposable<TObj extends { dispose: () => any }>(
    obj: TObj,
    throwOnDispose = true,
): TObj {
    throwOnDispose = toBooleanSafe(throwOnDispose, true);

    const CLONED_OBJ: any = cloneObjectFlat(obj);
    if (CLONED_OBJ) {
        if (isFunc(CLONED_OBJ.dispose)) {
            CLONED_OBJ.dispose = () => {
                if (throwOnDispose) {
                    throw new Error(i18.t('disposeNotAllowed'));
                }
            };
        }
    }

    return CLONED_OBJ;
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
 * Normalizes a value as string so that is comparable.
 * 
 * @param {any} val The value to convert.
 * @param {(str: string) => string} [normalizer] The custom normalizer.
 * 
 * @return {string} The normalized value.
 */
export function normalizeString(val: any, normalizer?: (str: string) => string): string {
    if (!normalizer) {
        normalizer = (str) => str.toLowerCase().trim();
    }

    return normalizer(toStringSafe(val));
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
 * Reads the content of a stream.
 * 
 * @param {Stream.Readable} stream The stream.
 * 
 * @returns {Promise<Buffer>} The promise with the content.
 */
export function readAll(stream: Stream.Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        let buff: Buffer;
    
        let dataListener: (chunk: Buffer | string) => void;

        let completedInvoked = false;
        const COMPLETED = (err: any) => {
            if (completedInvoked) {
                return;
            }
            completedInvoked = true;

            if (dataListener) {
                try {
                    stream.removeListener('data', dataListener);
                }
                catch (e) { 
                    deploy_log.CONSOLE
                              .trace(e, 'helpers.readAll()');
                }
            }

            if (err) {
                reject(err);
            }
            else {
                resolve(buff);
            }
        };

        if (!stream) {
            COMPLETED(null);
            return;
        }

        stream.once('error', (err) => {
            if (err) {
                COMPLETED(err);
            }
        });

        dataListener = (chunk: Buffer | string) => {
            try {
                if (chunk && chunk.length > 0) {
                    if ('string' === typeof chunk) {
                        chunk = new Buffer(chunk);
                    }

                    buff = Buffer.concat([ buff, chunk ]);
                }
            }
            catch (e) {
                COMPLETED(e);
            }
        };

        try {
            buff = Buffer.alloc(0);

            stream.on('data', dataListener);

            stream.once('end', () => {
                COMPLETED(null);
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
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

        stream.once('error', (err) => {;
            COMPLETED(err);
        });

        try {
            const DATA = await invokeForTempFile((tmpFile) => {
                return new Promise<Buffer>((res, rej) => {
                    const COMP = createCompletedAction(res, rej);

                    try {
                        const PIPE = stream.pipe( FS.createWriteStream(tmpFile) );

                        PIPE.once('error', (err) => {;
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
        return await vscode.window.showErrorMessage
                                  .apply(null, [ <any>`[vscode-deploy-reloaded] ${msg}`.trim() ].concat(items));
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
        return await vscode.window.showInformationMessage
                                  .apply(null, [ <any>`[vscode-deploy-reloaded] ${msg}`.trim() ].concat(items));
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
        return await vscode.window.showWarningMessage
                                  .apply(null, [ <any>`[vscode-deploy-reloaded] ${msg}`.trim() ].concat(items));
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'helpers.showWarningMessage()');
    }
}

/**
 * Waits a number of milliseconds.
 * 
 * @param {number} [ms] The custom time, in milliseconds, to wait.
 */
export async function sleep(ms = 1000) {
    await invokeAfter(() => {}, ms);
}

/**
 * Returns an array like object as new array.
 * 
 * @param {ArrayLike<T>} arr The input object. 
 * @param {boolean} [normalize] Returns an empty array, if input object is (null) / undefined.
 * 
 * @return {T[]} The input object as array. 
 */
export function toArray<T>(arr: ArrayLike<T>, normalize = true): T[] {
    if (isNullOrUndefined(arr)) {
        if (toBooleanSafe(normalize, true)) {
            return [];
        }
        
        return <any>arr;
    }

    const NEW_ARRAY: T[] = [];
    for (let i = 0; i < arr.length; i++) {
        NEW_ARRAY.push(arr[i]);
    }

    return NEW_ARRAY;
}

/**
 * Converts a value to a boolean.
 * 
 * @param {any} val The value to convert.
 * @param {any} defaultValue The value to return if 'val' is (null) or (undefined).
 * 
 * @return {boolean} The converted value.
 */
export function toBooleanSafe(val: any, defaultValue: any = false): boolean {
    if ('boolean' === typeof val) {
        return val;
    }

    if (isNullOrUndefined(val)) {
        return defaultValue;
    }

    return !!val;
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
    filter = cloneObject(filter);
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
 * Converts a value to a string that is NOT (null) or (undefined).
 * 
 * @param {any} str The input value.
 * @param {any} defValue The default value.
 * 
 * @return {string} The output value.
 */
export function toStringSafe(str: any, defValue: any = ''): string {
    if ('string' === typeof str) {
        return str;
    }

    if (isNullOrUndefined(str)) {
        return defValue;
    }

    try {
        if (str instanceof Error) {
            return str.message;
        }
    
        if (isFunc(str['toString'])) {
            return '' + str.toString();
        }

        try {
            if (Array.isArray(str) || isObject(str)) {
                return JSON.stringify(str);
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'helpers.toStringSafe(2)');
        }

        return '' + str;
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'helpers.toStringSafe(1)');

        return typeof str;
    }
}

/**
 * Tries to clear a timeout.
 * 
 * @param {NodeJS.Timer} timeoutId The timeout (ID).
 * 
 * @return {boolean} Operation was successfull or not.
 */
export function tryClearTimeout(timeoutId: NodeJS.Timer): boolean {
    try {
        if (!isNullOrUndefined(timeoutId)) {
            clearTimeout(timeoutId);
        }

        return true;
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'helpers.tryClearTimeout()');

        return false;
    }
}

/**
 * Tries to dispose an object.
 * 
 * @param {object} obj The object to dispose.
 * 
 * @return {boolean} Operation was successful or not.
 */
export function tryDispose(obj: { dispose?: () => any }): boolean {
    try {
        if (obj && obj.dispose) {
            obj.dispose();
        }

        return true;
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'helpers.tryDispose()');

        return false;
    }
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
                                                                           toStringSafe(decodeURIComponent(n[1])), this}
                          .bind({}))[0];
    }

    return params || {};
}

/**
 * Waits while a predicate matches.
 * 
 * @param {Function} predicate The predicate. 
 */
export async function waitWhile(predicate: () => boolean | PromiseLike<boolean>) {
    if (!predicate) {
        return;
    }

    let wait: boolean;
    do
    {
        wait = await Promise.resolve(
            predicate()
        );
    }
    while ( toBooleanSafe(wait) )
}

/**
 * Runs a task with progress information.
 * 
 * @param {ProgressTask<TResult>} task The task to execute.
 * @param {ProgressOptions} [options] Additional options.
 * 
 * @return {Promise<TResult>} The promise with the result.
 */
export async function withProgress<TResult = any>(task: ProgressTask<TResult>,
                                                  options?: ProgressOptions): Promise<TResult> {
    if (!options) {
        options = {};
    }

    const OPTS: vscode.ProgressOptions = {
        location: isNullOrUndefined(options.location) ? vscode.ProgressLocation.Window : options.location,
        title: toStringSafe(options.title),
    };

    return await vscode.window.withProgress(OPTS, async (p) => {
        const CTX: ProgressContext = {
            message: undefined,
        };

        // CTX.message
        let msg: string;
        Object.defineProperty(CTX, 'message', {
            enumerable: true,

            get: () => {
                return msg;
            },

            set: (newValue) => {
                if (!isNullOrUndefined(newValue)) {
                    newValue = toStringSafe(newValue);
                }

                p.report({
                    message: newValue,
                });

                msg = newValue;
            }
        });
        
        if (task) {
            return await Promise.resolve(
                task(CTX)
            );
        }
    });
}
