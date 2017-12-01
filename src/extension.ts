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
import * as deploy_log from './log';
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_targets from './targets';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as Moment from 'moment';
import * as Path from 'path';
import * as vscode from 'vscode';
import * as Workflows from 'node-workflows';


let activeWorkspaces: deploy_workspaces.Workspace[] = [];
let currentContext: vscode.ExtensionContext;
let fileWatcher: vscode.FileSystemWatcher;
let isDeactivating = false;
let outputChannel: vscode.OutputChannel;
let packageFile: deploy_contracts.PackageFile;
const PLUGINS: deploy_plugins.Plugin[] = [];
let selectWorkspaceBtn: vscode.StatusBarItem;
const WORKSPACES: deploy_workspaces.Workspace[] = [];

function getActivePackages() {
    const PACKAGES: deploy_packages.Package[] = [];
    activeWorkspaces.forEach((ws) => {
        PACKAGES.push
                .apply(PACKAGES, ws.getPackages());
    });

    return PACKAGES;
}

async function invokeForActiveEditor(placeHolder: string,
                                     action: (file: string, target: deploy_targets.Target) => any) {
    const ACTIVE_EDITOR = vscode.window.activeTextEditor;
    if (ACTIVE_EDITOR) {
        const MATCHING_WORKSPACES = WORKSPACES.filter(ws => {
            return ACTIVE_EDITOR.document &&
                   ws.isPathOf(ACTIVE_EDITOR.document.fileName);
        });

        const TARGETS: deploy_targets.Target[] = [];
        MATCHING_WORKSPACES.forEach(ws => {
            Enumerable.from( ws.getTargets() )
                      .pushTo(TARGETS);
        });

        const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = TARGETS.map((t, i) => {
            return {
                action: async () => {
                    if (action) {
                        await Promise.resolve(
                            action(ACTIVE_EDITOR.document.fileName,
                                   t)
                        );
                    }
                },
                description: deploy_helpers.toStringSafe( t.description ).trim(),
                detail: t.__workspace.FOLDER.uri.fsPath,
                label: deploy_targets.getTargetName(t),
            };
        });

        if (QUICK_PICK_ITEMS.length < 1) {
            //TODO: translate
            await deploy_helpers.showWarningMessage(
                `No TARGETS found!`
            );

            return;
        }

        let selectedItem: deploy_contracts.ActionQuickPick;
        if (1 === QUICK_PICK_ITEMS.length) {
            selectedItem = QUICK_PICK_ITEMS[0];
        }
        else {
            selectedItem = await vscode.window.showQuickPick(QUICK_PICK_ITEMS, {
                placeHolder: placeHolder,
            });
        }

        if (selectedItem) {
            await Promise.resolve(
                selectedItem.action()
            );
        }
    }
    else {
        //TODO: translate
        await deploy_helpers.showWarningMessage(
            `No ACTIVE EDITOR found!`
        );
    }
}

async function invokeForActivePackage(placeHolder: string,
                                      action: (pkg: deploy_packages.Package) => any) {
    const PACKAGES = getActivePackages();
    
    const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = PACKAGES.map((p, i) => {
        return {
            action: async () => {
                if (action) {
                    await Promise.resolve(
                        action(p)
                    );
                }
            },
            description: deploy_helpers.toStringSafe( p.description ).trim(),
            detail: p.__workspace.FOLDER.uri.fsPath,
            label: deploy_packages.getPackageName(p),
        };
    });

    if (QUICK_PICK_ITEMS.length < 1) {
        //TODO: translate
        await deploy_helpers.showWarningMessage(
            `No PACKAGES found!`
        );
    }
    else {
        let selectedItem: deploy_contracts.ActionQuickPick;
        if (1 === QUICK_PICK_ITEMS.length) {
            selectedItem = QUICK_PICK_ITEMS[0];
        }
        else {
            selectedItem = await vscode.window.showQuickPick(QUICK_PICK_ITEMS, {
                placeHolder: placeHolder,
            });
        }

        if (selectedItem) {
            await Promise.resolve(
                selectedItem.action()
            );
        }
    }
}

async function onDidChangeActiveTextEditor(editor: vscode.TextEditor) {
    if (isDeactivating) {
        return;
    }

    try {
        activeWorkspaces = [];

        try {
            await deploy_helpers.forEachAsync(WORKSPACES, async (ws) => {
                try {
                    const DOC = editor.document;
                    if (!DOC) {
                        return;
                    }

                    if (Path.resolve(DOC.fileName).startsWith( Path.resolve(ws.FOLDER.uri.fsPath) )) {
                        activeWorkspaces.push(ws);

                        await ws.onDidChangeActiveTextEditor(editor);
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                            .err(e, 'extension.onDidChangeActiveTextEditor(2)');
                }
            });
        }
        finally {
            await updateWorkspaceButton();
        }
    }
    catch (e) {
        deploy_log.CONSOLE
                  .err(e, 'extension.onDidChangeActiveTextEditor(1)');
    }
}

async function onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
    await deploy_helpers.forEachAsync(WORKSPACES, async (ws) => {
        try {
            if (e.affectsConfiguration(ws.configSource.section, ws.configSource.resource)) {
                await ws.onDidChangeConfiguration(e);
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'extension.onDidChangeConfiguration()');
        }
    });
}

async function onDidFileChange(e: vscode.Uri, type: deploy_contracts.FileChangeType) {
    if (isDeactivating) {
        return;
    }

    deploy_helpers.forEachAsync(WORKSPACES, async (ws) => {
        try {
            if (ws.isPathOf(e.fsPath)) {
                await ws.onDidFileChange(e, type);
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .err(e, 'extension.onDidFileChange()');
        }
    });
}

async function onDidSaveTextDocument(e: vscode.TextDocument) {
    if (isDeactivating) {
        return;
    }

    deploy_helpers.forEachAsync(WORKSPACES, async (ws) => {
        try {
            if (ws.isPathOf(e.fileName)) {
                await ws.onDidSaveTextDocument(e);
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .err(e, 'extension.onDidSaveTextDocument()');
        }
    });
}

async function reloadWorkspaceFolders(added: vscode.WorkspaceFolder[], removed?: vscode.WorkspaceFolder[]) {
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
        await deploy_helpers.forEachAsync(added, async (wsf) => {
            let newWorkspace: deploy_workspaces.Workspace;
            try {
                const CTX: deploy_workspaces.WorkspaceContext = {
                    extension: currentContext,
                    outputChannel: outputChannel,
                    plugins: undefined,
                    workspaces: undefined,
                };

                // CTX.plugins
                Object.defineProperty(CTX, 'plugins', {
                    enumerable: true,
                    
                    get: () => {
                        return PLUGINS;
                    }
                });

                // CTX.workspaces
                Object.defineProperty(CTX, 'workspaces', {
                    enumerable: true,
                    
                    get: () => {
                        return WORKSPACES.filter(ws => {
                            return ws !== newWorkspace;
                        });
                    }
                });

                newWorkspace = new deploy_workspaces.Workspace(wsf, CTX);
                try {
                    const HAS_BEEN_INITIALIZED = await newWorkspace.initialize();
                    if (HAS_BEEN_INITIALIZED) {
                        WORKSPACES.push(newWorkspace);
                    }
                    else {
                        //TODO: translate
                        deploy_helpers.showErrorMessage(
                            `Workspace '${wsf.uri.fsPath}' has NOT been initialized!`
                        );
                    }
                }
                catch (err) {
                    deploy_log.CONSOLE
                              .trace(err, 'extension.reloadWorkspaceFolders(2)');

                    deploy_helpers.tryDispose(newWorkspace);
                }
            }
            catch (e) {
                deploy_log.CONSOLE
                          .err(e, 'extension.reloadWorkspaceFolders(1)');

                deploy_helpers.tryDispose(newWorkspace);
            }
        });
    }

    if (1 === WORKSPACES.length) {
        activeWorkspaces = deploy_helpers.asArray(
            Enumerable.from(WORKSPACES)
                      .firstOrDefault(x => true, undefined)
        );
    }

    await updateWorkspaceButton();
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
                                                //TODO: translate
                                                deploy_helpers.showErrorMessage(
                                                    `Plugin '${PI.__file}' has NOT been initialized!`
                                                );
                                            }
                                        }
                                        catch (e) {
                                            //TODO: translate
                                            deploy_helpers.showErrorMessage(
                                                `Error while initializing plugin '${js}' (s. debug output 'CTRL + Y')!`
                                            );

                                            deploy_log.CONSOLE
                                                      .trace(e, 'extension.reloadPlugins(2)');
                                        }
                                    }
                                }
                            }
                            else {
                                //TODO: translate
                                deploy_helpers.showWarningMessage(
                                    `Plugin module '${js}' contains NO factory function!`
                                );
                            }
                        }
                        else {
                            //TODO: translate
                            deploy_helpers.showWarningMessage(
                                `Plugin '${js}' contains NO module!`
                            );
                        }
                    }
                    catch (e) {
                        //TODO: translate
                        deploy_helpers.showErrorMessage(
                            `Error while loading '${js}' (s. debug output 'CTRL + Y')!`
                        );

                        deploy_log.CONSOLE
                                  .trace(e, 'extension.reloadPlugins(1)');
                    }
                }
            }
            else {
                //TODO: translate
                deploy_helpers.showWarningMessage(
                    `NO plugins found in '${PLUGIN_DIR}'!`
                );
            }
        }
        else {
            //TODO: translate
            deploy_helpers.showErrorMessage(
                `Plugin folder '${PLUGIN_DIR}' is NO directory!`
            );
        }
    }
    else {
        //TODO: translate
        deploy_helpers.showErrorMessage(
            `Plugin folder '${PLUGIN_DIR}' does NOT exist!`
        );
    }
}


async function updateWorkspaceButton() {
    const BTN = selectWorkspaceBtn;
    if (!BTN) {
        return;
    }

    try {
        const ACTIVE_WORKSPACES = deploy_helpers.asArray(activeWorkspaces)
                                                .map(ws => ws);

        // TODO: translate
        let command: string;
        let color = '#ffffff';
        let text = 'Deploy Reloaded: ';
        if (ACTIVE_WORKSPACES.length < 1) {
            color = '#ffff00';
            text += '(no workspace selected)';
        }
        else {
            text += Enumerable.from( ACTIVE_WORKSPACES ).select(ws => {
                return deploy_workspaces.getWorkspaceName(ws);
            }).joinToString(', ');
        }

        if (WORKSPACES.length > 0) {
            command = 'extension.deploy.reloaded.selectWorkspace';
        }

        BTN.color = color;
        BTN.command = command;
        BTN.text = text;

        if (WORKSPACES.length > 0) {
            BTN.show();
        }
        else {
            BTN.hide();
        }
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'extension.updateWorkspaceButton()');
    }
}


export async function activate(context: vscode.ExtensionContext) {
    const WF = Workflows.create();

    WF.next(() => {
        currentContext = context;
    });

    // package file
    WF.next(async () => {
        try {
            const CUR_DIR = __dirname;
            const FILE_PATH = Path.join(CUR_DIR, '../package.json');

            packageFile = JSON.parse(
                (await deploy_helpers.readFile(FILE_PATH)).toString('utf8')
            );
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'extension.activate(package file)');
        }
    });

    // output channel
    WF.next(() => {
        outputChannel = vscode.window.createOutputChannel('Deploy (Reloaded)');
    });

    // commands
    WF.next(() => {
        context.subscriptions.push(
            // deploy workspace
            vscode.commands.registerCommand('extension.deploy.reloaded.deployWorkspace', async () => {
                try {
                    await invokeForActivePackage(
                        'Select the PACKAGE to deploy...',  //TODO: translate
                        async (pkg) => {
                            await pkg.__workspace
                                     .deployPackage(pkg);
                        }
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deployWorkspace');
                    
                    //TODO: translate
                    deploy_helpers.showErrorMessage(
                        `Deploying WORKSPACE failed (s. debug output 'CTRL + Y')!`
                    );
                }
            }),

            // deploy current file
            vscode.commands.registerCommand('extension.deploy.reloaded.deployFile', async () => {
                try {
                    await invokeForActiveEditor(
                        'Select the TARGET to deploy to...',  //TODO: translate
                        async (file, target) => {
                            await target.__workspace
                                        .deployFileTo(file, target);
                        }
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deployFile');
                    
                    //TODO: translate
                    deploy_helpers.showErrorMessage(
                        `Deploying CURRENT FILE failed (s. debug output 'CTRL + Y')!`
                    );
                }
            }),

            // pull workspace
            vscode.commands.registerCommand('extension.deploy.reloaded.pullWorkspace', async () => {
                try {
                    await invokeForActivePackage(
                        'Select the PACKAGE to pull...',  //TODO: translate
                        async (pkg) => {
                            await pkg.__workspace
                                     .pullPackage(pkg);
                        }
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.pullWorkspace');

                    //TODO: translate
                    deploy_helpers.showErrorMessage(
                        `Pulling WORKSPACE failed (s. debug output 'CTRL + Y')!`
                    );
                }
            }),

            // pull current file
            vscode.commands.registerCommand('extension.deploy.reloaded.pullFile', async () => {
                try {
                    await invokeForActiveEditor(
                        'Select the TARGET to pull from...',  //TODO: translate
                        async (file, target) => {
                            await target.__workspace
                                        .pullFileFrom(file, target);
                        }
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.pullFile');
                    
                    //TODO: translate
                    deploy_helpers.showErrorMessage(
                        `Pulling CURRENT FILE failed (s. debug output 'CTRL + Y')!`
                    );
                }
            }),

            // delete package
            vscode.commands.registerCommand('extension.deploy.reloaded.deletePackage', async () => {
                try {
                    await invokeForActivePackage(
                        'Select the PACKAGE to delete its files...',  //TODO: translate
                        async (pkg) => {
                            await pkg.__workspace
                                     .deletePackage(pkg);
                        }
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deletePackage');

                    //TODO: translate
                    deploy_helpers.showErrorMessage(
                        `Deleting PACKAGE failed (s. debug output 'CTRL + Y')!`
                    );
                }
            }),

            // delete current file
            vscode.commands.registerCommand('extension.deploy.reloaded.deleteFile', async () => {
                try {
                    await invokeForActiveEditor(
                        'Select the TARGET to delete the file in...',  //TODO: translate
                        async (file, target) => {
                            await target.__workspace
                                        .deleteFileIn(file, target);
                        }
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deleteFile');
                    
                    //TODO: translate
                    deploy_helpers.showErrorMessage(
                        `Deleting CURRENT FILE failed (s. debug output 'CTRL + Y')!`
                    );
                }
            }),

            // list directory
            vscode.commands.registerCommand('extension.deploy.reloaded.listDirectory', async () => {
                try {
                    const TARGETS: deploy_targets.Target[] = [];
                    activeWorkspaces.forEach(ws => {
                        const WORKSPACE_TARGETS = ws.getTargets().filter(t => {
                            const PLUGINS = t.__workspace.CONTEXT.plugins.filter(pi => {
                                const TARGET_TYPE = deploy_helpers.normalizeString(t.type);

                                return '' === pi.__type || 
                                       (TARGET_TYPE === pi.__type && pi.canList && pi.listDirectory);
                            });

                            return PLUGINS.length > 0;
                        });

                        TARGETS.push
                               .apply(TARGETS, WORKSPACE_TARGETS);
                    });

                    await deploy_targets.showTargetQuickPick(
                        TARGETS,
                        'Select the TARGET from where what you would like to list...',
                        async (target) => {
                            await target.__workspace
                                        .listDirectory(target);
                        }
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.listDirectory');

                    //TODO: translate
                    deploy_helpers.showErrorMessage(
                        `Listening directory failed (s. debug output 'CTRL + Y')!`
                    );
                }
            }),

            // list directory
            vscode.commands.registerCommand('extension.deploy.reloaded.selectWorkspace', async () => {
                try {
                    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = WORKSPACES.map(ws => {
                        return {
                            label: deploy_workspaces.getWorkspaceName(ws),
                            description: Path.dirname(
                                ws.FOLDER.uri.fsPath
                            ),

                            action: async () => {
                                activeWorkspaces = [ ws ];

                                await updateWorkspaceButton();
                            }
                        };
                    });

                    if (QUICK_PICKS.length < 1) {
                        //TODO: translate
                        deploy_helpers.showWarningMessage(
                            `No WORKSPACE found!`
                        );
                        
                        return;
                    }

                    let selectedItem: deploy_contracts.ActionQuickPick;
                    if (1 === QUICK_PICKS.length) {
                        selectedItem = QUICK_PICKS[0];
                    }
                    else {
                        //TODO: translate
                        selectedItem = await vscode.window.showQuickPick(
                            QUICK_PICKS,
                            {
                                placeHolder: 'Select the active workspace...',
                            }
                        );
                    }

                    if (selectedItem) {
                        await Promise.resolve(
                            selectedItem.action()
                        );
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.selectWorkspace');

                    //TODO: translate
                    deploy_helpers.showErrorMessage(
                        `Selecting workspace failed (s. debug output 'CTRL + Y')!`
                    );
                }
                finally {
                    await updateWorkspaceButton();
                }
            }),
        );
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

    // global VSCode events
    WF.next(() => {
        context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders((e) => {
                reloadWorkspaceFolders(e.added, e.removed).then(() => {
                }).catch((err) => {
                    deploy_log.CONSOLE
                              .trace(err, 'vscode.workspace.onDidChangeWorkspaceFolders');
                });
            }),

            vscode.window.onDidChangeActiveTextEditor((e) => {
                onDidChangeActiveTextEditor(e).then(() => {
                }).catch((err) => {
                    deploy_log.CONSOLE
                              .trace(err, 'vscode.window.onDidChangeActiveTextEditor');
                });
            }),

            vscode.workspace.onDidChangeConfiguration((e) => {
                onDidChangeConfiguration(e).then(() => {
                }).catch((err) => {
                    deploy_log.CONSOLE
                              .trace(err, 'vscode.workspace.onDidChangeConfiguration');
                });
            }),

            vscode.workspace.onDidSaveTextDocument((e) => {
                onDidSaveTextDocument(e).then(() => {
                }).catch((err) => {
                    deploy_log.CONSOLE
                              .trace(err, 'vscode.workspace.onDidSaveTextDocument');
                });
            }),
        );
    });

    // reload workspace folders
    WF.next(async () => {
        await reloadWorkspaceFolders(
            vscode.workspace.workspaceFolders
        );
    });

    // file system watcher
    WF.next(() => {
        let newWatcher: vscode.FileSystemWatcher;
        try {
            newWatcher = vscode.workspace.createFileSystemWatcher('**',
                                                                  false, false, false);

            const TRIGGER_CHANGE_EVENT = (e: vscode.Uri, type: deploy_contracts.FileChangeType) => {
                onDidFileChange(e, type).then(() => {
                }).catch((err) => {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.activate(file system watcher #2)');
                });
            };

            newWatcher.onDidChange((e) => {
                TRIGGER_CHANGE_EVENT(e, deploy_contracts.FileChangeType.Changed);
            });
            newWatcher.onDidCreate((e) => {
                TRIGGER_CHANGE_EVENT(e, deploy_contracts.FileChangeType.Created);
            });
            newWatcher.onDidDelete((e) => {
                TRIGGER_CHANGE_EVENT(e, deploy_contracts.FileChangeType.Deleted);
            });

            deploy_helpers.tryDispose(fileWatcher);
            fileWatcher = newWatcher;
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'extension.activate(file system watcher #1)');

            deploy_helpers.tryDispose(newWatcher);
        }
    });

    // select workspace button
    WF.next(() => {
        let newBtn: vscode.StatusBarItem;
        try {
            newBtn = vscode.window.createStatusBarItem();

            selectWorkspaceBtn = newBtn;
        }
        catch (e) {
            deploy_helpers.tryDispose(newBtn);
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

    // update 'select workspace' button
    WF.next(async () => {
        await updateWorkspaceButton();
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
