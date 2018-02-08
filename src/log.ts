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
import * as deploy_helpers from './helpers';
import * as Events from 'events';
import * as FS from 'fs';
import * as FSExtra from 'fs-extra';
import * as Moment from 'moment';
import * as OS from 'os';
import * as Path from 'path';
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
// write to console
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
// write to file inside home directory
NEW_CONSOLE_LOGGER.addAction((ctx) => {
    const LOGS_DIR = deploy_helpers.getExtensionLogDirInHome();
    if (!FS.existsSync(LOGS_DIR)) {
        FSExtra.mkdirsSync(LOGS_DIR);
    }

    let logType = ctx.type;
    if (_.isNil(logType)) {
        logType = LogType.Debug;
    }

    let time = ctx.time;
    if (!Moment.isMoment(time)) {
        time = Moment.utc();
    }
    time = deploy_helpers.asUTC(time);

    if (LogType.Trace !== ctx.type) {
        if (ctx.type > LogType.Info) {
            return;
        }    
    }

    let msg = `${LogType[logType].toUpperCase().trim()}`;

    const TAG = deploy_helpers.normalizeString(
        _.replace(
            deploy_helpers.normalizeString(ctx.tag),
            /\s/ig,
            '_'
        )
    );
    if ('' !== TAG) {
        msg += ' ' + TAG;
    }

    let logMsg = deploy_helpers.toStringSafe(ctx.message);
    if (LogType.Trace === ctx.type) {
        const STACK = deploy_helpers.toStringSafe(
            (new Error()).stack
        ).split("\n").filter(l => {
            return l.toLowerCase()
                    .trim()
                    .startsWith('at ');
        }).join("\n");

        logMsg += `\n\nStack:\n${STACK}`;
    }

    msg += ` - [${time.format('DD/MMM/YYYY:HH:mm:ss')} +0000] "${
        _.replace(logMsg, /"/ig, '\\"')
    }"${OS.EOL}`;
    
    const LOG_FILE = Path.resolve(
        Path.join(
            LOGS_DIR,
            `${time.format('YYYYMMDD')}.log`
        )
    );

    FS.appendFileSync(LOG_FILE, msg, 'utf8');
});


/**
 * The global console logger.
 */
export const CONSOLE: Logger = NEW_CONSOLE_LOGGER;

/**
 * Removes all old log files in the home directory.
 * 
 * @param {number} [maxLifeTime] The maximum lifetime of a log file in days. Default: 30
 */
export async function cleanupLogFilesInHomeDirectory(maxLifeTime?: number) {
    maxLifeTime = parseFloat(deploy_helpers.toStringSafe(maxLifeTime).trim());
    if (isNaN(maxLifeTime)) {
        maxLifeTime = 31;
    }
    if (maxLifeTime <= 0) {
        maxLifeTime = 1;
    }

    const NOW = Moment.utc();    

    const LOGS_DIR = deploy_helpers.getExtensionLogDirInHome();
    if (!(await deploy_helpers.exists(LOGS_DIR))) {
        return;
    }

    const LOG_FILES = await deploy_helpers.glob('/*.log', {
        cwd: LOGS_DIR,
        root: LOGS_DIR,        
    });

    for (const LF of LOG_FILES) {
        try {
            const STATS = await deploy_helpers.lstat(LF);
            if (!STATS.isFile()) {
                continue;
            }

            const MTIME = deploy_helpers.asUTC(
                STATS.mtime
            );

            if (NOW.diff(MTIME, 'days', true) > maxLifeTime) {
                await deploy_helpers.unlink(LF);  // too old
            }
        }
        catch (e) { /* ignore */ }
    }
}
