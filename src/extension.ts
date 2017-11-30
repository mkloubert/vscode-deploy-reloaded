'use strict';

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
import * as deploy_workspaces from './workspaces';
import * as Moment from 'moment';
import * as Path from 'path';
import * as vscode from 'vscode';
import * as Workflows from 'node-workflows';


let currentContext: vscode.ExtensionContext;
let fileWatcher: vscode.FileSystemWatcher;
let isDeactivating = false;
let outputChannel: vscode.OutputChannel;
let packageFile: deploy_contracts.PackageFile;
const PLUGINS: deploy_plugins.Plugin[] = [];
const WORKSPACES: deploy_workspaces.Workspace[] = [];
function reloadWorkspaceFolders(added: vscode.WorkspaceFolder[], removed?: vscode.WorkspaceFolder[]) {
    if (isDeactivating) {
        return;
    }

    if (removed) {
        for (let i = 0; i < WORKSPACES.length; ) {
            const WS = WORKSPACES[i];
            let removeWorkspace = false;

            for (let rws of removed) {
                if (Path.resolve(rws.uri.fsPath) === Path.resolve(WS.FOLDER.uri.fsPath)) {
                    removeWorkspace = true;
                    break;
                }
            }

            if (removeWorkspace) {
                if (deploy_helpers.tryDispose(WS)) {
                    WORKSPACES.splice(i, 1);
                }
            }
        }
    }

    if (added) {
        added.forEach(wsf => {
            let newWorkspace: deploy_workspaces.Workspace;
            try {
                newWorkspace = new deploy_workspaces.Workspace(wsf, {
                    extension: currentContext,
                    outputChannel: outputChannel,
                });

                newWorkspace.initialize().then((hasBeenInitialized) => {
                    if (hasBeenInitialized) {
                        WORKSPACES.push(newWorkspace);
                    }
                    else {
                        //TODO: log or show message

                        deploy_helpers.tryDispose(newWorkspace);
                    }
                }).catch((err) => {
                    //TODO: log

                    deploy_helpers.tryDispose(newWorkspace);
                });
            }
            catch (e) {
                //TODO: log

                deploy_helpers.tryDispose(newWorkspace);
            }
        });
    }
}

function onDidFileChange(e: vscode.Uri, type: deploy_contracts.FileChangeType) {
    if (isDeactivating) {
        return;
    }

    try {
        WORKSPACES.forEach(ws => {
            try {
                if (Path.resolve(e.fsPath).startsWith( Path.resolve(ws.FOLDER.uri.fsPath) )) {
                    ws.onDidFileChange(e, type).then(() => {
                        // OK
                    }).catch((err) => {
                        //TODO: log
                    });
                }
            }
            catch (e) {
                //TODO: log
            }
        });
    }
    catch (e) {
        //TODO: log
    }
}

async function reloadPlugins() {
    if (isDeactivating) {
        return;
    }

    while (PLUGINS.length > 0) {
        const PI = PLUGINS.pop();

        deploy_helpers.tryDispose(PI);
    }

    const PLUGIN_DIR = Path.join(__dirname, './plugins');
    if (await deploy_helpers.exists(PLUGIN_DIR)) {
        const STATS = await deploy_helpers.lstat(PLUGIN_DIR);
        if (STATS.isDirectory()) {
            const JS_FILES = await deploy_helpers.glob('*.js', {
                absolute: true,
                cwd: PLUGIN_DIR,
                dot: false,
                nodir: true,
                nonull: true,
                nosort: false,
                root: PLUGIN_DIR,
                sync: false,
            });

            if (JS_FILES.length > 0) {
                for (let js of JS_FILES) {
                    try {
                        js = Path.resolve(js);

                        delete require.cache[js];

                        const MODULE: deploy_plugins.PluginModule = require(js);
                        if (MODULE) {
                            const CREATE_PLUGINS = MODULE.createPlugins;
                            if (CREATE_PLUGINS) {
                                const CONTEXT: deploy_plugins.PluginContext = {
                                    outputChannel: outputChannel
                                };

                                const NEW_PLUGINS: deploy_plugins.Plugin[] = deploy_helpers.asArray(await Promise.resolve(
                                    CREATE_PLUGINS.apply(MODULE,
                                                         [ CONTEXT ])
                                ));
                                if (NEW_PLUGINS) {
                                    let index = -1;
                                    for (const PI of NEW_PLUGINS) {
                                        if (!PI) {
                                            continue;
                                        }

                                        try {
                                            ++index;

                                            PI.__index = index;
                                            PI.__file = Path.basename(js);
                                            PI.__filePath = Path.resolve(js);
                                            PI.__type = deploy_helpers.toStringSafe(
                                                Path.basename(js,
                                                              Path.extname(js))
                                            ).toLowerCase().trim();

                                            let isInitialized: boolean;

                                            const INITILIZE = PI.initialize;
                                            if (INITILIZE) {
                                                isInitialized =
                                                    await Promise.resolve(
                                                        INITILIZE.apply(PI, [])
                                                    );
                                            }

                                            if (deploy_helpers.toBooleanSafe(isInitialized, true)) {
                                                PLUGINS.push(PI);
                                            }
                                            else {
                                                //TODO: show warning message
                                            }
                                        }
                                        catch (e) {
                                            //TODO: log
                                        }
                                    }
                                }
                            }
                            else {
                                // show warning message
                            }
                        }
                        else {
                            // show warning message
                        }
                    }
                    catch (e) {

                    }
                }
            }
            else {
                //TODO: show warning message.
            }
        }
        else {
            //TODO: show warning message
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {
    const WF = Workflows.create();

    WF.next(() => {
        currentContext = context;
    });

    // package file
    WF.next(() => {
        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                packageFile = JSON.parse(
                    (await deploy_helpers.readFile(Path.join(__dirname, '../../package.json'))).toString('utf8')
                );
            }
            catch (e) {
                //TODO: log
            }

            COMPLETED(null);
        });
    });

    // output channel
    WF.next(() => {
        outputChannel = vscode.window.createOutputChannel('Deploy (Reloaded)');
    });
    
    // reload plugins
    WF.next(() => {
        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                await reloadPlugins();

                COMPLETED(null);
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    });

    WF.next(() => {
        vscode.workspace.onDidChangeWorkspaceFolders((e) => {
            reloadWorkspaceFolders(e.added, e.removed);
        });
    });

    // reload workspace folders
    WF.next(() => {
        reloadWorkspaceFolders(
            vscode.workspace.workspaceFolders
        );
    });

    // file system watcher
    WF.next(() => {
        let newWatcher: vscode.FileSystemWatcher;
        try {
            newWatcher = vscode.workspace.createFileSystemWatcher('**',
                                                                  false, false, false);

            newWatcher.onDidChange((e) => {
                onDidFileChange(e, deploy_contracts.FileChangeType.Changed);
            });
            newWatcher.onDidCreate((e) => {
                onDidFileChange(e, deploy_contracts.FileChangeType.Created);
            });
            newWatcher.onDidDelete((e) => {
                onDidFileChange(e, deploy_contracts.FileChangeType.Deleted);
            });

            deploy_helpers.tryDispose(fileWatcher);
            fileWatcher = newWatcher;
        }
        catch (e) {
            //TODO: log

            deploy_helpers.tryDispose(newWatcher);
        }
    });

    WF.next(() => {
        const NOW = Moment();

        if (packageFile) {
            outputChannel.appendLine(`${packageFile.displayName} (${packageFile.name}) - v${packageFile.version}`);
        }

        outputChannel.appendLine(`Copyright (c) 2017-${NOW.format('YYYY')}  Marcel Joachim Kloubert <marcel.kloubert@gmx.net>`);
        outputChannel.appendLine('');
        outputChannel.appendLine(`GitHub : https://github.com/mkloubert/vscode-deploy-reloaded`);
        outputChannel.appendLine(`Twitter: https://twitter.com/mjkloubert`);
        outputChannel.appendLine(`Donate : [PayPal] https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RB3WUETWG4QU2`);
        outputChannel.appendLine(`         [Flattr] https://flattr.com/submit/auto?fid=o62pkd&url=https%3A%2F%2Fgithub.com%2Fmkloubert%2Fvs-deploy`);

        outputChannel.appendLine('');

        outputChannel.appendLine(`Loaded ${PLUGINS.length} plugins:`);
        PLUGINS.forEach((pi) => {
            outputChannel.appendLine(`- ${pi.__file}`);
        });

        outputChannel.show();
    });

    await WF.start();
}

export function deactivate() {
    if (isDeactivating) {
        return;
    }
    isDeactivating = true;

    deploy_helpers.tryDispose(fileWatcher);
    deploy_helpers.tryDispose(outputChannel);

    while (WORKSPACES.length > 0) {
        const WS = WORKSPACES.pop();

        deploy_helpers.tryDispose(WS);
    }
}
