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
import * as deploy_plugins from './plugins';
import * as deploy_targets from './targets';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as i18 from './i18';
import * as vscode from 'vscode';


/**
 * Compares two files.
 * 
 * @param {deploy_workspaces.Workspace|deploy_workspaces.Workspace[]} workspaces One or more workspaces.
 */
export async function compareFiles(workspaces: deploy_workspaces.Workspace | deploy_workspaces.Workspace[]) {
    try {
        workspaces = deploy_helpers.asArray(workspaces);

        const ACTIVE_EDITOR = vscode.window.activeTextEditor;
        if (ACTIVE_EDITOR) {
            const DOC = ACTIVE_EDITOR.document;
            if (DOC) {
                const MATCHING_WORKSPACES = workspaces.filter(ws => {
                    return false !== ws.toRelativePath(DOC.fileName);
                });

                if (MATCHING_WORKSPACES.length > 0) {
                    const TARGETS = Enumerable.from( MATCHING_WORKSPACES ).selectMany(ws => {
                        return ws.getTargets();
                    }).where(t => {
                        return t.__workspace.getDownloadPlugins(t)
                                            .length > 0;
                    }).toArray();

                    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = TARGETS.map(t => {
                        const WS = t.__workspace;

                        return {
                            action: async () => {
                                let remoteFile: Buffer;

                                const CANCELLATION_SOURCE = new vscode.CancellationTokenSource();
                                try {
                                    const PLUGINS = t.__workspace.getDownloadPlugins(t);
                                    while (PLUGINS.length > 0) {
                                        if (CANCELLATION_SOURCE.token.isCancellationRequested) {
                                            break;
                                        }

                                        const PI = PLUGINS.shift();

                                        const NAME_AND_PATH = WS.getNameAndPathForFileDeployment(DOC.fileName, t);
                                        if (false === NAME_AND_PATH) {
                                            continue;
                                        }

                                        const FTD = new deploy_plugins.SimpleFileToDownload(
                                            WS,
                                            DOC.fileName,
                                            NAME_AND_PATH
                                        );

                                        FTD.onDownloadCompleted = async (err, data) => {
                                            if (err) {
                                                throw err;
                                            }
                                            else {
                                                if (deploy_helpers.isObject<deploy_plugins.DownloadedFile>(data)) {
                                                    remoteFile = await data.read();
                                                }
                                                else {
                                                    remoteFile = await deploy_helpers.asBuffer(data);
                                                }
                                            }
                                        };

                                        const CTX: deploy_plugins.DownloadContext = {
                                            cancellationToken: CANCELLATION_SOURCE.token,
                                            files: [ FTD ],
                                            isCancelling: undefined,
                                            target: t,
                                        };

                                        await PI.downloadFiles(CTX);
                                    }
                                }
                                finally {
                                    deploy_helpers.tryDispose(
                                        CANCELLATION_SOURCE
                                    );
                                }

                                if (remoteFile) {
                                    await deploy_helpers.invokeForTempFile(async (tmpFile) => {
                                        await deploy_helpers.writeFile(tmpFile, remoteFile);

                                        let realtivePath = WS.toRelativePath(DOC.fileName);
                                        if (false === realtivePath) {
                                            realtivePath = DOC.fileName;
                                        }

                                        let titleSuffix = deploy_helpers.toStringSafe(t.name).trim();

                                        // TODO: translate
                                        let windowTitle = `[vscode-deploy-reloaded] Diff '${realtivePath}'`;
                                        if ('' === titleSuffix) {
                                            titleSuffix = deploy_helpers.normalizeString(t.type);
                                        }
                                        if ('' !== titleSuffix) {
                                            windowTitle += ` (${titleSuffix})`;
                                        }

                                        vscode.commands.executeCommand('vscode.diff',
                                                                       vscode.Uri.file(tmpFile), vscode.Uri.file(DOC.fileName), windowTitle);
                                    }, {
                                        keep: true
                                    });
                                }
                            },
                            description: deploy_helpers.toStringSafe(t.description).trim(),
                            label: deploy_targets.getTargetName(t),
                        };
                    });

                    if (QUICK_PICKS.length > 0) {
                        let selectedItem: deploy_contracts.ActionQuickPick;
                        if (1 === QUICK_PICKS.length) {
                            selectedItem = QUICK_PICKS[0];
                        }
                        else {
                            selectedItem = await vscode.window.showQuickPick(QUICK_PICKS);
                        }

                        if (selectedItem) {
                            await Promise.resolve(
                                selectedItem.action()
                            );
                        }
                    }
                    else {
                        deploy_helpers.showWarningMessage(
                            i18.t('targets.noneFound')
                        );
                    }
                }
                else {
                    deploy_helpers.showWarningMessage(
                        i18.t('targets.noWorkspaceFound')
                    );
                }
            }
            else {
                deploy_helpers.showWarningMessage(
                    i18.t('editors.active.noOpen')
                );
            }
        }
        else {
            deploy_helpers.showWarningMessage(
                i18.t('editors.active.noOpen')
            );
        }
    }
    catch (e) {
        deploy_helpers.showWarningMessage(
            i18.t('compare.currentFile.failed', e)
        );
    }
}
