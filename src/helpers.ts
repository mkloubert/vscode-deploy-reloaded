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

import * as deploy_log from './log';
import * as Enumerable from 'node-enumerable';
import * as FS from 'fs';
import * as Glob from 'glob';
import * as vscode from 'vscode';
import * as Workflows from 'node-workflows';


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
 * Promise version of 'Glob()' function.
 * 
 * @param {string|string[]} patterns One or more patterns.
 * @param {Glob.IOptions} [opts] Custom options.
 * 
 * @return {Promise<string[]>} The promise with the matches.
 */
export function glob(patterns: string | string[], opts?: Glob.IOptions) {
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
 * Promise version of 'FS.readFile()' function.
 * 
 * @param {string|Buffer} path The path.
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
 * Promise (and safe) version of 'vscode.window.showErrorMessage()' function.
 * 
 * @param {string} msg The message to display.
 * @param {TItem[]} [items] The optional items.
 */
export async function showErrorMessage<TItem extends vscode.MessageItem = vscode.MessageItem>(msg: string, ...items: TItem[]) {
    try {
        await vscode.window.showErrorMessage
                           .apply(null, [ <any>`[vscode-deploy-reloaded] ${msg}`.trim() ].concat(items));
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'helpers.showErrorMessage()');
    }
}

/**
 * Promise (and safe) version of 'vscode.window.showWarningMessage()' function.
 * 
 * @param {string} msg The message to display.
 * @param {TItem[]} [items] The optional items.
 */
export async function showWarningMessage<TItem extends vscode.MessageItem = vscode.MessageItem>(msg: string, ...items: TItem[]) {
    try {
        await vscode.window.showWarningMessage
                           .apply(null, [ <any>`[vscode-deploy-reloaded] ${msg}`.trim() ].concat(items));
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'helpers.showWarningMessage()');
    }
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
    if (isNullOrUndefined(val)) {
        return defaultValue;
    }

    return !!val;
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

        return '';
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
