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

const CompareVersion = require('compare-versions');
import * as deploy_api from './api';
import * as deploy_commands from './commands';
import * as deploy_compare from './compare';
import * as deploy_contracts from './contracts';
import * as deploy_delete from './delete';
import * as deploy_deploy from './deploy';
import * as deploy_gui from './gui';
import * as deploy_helpers from './helpers';
import * as deploy_html from './html';
import * as deploy_log from './log';
import * as deploy_notifications from './notifications';
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
import * as deploy_proxies from './proxies';
import * as deploy_pull from './pull';
import * as deploy_switch from './switch';
import * as deploy_targets from './targets';
import * as deploy_tools from './tools';
import * as deploy_tools_bower from './tools/bower';
import * as deploy_tools_composer from './tools/composer';
import * as deploy_tools_npm from './tools/npm';
import * as deploy_tools_quick_execution from './tools/quickexecution';
import * as deploy_tools_send_file from './tools/sendfile';
import * as deploy_tools_yarn from './tools/yarn';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as i18 from './i18';
import * as Moment from 'moment';
import * as OS from 'os';
import * as Path from 'path';
import * as vscode from 'vscode';


let activeWorkspaces: deploy_workspaces.Workspace[] = [];
let currentContext: vscode.ExtensionContext;
let isDeactivating = false;
let nextWorkspaceId = Number.MAX_SAFE_INTEGER;
let outputChannel: vscode.OutputChannel;
let packageFile: deploy_helpers.PackageFile;
const PLUGINS: deploy_plugins.Plugin[] = [];
let selectWorkspaceBtn: vscode.StatusBarItem;
const WORKSPACE_COMMANDS: deploy_commands.WorkspaceCommandRepository = {};
let workspaceWatcher: deploy_helpers.WorkspaceWatcherContext<deploy_workspaces.Workspace>;


async function createNewWorkspace(folder: vscode.WorkspaceFolder): Promise<deploy_workspaces.Workspace> {
    let newWorkspace: deploy_workspaces.Workspace;
    let fileWatcher: vscode.FileSystemWatcher;
    try {
        fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, '**'),
            false, false, false,
        );

        const CTX: deploy_workspaces.WorkspaceContext = {
            commands: WORKSPACE_COMMANDS,
            extension: currentContext,
            fileWatcher: fileWatcher,
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
                return deploy_workspaces.getAllWorkspaces().filter(ws => {
                    return ws !== newWorkspace;
                });
            }
        });

        newWorkspace = new deploy_workspaces.Workspace(
            nextWorkspaceId--, folder, CTX
        );

        outputChannel.append(i18.t('workspaces.initializing',
                                   folder.uri.fsPath) + ' ');
        try {
            const HAS_BEEN_INITIALIZED = await newWorkspace.initialize();
            if (HAS_BEEN_INITIALIZED) {
                outputChannel.appendLine(`[${i18.t('ok')}]`);
            }
            else {
                throw new Error(
                    i18.t('workspaces.errors.notInitialized',
                          folder.uri.fsPath)
                );
            }
        }
        catch (err) {
            deploy_helpers.tryDispose(newWorkspace);

            outputChannel.appendLine(`[${i18.t('error', err)}]`);
        }
        outputChannel.appendLine('');
    }
    catch (e) {
        deploy_log.CONSOLE
                  .err(e, 'extension.reloadWorkspaceFolders(1)');

        deploy_helpers.tryDispose(fileWatcher);
        deploy_helpers.tryDispose(newWorkspace);

        newWorkspace = null;
    }

    return newWorkspace;
}

function getActiveWorkspacesOrAll() {
    let listOfWorkspaces = deploy_helpers.asArray(activeWorkspaces);
    if (listOfWorkspaces.length < 1) {
        listOfWorkspaces = deploy_workspaces.getAllWorkspaces();
    }

    return listOfWorkspaces.map(ws => ws);
}

function getAllWorkspacesSorted() {
    return Enumerable.from( deploy_workspaces.getAllWorkspaces() ).orderBy(ws => {
        return ws.isActive ? 0 : 1;
    }).thenBy(ws => {
        return deploy_helpers.normalizeString(ws.name);
    }).thenBy(ws => {
        return deploy_helpers.normalizeString(ws.rootPath);
    }).toArray();
}

function getAllTargetsSorted() {
    return Enumerable.from( getAllWorkspacesSorted() ).selectMany(ws => {
        return Enumerable.from( ws.getTargets() ).orderBy(t => {
            return deploy_helpers.normalizeString(
                deploy_targets.getTargetName(t)
            );
        }).thenBy(t => {
            return t.__index;
        });
    }).toArray();
}

function normalizeActiveWorkspaces(aws: deploy_workspaces.Workspace | deploy_workspaces.Workspace[]) {
    aws = deploy_helpers.asArray(aws);

    if (aws.length < 1) {
        if (1 === deploy_workspaces.getAllWorkspaces().length) {
            aws = deploy_helpers.asArray(
                Enumerable.from(deploy_workspaces.getAllWorkspaces())
                          .firstOrDefault(x => true, undefined)
            );
        }
    }

    return aws;
}

async function onDidChangeActiveTextEditor(editor: vscode.TextEditor) {
    if (isDeactivating) {
        return;
    }

    const NEW_ACTIVE_WORKSPACES: deploy_workspaces.Workspace[] = [];
    try {
        await deploy_helpers.forEachAsync(deploy_workspaces.getAllWorkspaces(), async (ws) => {
            try {
                let doc: vscode.TextDocument;
                if (editor) {
                    doc = editor.document;
                }

                let isForWorkspace = !doc;
                if (!isForWorkspace) {
                    isForWorkspace = deploy_helpers.isEmptyString(doc.fileName);
                    if (!isForWorkspace) {
                        isForWorkspace = ws.isPathOf(doc.fileName);
                    }
                }

                if (!editor || isForWorkspace) {
                    if (doc) {
                        NEW_ACTIVE_WORKSPACES.push(ws);
                    }

                    await ws.onDidChangeActiveTextEditor(editor);
                }
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.onDidChangeActiveTextEditor(2)');
            }
        });
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'extension.onDidChangeActiveTextEditor(1)');
    }
    finally {
        activeWorkspaces = normalizeActiveWorkspaces(NEW_ACTIVE_WORKSPACES);

        await updateActiveWorkspaces();
    }
}

async function onDidSaveTextDocument(e: vscode.TextDocument) {
    if (isDeactivating) {
        return;
    }

    for (const WS of deploy_workspaces.getAllWorkspaces()) {
        try {
            if (WS.isPathOf(e.fileName)) {
                await WS.onDidSaveTextDocument(e);
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'extension.onDidSaveTextDocument()');
        }
    }
}

async function refreshActiveWorkspaceList() {
    try {
        activeWorkspaces = [];

        const ALL_WORKSPACES = deploy_workspaces.getAllWorkspaces();
        if (ALL_WORKSPACES.length > 0) {
            activeWorkspaces = [
                ALL_WORKSPACES[0]
            ];
        }
    }
    catch (e) {
        deploy_log.CONSOLE
                  .log(e, 'extension.refreshActiveWorkspaces()');
    }

    await updateActiveWorkspaces();
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
                cwd: PLUGIN_DIR,
                nocase: false,
                root: PLUGIN_DIR,
            });

            if (JS_FILES.length > 0) {
                for (const JS of JS_FILES) {
                    try {
                        delete require.cache[JS];

                        const MODULE: deploy_plugins.PluginModule = require(JS);
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
                                            PI.__file = Path.basename(JS);
                                            PI.__filePath = Path.resolve(JS);
                                            PI.__type = deploy_helpers.toStringSafe(
                                                Path.basename(JS,
                                                              Path.extname(JS))
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
                                                deploy_helpers.showErrorMessage(
                                                    i18.t('plugins.errors.notInitialized',
                                                          PI.__file)
                                                );
                                            }
                                        }
                                        catch (e) {
                                            deploy_helpers.showErrorMessage(
                                                i18.t('plugins.errors.initializationFailed',
                                                      JS)
                                            );

                                            deploy_log.CONSOLE
                                                      .trace(e, 'extension.reloadPlugins(2)');
                                        }
                                    }
                                }
                            }
                            else {
                                deploy_helpers.showWarningMessage(
                                    i18.t('plugins.errors.noFactoryFunction',
                                          JS)
                                );
                            }
                        }
                        else {
                            deploy_helpers.showWarningMessage(
                                i18.t('plugins.errors.noModule',
                                      JS)
                            );
                        }
                    }
                    catch (e) {
                        deploy_helpers.showErrorMessage(
                            i18.t('plugins.errors.loadingFailed',
                                  JS)
                        );

                        deploy_log.CONSOLE
                                  .trace(e, 'extension.reloadPlugins(1)');
                    }
                }
            }
            else {
                deploy_helpers.showErrorMessage(
                    i18.t('plugins.errors.noneFoundIn',
                          PLUGIN_DIR)
                );
            }
        }
        else {
            deploy_helpers.showErrorMessage(
                i18.t('isNo.dir',
                      PLUGIN_DIR)
            );
        }
    }
    else {
        deploy_helpers.showErrorMessage(
            i18.t('notFound.dir',
                  PLUGIN_DIR)
        );
    }
}

async function updateActiveWorkspaces() {
    try {
        deploy_helpers.asArray(activeWorkspaces).forEach((ws) => {
            ws.reloadEnvVars();
        });    
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'extension.updateActiveWorkspaces()');
    }

    await updateWorkspaceButton();
}

async function updateWorkspaceButton() {
    const BTN = selectWorkspaceBtn;
    if (!BTN) {
        return;
    }

    try {
        const ACTIVE_WORKSPACES = deploy_helpers.asArray(activeWorkspaces);
        const ALL_WORKSPACES = deploy_helpers.asArray(deploy_workspaces.getAllWorkspaces());

        const ALWAYS_SHOW_BUTTON = Enumerable.from(ALL_WORKSPACES).any(ws => {
            const CFG = ws.config;

            return CFG && deploy_helpers.toBooleanSafe(CFG.alwaysShowWorkspaceSelector);
        });
        let command: string;
        let color = '#ffffff';
        let text = 'Deploy Reloaded: ';
        let tooltip: string;
        if (ACTIVE_WORKSPACES.length < 1) {
            color = '#ffff00';
            text += `(${i18.t('workspaces.noSelected')})`;
        }
        else {
            text += Enumerable.from( ACTIVE_WORKSPACES ).select(ws => {
                return ws.name;
            }).joinToString(', ');
        }

        if (ALL_WORKSPACES.length > 0) {
            command = 'extension.deploy.reloaded.selectWorkspace';
            tooltip = i18.t('workspaces.selectButton.tooltip');
        }

        BTN.color = color;
        BTN.command = command;
        BTN.text = text;
        BTN.tooltip = tooltip;

        if (ALL_WORKSPACES.length > 1 || ALWAYS_SHOW_BUTTON) {
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
    const WF = deploy_helpers.buildWorkflow();

    // global translations
    WF.next(async () => {
        await i18.init();
    });

    WF.next(async () => {
        const VS_DEPLOY = Enumerable.from(
            vscode.extensions.all
        ).firstOrDefault(x => 'mkloubert.vs-deploy' === x.id);

        let doActivateTheExtension = true;

        if (!deploy_helpers.isSymbol(VS_DEPLOY)) {
            if (VS_DEPLOY.isActive) {
                doActivateTheExtension = false;
                
                const PRESSED_BTN = await deploy_helpers.showWarningMessage<deploy_contracts.MessageItemWithValue<number>>(
                    i18.t('vs-deploy.currentlyActive'),

                    {
                        isCloseAffordance: true,
                        title: i18.t('cancel'),
                        value: 0,
                    },

                    {
                        title: i18.t('vs-deploy.continueAndInitialize'),
                        value: 1,
                    },
                );

                if (PRESSED_BTN) {
                    doActivateTheExtension = 1 === PRESSED_BTN.value;
                }
            }
        }

        if (doActivateTheExtension) {
            await activateExtension(context);
        }
        else {
            deploy_helpers.showInformationMessage(
                i18.t('initializationCanceled')
            );
        }
    });

    if (!isDeactivating) {
        await WF.start();
    }
}

async function activateExtension(context: vscode.ExtensionContext) {
    const WF = deploy_helpers.buildWorkflow();

    // extension's root directory
    WF.next(() => {
        deploy_helpers.setExtensionRoot(__dirname);
    });

    WF.next(() => {
        currentContext = context;
    });

    // events
    WF.next(() => {
        context.subscriptions.push(
            deploy_helpers.EVENT_DISPOSER
        );
    });

    // output channel
    WF.next(() => {
        context.subscriptions.push(
            outputChannel = vscode.window.createOutputChannel('Deploy Reloaded')
        );

        outputChannel.hide();
    });

    // workspace (folders)
    WF.next(() => {
        context.subscriptions.push(
            workspaceWatcher = deploy_helpers.registerWorkspaceWatcher<deploy_workspaces.Workspace>(
                context,
                async (ev, folder) => {
                    if (ev === deploy_helpers.WorkspaceWatcherEvent.Added) {
                        if (folder && folder.uri && (['', 'file'].indexOf( deploy_helpers.normalizeString(folder.uri.scheme) ) > -1)) {
                            // only if local URI
                            return await createNewWorkspace( folder );
                        }
                    }
                },
                async (err, ev, folder, workspace) => {
                    if (err) {
                        deploy_log.CONSOLE
                                  .trace(err, 'extension.activate.registerWorkspaceWatcher()');

                        return;
                    }

                    if (ev === deploy_helpers.WorkspaceWatcherEvent.Removed) {
                        const NEW_ACTIVE_WORKSPACES = deploy_helpers.asArray(
                            activeWorkspaces
                        ).filter(aws => aws !== workspace);
                        
                        if (NEW_ACTIVE_WORKSPACES.length < 1) {
                            await refreshActiveWorkspaceList();                                
                        }
                        else {
                            activeWorkspaces = NEW_ACTIVE_WORKSPACES;
                        }
                    }
                }
            )
        );

        deploy_workspaces.setAllWorkspacesProvider(() => {
            return workspaceWatcher.workspaces;
        });

        deploy_workspaces.setActiveWorkspaceProvider(() => {
            return activeWorkspaces;
        });
    });

    // extension's home folder
    WF.next(async () => {
        try {
            await deploy_helpers.createDirectoryIfNeeded(
                deploy_helpers.getExtensionDirInHome(),
            );
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'extension.activate(extensions home folder)');
        }
    });

    // cleanup log files in home directory
    WF.next(async () => {
        try {
            await deploy_log.cleanupLogFilesInHomeDirectory();
        }
        catch (e) { /* ignore */ }
    });    

    // package file
    WF.next(async () => {
        try {
            packageFile = await deploy_helpers.getPackageFile();
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'extension.activate(package file)');
        }
    });

    // extension information
    WF.next(() => {
        const NOW = Moment();

        if (packageFile) {
            outputChannel.appendLine(`${packageFile.displayName} (${packageFile.name}) - v${packageFile.version}`);
        }

        outputChannel.appendLine(`Copyright (c) 2017-${NOW.format('YYYY')}  Marcel Joachim Kloubert <marcel.kloubert@gmx.net>`);
        outputChannel.appendLine('');
        outputChannel.appendLine(`GitHub : https://github.com/mkloubert/vscode-deploy-reloaded`);
        outputChannel.appendLine(`Twitter: https://twitter.com/mjkloubert`);
        outputChannel.appendLine(`Donate : https://paypal.me/MarcelKloubert`);

        outputChannel.appendLine('');
        outputChannel.appendLine('');
        outputChannel.appendLine(i18.t('extension.initializing'));
        outputChannel.appendLine('');
        outputChannel.appendLine('');
    });    

    // commands
    WF.next(() => {
        context.subscriptions.push(
            // compare
            vscode.commands.registerCommand('extension.deploy.reloaded.compare', async () => {
                try {
                    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
                        {
                            action: async () => {
                                await deploy_compare.compareFiles(
                                    deploy_workspaces.getActiveWorkspaces()
                                );
                            },
                            label: '$(diff)  ' + i18.t('compare.currentFile.label'),
                            description: i18.t('compare.currentFile.description'),
                        }
                    ];

                    const SELECTED_ITEM = await vscode.window.showQuickPick(QUICK_PICKS);
                    if (SELECTED_ITEM) {
                        await Promise.resolve(
                            SELECTED_ITEM.action()
                        );
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.compare');
                    
                    deploy_helpers.showErrorMessage(
                        i18.t('compare.errors.operationFailed')
                    );
                }
            }),

            // handle current file(s) or folder(s)
            vscode.commands.registerCommand('extension.deploy.reloaded.currentFileOrFolder',
                async function (fileOrFolder?: vscode.Uri, allItems?: vscode.Uri[]) {
                    await deploy_commands.handleFilesAndFolders(
                        context,
                        fileOrFolder, allItems);
                }),            

            // list directory
            vscode.commands.registerCommand('extension.deploy.reloaded.listDirectory', async () => {
                try {
                    const TARGET = await deploy_targets.showTargetQuickPick(
                        context,
                        getAllTargetsSorted(),
                        {
                            placeHolder: i18.t('listDirectory.selectSource'),
                        }
                    );

                    if (TARGET) {
                        await TARGET.__workspace
                                    .listDirectory(TARGET);
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.listDirectory');

                    deploy_helpers.showErrorMessage(
                        i18.t('listDirectory.errors.operationFailed')
                    );
                }
            }),

            // API (hosts)
            vscode.commands.registerCommand('extension.deploy.reloaded.apis', async () => {
                try {
                    await deploy_api.showApiHostQuickPick();
                }
                catch (e) {
                    vscode.window.showErrorMessage(
                        i18.t('apis.errors.failed', e)  
                    );
                }
            }),

            // (TCP) proxies
            vscode.commands.registerCommand('extension.deploy.reloaded.proxies', async () => {
                try {
                    await deploy_proxies.showTcpProxyQuickPick();
                }
                catch (e) {
                    vscode.window.showErrorMessage(
                        i18.t('proxies.errors.failed', e)  
                    );
                }
            }),

            // quick code execution
            vscode.commands.registerCommand('extension.deploy.reloaded.quickExecution', async () => {
                try {
                    await deploy_tools_quick_execution._1b87f2ee_b636_45b6_807c_0e2d25384b02_1409614337(
                        context,
                        getAllWorkspacesSorted(),
                        activeWorkspaces.map(aws => aws),
                    );
                }
                catch (e) {
                    vscode.window.showErrorMessage(
                        i18.t('tools.quickExecution.errors.failed', e)  
                    );
                }
            }),

            // select workspace
            vscode.commands.registerCommand('extension.deploy.reloaded.selectWorkspace', async () => {
                try {
                    const SELECTED_WORKSPACE = await deploy_workspaces.showWorkspaceQuickPick(
                        context,
                        deploy_workspaces.getActiveWorkspaces()
                    );

                    if (SELECTED_WORKSPACE) {
                        activeWorkspaces = [ SELECTED_WORKSPACE ];
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.selectWorkspace');

                    deploy_helpers.showErrorMessage(
                        i18.t('workspaces.active.errors.selectWorkspaceFailed'),
                    );
                }
                finally {
                    await updateActiveWorkspaces();
                }
            }),

            // switches
            vscode.commands.registerCommand('extension.deploy.reloaded.switches', async () => {
                try {
                    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
                        {
                            action: async () => {
                                await deploy_switch.changeSwitch(
                                    getActiveWorkspacesOrAll()
                                );
                            },
                            label: '$(settings)  ' + i18.t('plugins.switch.changeSwitch.label'),
                            description: i18.t('plugins.switch.changeSwitch.description'),
                        },
                    ];

                    const SELECTED_ITEM = await vscode.window.showQuickPick(QUICK_PICKS);
                    if (SELECTED_ITEM) {
                        await Promise.resolve(
                            SELECTED_ITEM.action()
                        );
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.switches');

                    deploy_helpers.showErrorMessage(
                        i18.t('switches.errors.operationFailed')
                    );
                }
            }),

            // tools
            vscode.commands.registerCommand('extension.deploy.reloaded.showTools', async () => {
                try {
                    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.quickExecution');
                            },
                            label: '$(code)  ' + i18.t('tools.quickExecution.label'),
                            description: i18.t('tools.quickExecution.description'),
                            state: 0,
                        },

                        {
                            action: async () => {
                                await deploy_tools.createDeployScript(
                                    getActiveWorkspacesOrAll()
                                );
                            },
                            label: '$(plus)  ' + i18.t('tools.createDeployScript.label'),
                            description: i18.t('tools.createDeployScript.description'),
                            state: 1,
                        },

                        {
                            action: async () => {
                                await deploy_tools.createDeployOperationScript(
                                    context,
                                    getActiveWorkspacesOrAll()
                                );
                            },
                            label: '$(plus)  ' + i18.t('tools.createDeployOperationScript.label'),
                            description: i18.t('tools.createDeployOperationScript.description'),
                            state: 2,
                        },

                        {
                            action: async () => {
                                await deploy_tools.showPackageFiles(
                                    context,
                                    deploy_packages.getAllPackagesSorted()
                                );
                            },
                            label: '$(microscope)  ' + i18.t('tools.showPackageFiles.label'),
                            description: i18.t('tools.showPackageFiles.description'),
                            state: 3,
                        },

                        {
                            action: async () => {
                                await deploy_tools_send_file.sendOrReceiveFile(context);
                            },
                            label: '$(broadcast)  ' + i18.t('tools.sendOrReceiveFile.label'),
                            description: i18.t('tools.sendOrReceiveFile.description'),
                            state: 4,
                        },

                        {
                            action: async () => {
                                await deploy_tools_npm.showNPMTools(context);
                            },
                            label: '$(package)  ' + i18.t('tools.npm.label'),
                            description: i18.t('tools.npm.description'),
                            state: 5,
                        },

                        {
                            action: async () => {
                                await deploy_tools_composer.showComposerTools(context);
                            },
                            label: '$(package)  ' + i18.t('tools.composer.label'),
                            description: i18.t('tools.composer.description'),
                            state: 6,
                        },

                        {
                            action: async () => {
                                await deploy_tools_bower.showBowerTools(context);
                            },
                            label: '$(package)  ' + i18.t('tools.bower.label'),
                            description: i18.t('tools.bower.description'),
                            state: 7,
                        },

                        {
                            action: async () => {
                                await deploy_tools.detectGitChanges(context);
                            },
                            label: '$(git-compare)  ' + i18.t('tools.git.listFileChanges.label'),
                            description: i18.t('tools.git.listFileChanges.description'),
                            state: 8,
                        },

                        {
                            action: async () => {
                                await deploy_tools_yarn.showYarnTools(context);
                            },
                            label: '$(package)  ' + i18.t('tools.yarn.label'),
                            description: i18.t('tools.yarn.description'),
                            state: 9,
                        },
                    ];

                    const SELECTED_ITEM = await vscode.window.showQuickPick(
                        deploy_gui.sortQuickPicksByUsage(
                            QUICK_PICKS,
                            context.workspaceState,
                            deploy_tools.KEY_TOOL_USAGE,
                            (i) => {
                                // remove icon
                                return i.label
                                        .substr(i.label.indexOf(' '))
                                        .trim();
                            }
                        )
                    );

                    if (SELECTED_ITEM) {
                        await Promise.resolve(
                            SELECTED_ITEM.action()
                        );
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.showTools');

                    deploy_helpers.showErrorMessage(
                        i18.t('tools.errors.operationFailed')
                    );
                }
            }),
        );

        deploy_log.registerLogCommands(context);
        deploy_deploy.registerDeployCommands(context);
        deploy_pull.registerPullCommands(context);
        deploy_delete.registerDeleteCommands(context);
        deploy_tools_send_file.registerSendFileCommands(context);
        deploy_notifications.registerNotificationCommands(context, packageFile);
    });

    // load plugins
    WF.next(async () => {
        await reloadPlugins();

        let pluginInfo = '';

        pluginInfo += `${i18.t('plugins.__loaded', PLUGINS.length)}\n`;
        PLUGINS.forEach((pi) => {
            pluginInfo += `- ${pi.__type}\n`;
        });

        deploy_log.CONSOLE
                  .info(pluginInfo, 'extension.deploy.reloaded.loadPlugins');
    });

    // global VSCode events
    WF.next(() => {
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor((e) => {
                onDidChangeActiveTextEditor(e).then(() => {
                }).catch((err) => {
                    deploy_log.CONSOLE
                              .trace(err, 'vscode.window.onDidChangeActiveTextEditor');
                });
            }),

            vscode.workspace.onDidChangeConfiguration((e) => {
                deploy_tools_bower.resetBowerToolsUsage(context);
                deploy_tools_composer.resetComposerToolsUsage(context);
                deploy_tools_npm.resetNPMToolsUsage(context);
                deploy_packages.resetPackageUsage(context);
                deploy_targets.resetTargetUsage(context);
                deploy_tools.resetToolUsage(context);
                deploy_workspaces.resetWorkspaceUsage(context);
                deploy_tools_yarn.resetYarnToolsUsage(context);
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
        await workspaceWatcher.reload();

        await refreshActiveWorkspaceList();
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

    // update 'select workspace' button
    WF.next(async () => {
        await updateActiveWorkspaces();
    });

    // check for new version
    WF.next(async () => {
        if (!packageFile) {
            return;
        }

        const CURRENT_VERSION = deploy_helpers.normalizeString(packageFile.version);
        if ('' === CURRENT_VERSION) {
            return;
        }

        const STATE_KEY = 'vscdrLastKnownVersion';

        let update = true;
        try {
            const LAST_VERSION = deploy_helpers.normalizeString(
                context.globalState.get(STATE_KEY, '')
            );
            if ('' === LAST_VERSION) {
                return;
            }

            if (CompareVersion(CURRENT_VERSION, LAST_VERSION) <= 0) {
                update = false;
                return;
            }

            const CUR_DIR = __dirname;
            const CHANGELOG_FILE = Path.join(CUR_DIR, '../CHANGELOG.md');

            const MARKDOWN = (await deploy_helpers.readFile(CHANGELOG_FILE)).toString('utf8');

            deploy_html.openMarkdownDocument(MARKDOWN, {
                documentTitle: '[vscode-deploy-reloaded] ' + i18.t('changelog'),
            });
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'extension.checkForNewVersion(1)');
        }
        finally {
            if (update) {
                try {
                    context.globalState
                           .update(STATE_KEY, CURRENT_VERSION);
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.checkForNewVersion(2)');
                }
            }
        }
    });

    // display network info
    WF.next(() => {
        try {
            outputChannel.appendLine(i18.t('network.hostname',
                                           OS.hostname()));

            const NETWORK_INTERFACES = OS.networkInterfaces();

            const LIST_OF_IFNAMES = Object.keys(NETWORK_INTERFACES).sort((x, y) => {
                return deploy_helpers.compareValuesBy(x, y, n => {
                    return deploy_helpers.normalizeString(n);
                });
            });

            if (Object.keys(NETWORK_INTERFACES).length > 0) {
                outputChannel.appendLine(i18.t('network.interfaces.list'));
                
                for (const IFNAME of LIST_OF_IFNAMES) {
                    const IFACES = NETWORK_INTERFACES[IFNAME].filter(x => {
                        return !x.internal;
                    }).filter(x => {
                        let addr = deploy_helpers.normalizeString(x.address);
                        
                        if ('IPv4' === x.family) {
                            return !/^(127\.[\d.]+|[0:]+1|localhost)$/.test(addr);
                        }

                        if ('IPv6' === x.family) {
                            return '::1' !== addr;
                        }

                        return true;
                    }).sort((x, y) => {
                        return deploy_helpers.compareValuesBy(x, y, (i) => {
                            return 'IPv4' === i.family ? 0 : 1;
                        });
                    });

                    if (IFACES.length > 0) {
                        outputChannel.appendLine(`    - '${IFNAME}':`);
                        IFACES.forEach(x => {
                                            outputChannel.appendLine(`      [${x.family}] '${x.address}' / '${x.netmask}' ('${x.mac}')`);
                                       });

                        outputChannel.appendLine('');
                    }
                }
            }
            else {
                outputChannel.appendLine('');
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'extension.displayNetworkInfo()');
        }
    });

    // TCP hosts and proxies
    WF.next(() => {
        context.subscriptions.push(
            deploy_proxies.PROXY_DISPOSER
        );
    });

    WF.next(() => {
        outputChannel.appendLine('');
        outputChannel.appendLine(i18.t('extension.initialized'));
        outputChannel.appendLine('');
    });

    // notifications
    WF.next(() => {
        try {
            deploy_notifications.showExtensionNotifications(
                context, packageFile,
            ).then(() => {
            }, (err) => {
                deploy_log.CONSOLE
                          .trace(err, 'extension.notifications(2)');
            });
        } catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'extension.notifications(1)');
        }
    });

    if (!isDeactivating) {
        await WF.start();
    }
}

export function deactivate() {
    if (isDeactivating) {
        return;
    }
    isDeactivating = true;
}
