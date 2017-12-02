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

import * as deploy_helpers from './helpers';
import * as Events from 'events';
import * as Moment from 'moment';
import * as vscode from 'vscode';


/**
 * A log action.
 * 
 * @param {LogContext} context The log context.
 */
export type LogAction = (context: LogContext) => any;

/**
 * A log context.
 */
export interface LogContext {
    /**
     * The message.
     */
    readonly message: any;
    /**
     * The tag.
     */
    readonly tag?: string;
    /**
     * The time.
     */
    readonly time: Moment.Moment;
    /**
     * The type.
     */
    readonly type?: LogType;
}

/**
 * A log filter.
 */
export type LogFilter = (context: LogContext) => any;

/**
 * A logger.
 */
export interface Logger extends NodeJS.EventEmitter, vscode.Disposable {
    /**
     * Logs an alert message.
     */
    readonly alert: TypedLogAction;
    /**
     * Logs a critical message.
     */
    readonly crit: TypedLogAction;
    /**
     * Logs a debug message.
     */
    readonly debug: TypedLogAction;
    /**
     * Logs an emergency message.
     */
    readonly emerg: TypedLogAction;
    /**
     * Logs an error message.
     */
    readonly err: TypedLogAction;
    /**
     * Logs an info message.
     */
    readonly info: TypedLogAction;
    /**
     * Logs a message.
     * 
     * @param {LogType} The type.
     * @param {any} msg The message to log.
     * @param {string} [tag] The additional tag.
     */
    readonly log: (type: LogType,
                   msg: any, tag?: string) => PromiseLike<void> | void;
    /**
     * Logs a note message.
     */
    readonly notice: TypedLogAction;
    /**
     * Logs a trace message.
     */
    readonly trace: TypedLogAction;
    /**
     * Logs a warning message.
     */
    readonly warn: TypedLogAction;
}

/**
 * A typed log action.
 * 
 * @param {any} msg The message to log.
 * @param {string} [tag] An additional, optional tag.
 */
export type TypedLogAction = (msg: any, tag?: string) => void;


/**
 * List of log types.
 */
export enum LogType {
    /**
     * Emergency
     */
    Emerg = 0,
    /**
     * Alert
     */
    Alert = 1,
    /**
     * Critical
     */
    Crit = 2,
    /**
     * Error
     */
    Err = 3,
    /**
     * Warning
     */
    Warn = 4,
    /**
     * Notice
     */
    Notice = 5,
    /**
     * Informational
     */
    Info = 6,
    /**
     * Debug
     */
    Debug = 7,
    /**
     * Trace
     */
    Trace = 8,
}

/**
 * A basic logger.
 */
export abstract class LoggerBase extends Events.EventEmitter implements Logger {
    /** @inheritdoc */
    public alert(msg: any, tag?: string) {
        this.log(LogType.Alert,
                 msg, tag);
    }

    /** @inheritdoc */
    public crit(msg: any, tag?: string) {
        this.log(LogType.Crit,
                 msg, tag);
    }

    /** @inheritdoc */
    public debug(msg: any, tag?: string) {
        this.log(LogType.Debug,
                 msg, tag);
    }

    /** @inheritdoc */
    public dispose() {
    }

    /** @inheritdoc */
    public emerg(msg: any, tag?: string) {
        this.log(LogType.Emerg,
                 msg, tag);
    }

    /** @inheritdoc */
    public err(msg: any, tag?: string) {
        this.log(LogType.Err,
                 msg, tag);
    }

    /** @inheritdoc */
    public info(msg: any, tag?: string) {
        this.log(LogType.Info,
                 msg, tag);
    }

    /** @inheritdoc */
    public async log(type: LogType, msg: any, tag?: string) {
        const CONTEXT: LogContext = {
            message: msg,
            tag: this.normalizeTag(tag),
            time: Moment(),
            type: type,
        };

        const RAISE_EVENT = await Promise.resolve(
            deploy_helpers.toBooleanSafe(await this.onLog(CONTEXT),
                                         true),
        );

        if (RAISE_EVENT) {
            this.emit('log',
                      CONTEXT);
        }
    }

    /**
     * Normalizes a tag value.
     * 
     * @param {string} tag The input value.
     * 
     * @return {string} The output value. 
     */
    protected normalizeTag(tag: string): string {
        tag = deploy_helpers.normalizeString(tag, s => s.toUpperCase().trim());
        if ('' === tag) {
            tag = undefined;
        }

        return tag;
    }

    /** @inheritdoc */
    public notice(msg: any, tag?: string) {
        this.log(LogType.Notice,
                 msg, tag);
    }

    /**
     * The logic for logging a message.
     * 
     * @param {LogContext} context The context.
     * 
     * @return {Promise<any>} Invoke log event or not.
     */
    protected abstract async onLog(context: LogContext): Promise<any>;

    /** @inheritdoc */
    public trace(msg: any, tag?: string) {
        this.log(LogType.Trace,
                 msg, tag);
    }

    /** @inheritdoc */
    public warn(msg: any, tag?: string) {
        this.log(LogType.Warn,
                 msg, tag);
    }
}

/**
 * A logger based on actions.
 */
export class ActionLogger extends LoggerBase {
    private _actions: LogAction[] = [];
    private _filters: LogFilter[] = [];
    
    /**
     * Adds a new action.
     * 
     * @param {LogAction} action The action to add.
     * 
     * @chainable
     */
    public addAction(action: LogAction): this {
        if (action) {
            this._actions
                .push(action);
        }
        
        return this;
    }

    /**
     * Adds a new filter.
     * 
     * @param {LogFilter} filter The filter to add.
     * 
     * @chainable
     */
    public addFilter(filter: LogFilter): this {
        if (filter) {
            this._filters
                .push(filter);
        }

        return this;
    }

    /**
     * Clears anything of that logger.
     * 
     * @chainable
     */
    public clear(): this {
        return this.clearActions()
                   .clearFilters();
    }

    /**
     * Clears the action list.
     * 
     * @chainable
     */
    public clearActions(): this {
        if (this._actions) {
            this._actions = [];
        }

        return this;
    }

    /**
     * Clears the filter list.
     * 
     * @chainable
     */
    public clearFilters(): this {
        if (this._filters) {
            this._filters = [];
        }

        return this;
    }

    /** @inheritdoc */
    public dispose() {
        this._actions = null;
    }

    /** @inheritdoc */
    protected async onLog(context: LogContext) {
        const ACTIONS = this._actions || [];
        const FILTERS = this._filters || [];
        
        for (let i = 0; i < ACTIONS.length; i++) {
            try {
                const LOG_ACTION = ACTIONS[i];

                let doLog = true;
                for (let j = 0; j < FILTERS.length; j++) {
                    try {
                        const LOG_FILTER = FILTERS[j];

                        doLog = deploy_helpers.toBooleanSafe(
                            await Promise.resolve(
                                LOG_FILTER(context)
                            ), true
                        );
                    }
                    catch (e) {
                        // ignore    
                    }

                    if (!doLog) {
                        break;
                    }
                }

                if (doLog) {
                    LOG_ACTION(context);
                }
            }
            catch (e) {
                // ignore    
            }
        }
    }
}

const NEW_CONSOLE_LOGGER = new ActionLogger();
NEW_CONSOLE_LOGGER.addAction((ctx) => {
    let msg = deploy_helpers.toStringSafe(ctx.message);

    let func: (message?: any, ...optionalParams: any[]) => void = console.log;

    if (ctx.type <= LogType.Err) {
        func = console.error;
    }
    else {
        switch (ctx.type) {
            case LogType.Info:
            case LogType.Notice:
                func = console.info;
                break;

            case LogType.Trace:
                func = console.trace;
                break;

            case LogType.Warn:
                func = console.warn;
                break;
        }
    }

    let typePrefix = '';

    let tagPrefix = '';
    if (!deploy_helpers.isEmptyString(ctx.tag)) {
        tagPrefix = ' :: ' + deploy_helpers.normalizeString(ctx.tag);
    }

    msg = `[vscode-deploy-reloaded]\n[${ctx.time.format('YYYY-MM-DD HH:mm:ss')}${typePrefix}${tagPrefix}] => ${msg}\n`;

    func.apply(console,
               [ msg ]);
});

/**
 * The global console logger.
 */
export const CONSOLE: Logger = NEW_CONSOLE_LOGGER;
