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

import * as deploy_contracts from './contracts';
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


/**
 * Synchronizes a document after it has been opened.
 * 
 * @param {vscode.TextDocument} doc The document.
 */
export async function syncDocumentWhenOpen(doc: vscode.TextDocument) {
    const ME: deploy_workspaces.Workspace = this;

    if (!doc) {
        return;
    }

    const FILE = Path.resolve(
        doc.fileName
    );
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

    const KNOWN_TARGETS = ME.getTargets();
    const TARGETS: deploy_targets.Target[] = [];

    for (const PKG of ME.getPackages()) {
        const SYNC_WHEN_OPEN = PKG.syncWhenOpen;
        if (deploy_helpers.isNullOrUndefined(PKG.syncWhenOpen)) {
            continue;
        }

        let filter: deploy_contracts.FileFilter;
        let targetNames: string | string[] | false = false;
        let useMinimatch = false;

        if (deploy_helpers.isObject<deploy_packages.SyncWhenOpenSetting>(SYNC_WHEN_OPEN)) {
            filter = SYNC_WHEN_OPEN;
            targetNames = PKG.targets;
            useMinimatch = true;
        }
        else if (deploy_helpers.isBool(SYNC_WHEN_OPEN)) {
            if (true === SYNC_WHEN_OPEN) {
                filter = PKG;
                targetNames = PKG.targets;
            }
        }
        else {
            filter = PKG;
            targetNames = SYNC_WHEN_OPEN;
        }

        if (false === targetNames) {
            continue;
        }

        let fileList: string[];
        if (useMinimatch) {
            // filter all files of that package
            // by 'minimatch'
            fileList = (await ME.findFilesByFilter(PKG)).filter(f => {
                let relPath = ME.toRelativePath(f);
                if (false !== relPath) {
                    return deploy_helpers.checkIfDoesMatchByFileFilter('/' + relPath,
                                                                       deploy_helpers.toMinimatchFileFilter(filter));
                }

                return false;
            });
        }
        else {
            fileList = await ME.findFilesByFilter(filter);
        }

        const MATCHING_TARGETS = deploy_targets.getTargetsByName(
            targetNames,
            KNOWN_TARGETS
        );
        if (false === MATCHING_TARGETS) {
            return;
        }

        const DOES_MATCH = Enumerable.from( fileList ).select(f => {
            return Path.resolve(f);
        }).contains(FILE);

        if (DOES_MATCH) {
            TARGETS.push
                   .apply(TARGETS, MATCHING_TARGETS);
        }
    }

    if (TARGETS.length < 1) {
        return;
    }

    interface TargetAndLastModifiedTime {
        target: deploy_targets.Target;
        time: Moment.Moment;
    };

    let targetWithNewestFile: TargetAndLastModifiedTime;

    await deploy_helpers.forEachAsync(Enumerable.from(TARGETS)
                                                .distinct(true),
            async (t) => {
                const SHOW_ERROR = (err: any) => {
                    //TODO
                };

                try {
                    const KEY = <string>ME.getSyncWhenOpenKey(t);

                    const PLUGINS = ME.getListPlugins(t);
                    while (PLUGINS.length > 0) {
                        const PI = PLUGINS.shift();

                        const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();
                        try {
                            const CTX: deploy_plugins.ListDirectoryContext = {
                                cancellationToken: CANCELLATION_SOURCE.token,
                                dir: DIR,
                                isCancelling: undefined,
                                target: t,
                                workspace: ME,
                            };

                            const LIST = await PI.listDirectory(CTX);
                            if (!LIST) {
                                continue;
                            }

                            const MATCHING_FILES = Enumerable.from(LIST.files).where(f => {
                                return FILENAME === deploy_helpers.toStringSafe(f.name);
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
                                            addNewer = REMOTE_UTC.isSameOrAfter(targetWithNewestFile.time);
                                        }

                                        if (addNewer) {
                                            targetWithNewestFile = {
                                                target: t,
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
                                //TODO: better error message
                                throw new Error(`All sync operations failed!`);
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
            });

    if (targetWithNewestFile) {
        const TARGET = targetWithNewestFile.target;
        const KEY = ME.getSyncWhenOpenKey(TARGET);

        if (false !== KEY) {
            await ME.pullFileFrom(FILE, TARGET);
            
            STATES[KEY] = Moment();
        }
    }
}
