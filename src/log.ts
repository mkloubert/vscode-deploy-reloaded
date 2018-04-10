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
import * as deploy_helpers from './helpers';
import * as FS from 'fs';
import * as FSExtra from 'fs-extra';
import * as i18 from './i18';
import * as Moment from 'moment';
import * as OS from 'os';
import * as Path from 'path';
import * as vscode from 'vscode';
import * as vscode_helpers from 'vscode-helpers';

export { ActionLogger, Logger } from 'vscode-helpers';

interface LogFile {
    mtime: Moment.Moment;
    path: string;    
}

const NEW_CONSOLE_LOGGER = vscode_helpers.createLogger();
// write to console
NEW_CONSOLE_LOGGER.addAction((ctx) => {
    let msg = deploy_helpers.toStringSafe(ctx.message);

    let func: (message?: any, ...optionalParams: any[]) => void = console.log;

    if (ctx.type <= vscode_helpers.LogType.Err) {
        func = console.error;
    }
    else {
        switch (ctx.type) {
            case vscode_helpers.LogType.Info:
            case vscode_helpers.LogType.Notice:
                func = console.info;
                break;

            case vscode_helpers.LogType.Trace:
                func = console.trace;
                break;

            case vscode_helpers.LogType.Warn:
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
        logType = vscode_helpers.LogType.Debug;
    }

    let time = ctx.time;
    if (!Moment.isMoment(time)) {
        time = Moment.utc();
    }
    time = deploy_helpers.asUTC(time);

    if (vscode_helpers.LogType.Trace !== ctx.type) {
        if (ctx.type > vscode_helpers.LogType.Info) {
            return;
        }    
    }

    let msg = `${vscode_helpers.LogType[logType].toUpperCase().trim()}`;

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
    if (vscode_helpers.LogType.Trace === ctx.type) {
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
export const CONSOLE: vscode_helpers.Logger = NEW_CONSOLE_LOGGER;

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

async function openLogFile() {
    let logFilePaths: string[];

    const LOGS_DIR = deploy_helpers.getExtensionLogDirInHome();
    if (await deploy_helpers.isDirectory(LOGS_DIR)) {
        logFilePaths = await deploy_helpers.glob('/*.log', {
            cwd: LOGS_DIR,
            root: LOGS_DIR,
        });
    }

    logFilePaths = deploy_helpers.asArray(logFilePaths);    

    let logFiles: LogFile[] = [];
    for (const LFP of logFilePaths) {
        try {
            const STATS = await FSExtra.lstat(LFP);

            const F: LogFile = {
                mtime: deploy_helpers.asUTC( STATS.mtime ),
                path: LFP,
            };

            logFiles.push(F);
        }
        catch (e) {
            CONSOLE.trace(e, 'log.openLogFile(1)');
        }
    }

    logFiles = deploy_helpers.from(logFiles).orderByDescending(lf => {
        return lf.mtime.unix();
    }).thenBy(lf => {
        return deploy_helpers.normalizeString( Path.basename(lf.path) );
    }).thenBy(lf => {
        return deploy_helpers.normalizeString( Path.dirname(lf.path) );
    }).toArray();

    const ITEMS: deploy_contracts.ActionQuickPick[] = logFiles.map(lf => {
        return {
            action: async () => {
                await vscode.window.showTextDocument(
                    await vscode.workspace.openTextDocument(lf.path)
                );
            },
            description: lf.mtime.format( i18.t('time.dateTimeWithSeconds') ),
            detail: Path.dirname(lf.path),
            label: '$(file-text)  ' + Path.basename(lf.path),
        };
    });

    if (ITEMS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('log.noFileFound'),
        );

        return;
    }

    let selectedItem: deploy_contracts.ActionQuickPick;
    if (1 === ITEMS.length) {
        selectedItem = ITEMS[0];
    }
    else {
        selectedItem = await vscode.window.showQuickPick(
            ITEMS,
            {
                placeHolder: i18.t('log.selectLogFile'),
            }
        );
    }

    if (selectedItem) {
        await selectedItem.action();
    }
}

/**
 * Registers commands for log (file) operations.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function registerLogCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.deploy.reloaded.logFiles', async () => {
            try {
                await openLogFile();
            }
            catch (e) {
                CONSOLE.trace(e, 'extension.deploy.reloaded.logFiles');

                deploy_helpers.showErrorMessage(
                    i18.t('error', e)
                );
            }
        }),
    );
}
