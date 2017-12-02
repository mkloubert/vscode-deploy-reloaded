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

import * as deploy_code from './code';
import * as deploy_contracts from './contracts';
import * as deploy_log from './log';
import * as Enumerable from 'node-enumerable';
import * as FS from 'fs';
import * as Glob from 'glob';
const MergeDeep = require('merge-deep');
import * as MimeTypes from 'mime-types';
import * as Minimatch from 'minimatch';
import * as Moment from 'moment';
import * as Path from 'path';
import * as TMP from 'tmp';
import * as vscode from 'vscode';
import * as Workflows from 'node-workflows';


/**
 * Options for 'invokeForTempFile' function.
 */
export interface InvokeForTempFileOptions {
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
 * Returns a value as array.
 * 
 * @param {T|T[]} val The value.
 * @param {boolean} [removeEmpty] Remove items that are (null)/(undefined) or not.
 * 
 * @return {T[]} The value as array.
 */
export function asArray<T>(val: T | T[], removeEmpty = true): T[] {
    return (Array.isArray(val) ? val : [ val ]).filter(i => {
        if (removeEmpty) {
            return null !== i &&
                   'undefined' !== typeof i;
        }

        return true;
    });
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
        nonull: true,
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

    const THIS_ARGS: any = useNewObjectForFunctions ? CLONED_OBJ : val;

    for (let P in val) {
        let valueToSet: any = val[P];
        if (isFunc(valueToSet)) {
            const FUNC = valueToSet;
            
            valueToSet = function() {
                return FUNC.apply(THIS_ARGS, arguments);
            };
        }

        CLONED_OBJ[P] = valueToSet;
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
                    return deploy_code.executeCode( CONDITION );
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
 * Promise version of 'Glob()' function.
 * 
 * @param {string|string[]} patterns One or more patterns.
 * @param {Glob.IOptions} [opts] Custom options.
 * 
 * @return {Promise<string[]>} The promise with the matches.
 */
export function glob(patterns: string | string[], opts?: Glob.IOptions) {
    const DEFAULT_OPTS: Glob.IOptions = {
        absolute: true,
        dot: false,
        nocase: true,
        nodir: true,
        nonull: true,
        nosort: false,
        sync: false,
    };

    opts = MergeDeep({}, DEFAULT_OPTS, opts);

    return new Promise<string[]>(async (resolve, reject) => {
        const COMPLETED = createCompletedAction(resolve, reject);
        
        try {
            const WF = Workflows.create();

            WF.next((ctx) => {
                ctx.result = [];
            });

            asArray(patterns).forEach(p => {
                WF.next((ctx) => {
                    const ALL_MATCHES: string[] = ctx.result;

                    return new Promise<void>((res, rej) => {
                        const COMP = createCompletedAction(res, rej);

                        try {
                            Glob(p, opts, (err, matches) => {
                                if (err) {
                                    COMP(err);
                                }
                                else {
                                    ALL_MATCHES.push
                                               .apply(ALL_MATCHES, matches);

                                    COMP(null);
                                }
                            });
                        }
                        catch (e) {
                            COMP(e);
                        }
                    });
                });
            });

            COMPLETED(null,
                      Enumerable.from( <string[]>(await WF.start()) )
                                .select(f => Path.resolve(f))
                                .distinct()
                                .toArray());
        }
        catch (e) {
            COMPLETED(e);
        }
    });
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
                    tempFile = tf;

                    try {
                        if (action) {
                            Promise.resolve( action(tf) ).then((result) => {
                                COMPLETED(null, result);
                            }).catch((e) => {
                                COMPLETED(e);
                            });
                        }
                        else {
                            COMPLETED(null);
                        }
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
    return 'boolean' === typeof val;
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
    return !Array.isArray(val) &&
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
    try {
        if ('string' === typeof str) {
            return str;
        }

        if (isNullOrUndefined(str)) {
            return defValue;
        }

        return '' + str;
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'helpers.toStringSafe()');

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
