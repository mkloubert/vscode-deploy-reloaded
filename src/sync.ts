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
import * as deploy_log from './log';
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_targets from './targets';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as Moment from 'moment';
import * as Path from 'path';
import * as vscode from 'vscode';


interface TargetAndLastModifiedTime {
    target: deploy_targets.Target;
    time: Moment.Moment;
}


/**
 * Synchronizes a document after it has been opened.
 * 
 * @param {vscode.TextDocument} doc The document.
 */
export async function syncDocumentWhenOpen(doc: vscode.TextDocument) {
    const ME: deploy_workspaces.Workspace = this;

    if (ME.isInFinalizeState) {
        return;
    }

    if (!doc) {
        return;
    }

    const FILE = Path.resolve(
        doc.fileName
    );
    if (ME.isFileIgnored(FILE)) {
        return;
    }

    const FILENAME = Path.basename(FILE);
    const DIR = ME.toRelativePath(
        Path.dirname(FILE)
    );
    if (false === DIR) {
        return;
    }

    const STATES = ME.syncWhenOpenStates;
    const STATS = await deploy_helpers.lstat(FILE);

    const LAST_CFG_UPDATE = deploy_helpers.asUTC(ME.lastConfigUpdate);
    const START_TIME = deploy_helpers.asUTC(ME.startTime);

    if (!LAST_CFG_UPDATE || !START_TIME) {
        return;
    }

    const TARGETS = await deploy_helpers.applyFuncFor(
        deploy_packages.findTargetsForFileOfPackage, ME
    )(FILE,
      (pkg) => pkg.syncWhenOpen,
      (pkg) => {
          return deploy_packages.getFastFileCheckFlag(
              pkg, (p) => p.fastCheckOnSync,
              ME.config, (c) => c.fastCheckOnSync,
          );
      });

    if (false === TARGETS) {
        return;
    }

    if (TARGETS.length < 1) {
        return;
    }

    let targetWithNewestFile: TargetAndLastModifiedTime;

    for (const T of Enumerable.from(TARGETS).distinct(true)) {
        const SHOW_ERROR = (err: any) => {
            ME.showErrorMessage(
                err
            );
        };

        try {
            const KEY = <string>ME.getSyncWhenOpenKey(T);

            const PLUGINS = ME.getListPlugins(T);
            while (PLUGINS.length > 0) {
                const PI = PLUGINS.shift();

                const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();
                try {
                    const CTX: deploy_plugins.ListDirectoryContext = {
                        cancellationToken: CANCELLATION_SOURCE.token,
                        dir: DIR,
                        isCancelling: undefined,
                        target: T,
                        workspace: ME,
                    };

                    // CTX.isCancelling
                    Object.defineProperty(CTX, 'isCancelling', {
                        enumerable: true,

                        get: () => {
                            return CTX.cancellationToken.isCancellationRequested;
                        }
                    });

                    const LIST = await PI.listDirectory(CTX);
                    if (!LIST) {
                        continue;
                    }

                    const MATCHING_FILES = Enumerable.from(LIST.files).where(f => {
                        return deploy_helpers.isObject(f) &&
                                FILENAME === deploy_helpers.toStringSafe(f.name);
                    }).toArray();

                    let allFailed: boolean | null = null;
                    for (const F of MATCHING_FILES) {
                        if (null === allFailed) {
                            allFailed = true;
                        }

                        try {
                            const LAST_CHECK = STATES[KEY];
                            const LOCAL_UTC = deploy_helpers.asUTC(STATS.mtime);
                            const REMOTE_UTC = deploy_helpers.asUTC(F.time);

                            let remoteIsNewer = false;

                            let check = false;
                            if (LAST_CHECK) {
                                check = LAST_CHECK.isBefore(LAST_CFG_UPDATE);
                            }
                            else {
                                check = true;
                            }

                            if (check) {
                                if (REMOTE_UTC && REMOTE_UTC.isValid()) {
                                    remoteIsNewer = REMOTE_UTC.isAfter(LOCAL_UTC);
                                }
                            }

                            if (remoteIsNewer) {
                                let addNewer = true;
                                if (targetWithNewestFile) {
                                    addNewer = REMOTE_UTC.isAfter(targetWithNewestFile.time);
                                }

                                if (addNewer) {
                                    targetWithNewestFile = {
                                        target: T,
                                        time: REMOTE_UTC,
                                    };
                                }
                            }
                            
                            allFailed = false;
                        }
                        catch (e) {
                            deploy_log.CONSOLE
                                        .log(e, 'sync.syncDocumentWhenOpen()');
                        }
                    }

                    if (true === allFailed) {
                        throw new Error(ME.t('sync.whenOpen.errors.allFailed'));
                    }
                }
                catch (e) {
                    SHOW_ERROR(e);
                }
                finally {
                    deploy_helpers.tryDispose(CANCELLATION_SOURCE);
                }
            }
        }
        catch (e) {
            SHOW_ERROR(e);
        }
    }

    if (targetWithNewestFile) {
        const TARGET = targetWithNewestFile.target;
        const KEY = ME.getSyncWhenOpenKey(TARGET);

        if (false !== KEY) {
            await ME.pullFileFrom(FILE, TARGET);
            
            STATES[KEY] = Moment();
        }
    }
}
