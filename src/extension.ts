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
import * as deploy_commands from './commands';
import * as deploy_compare from './compare';
import * as deploy_contracts from './contracts';
import * as deploy_delete from './delete';
import * as deploy_deploy from './deploy';
import * as deploy_events from './events';
import * as deploy_gui from './gui';
import * as deploy_helpers from './helpers';
import * as deploy_html from './html';
import * as deploy_log from './log';
import * as deploy_packages from './packages';
import * as deploy_plugins from './plugins';
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
import * as deploy_workflows from './workflows';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as i18 from './i18';
import * as Moment from 'moment';
import * as OS from 'os';
import * as Path from 'path';
import * as vscode from 'vscode';


let activeWorkspaces: deploy_workspaces.Workspace[] = [];
let currentContext: vscode.ExtensionContext;
let fileWatcher: vscode.FileSystemWatcher;
let isDeactivating = false;
let nextWorkspaceId = Number.MAX_SAFE_INTEGER;
let outputChannel: vscode.OutputChannel;
let packageFile: deploy_contracts.PackageFile;
const PLUGINS: deploy_plugins.Plugin[] = [];
let selectWorkspaceBtn: vscode.StatusBarItem;
const WORKSPACE_COMMANDS: deploy_commands.WorkspaceCommandRepository = {};
const WORKSPACES: deploy_workspaces.Workspace[] = [];


function getActiveWorkspacesOrAll() {
    let listOfWorkspaces = deploy_helpers.asArray(activeWorkspaces);
    if (listOfWorkspaces.length < 1) {
        listOfWorkspaces = WORKSPACES;
    }

    return listOfWorkspaces.map(ws => ws);
}

function getAllWorkspacesSorted() {
    return Enumerable.from( WORKSPACES ).orderBy(ws => {
        return ws.isActive ? 0 : 1;
    }).thenBy(ws => {
        return deploy_helpers.normalizeString(ws.name);
    }).thenBy(ws => {
        return deploy_helpers.normalizeString(ws.rootPath);
    }).toArray();
}

function getAllPackagesSorted() {
    return Enumerable.from( getAllWorkspacesSorted() ).selectMany(ws => {
        return Enumerable.from( ws.getPackages() ).orderBy(pkg => {
            return deploy_helpers.normalizeString(
                deploy_packages.getPackageName(pkg)
            );
        }).thenBy(pkg => {
            return pkg.__index;
        });
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
                detail: t.__workspace.rootPath,
                label: deploy_targets.getTargetName(t),
            };
        });

        if (QUICK_PICK_ITEMS.length < 1) {
            deploy_helpers.showWarningMessage(
                i18.t('targets.noneFound')
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
        deploy_helpers.showWarningMessage(
            i18.t('editors.active.noOpen')
        );
    }
}

function normalizeActiveWorkspaces(aws: deploy_workspaces.Workspace | deploy_workspaces.Workspace[]) {
    aws = deploy_helpers.asArray(aws);

    if (aws.length < 1) {
        if (1 === WORKSPACES.length) {
            aws = deploy_helpers.asArray(
                Enumerable.from(WORKSPACES)
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
        await deploy_helpers.forEachAsync(WORKSPACES, async (ws) => {
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

    for (const WS of WORKSPACES) {
        try {
            if (WS.isPathOf(e.fsPath)) {
                await WS.onDidFileChange(e, type);
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'extension.onDidFileChange()');
        }
    }
}

async function onDidSaveTextDocument(e: vscode.TextDocument) {
    if (isDeactivating) {
        return;
    }

    for (const WS of WORKSPACES) {
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

async function reloadWorkspaceFolders(added: vscode.WorkspaceFolder[], removed?: vscode.WorkspaceFolder[]) {
    if (isDeactivating) {
        return;
    }

    if (removed) {
        for (let i = 0; i < WORKSPACES.length; ) {
            const WS = WORKSPACES[i];
            let removeWorkspace = false;
            let hasBeenRemoved = false;

            for (let rws of removed) {
                if (Path.resolve(rws.uri.fsPath) === Path.resolve(WS.folder.uri.fsPath)) {
                    removeWorkspace = true;
                    break;
                }
            }

            if (removeWorkspace) {
                outputChannel.append(i18.t('workspaces.removing',
                                           WS.folder.uri.fsPath) + ' ');
                try {
                    WS.dispose();

                    WORKSPACES.splice(i, 1);
                    hasBeenRemoved = true;

                    outputChannel.appendLine(`[${i18.t('ok')}]`);
                }
                catch (e) {
                    outputChannel.appendLine(`[${i18.t('error', e)}]`);
                }
                outputChannel.appendLine('');
            }

            if (!hasBeenRemoved) {
                ++i;
            }
        }
    }

    if (added) {
        for (const WSF of added) {
            let newWorkspace: deploy_workspaces.Workspace;
            try {
                const CTX: deploy_workspaces.WorkspaceContext = {
                    commands: WORKSPACE_COMMANDS,
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

                newWorkspace = new deploy_workspaces.Workspace(
                    nextWorkspaceId--, WSF, CTX
                );

                outputChannel.append(i18.t('workspaces.initializing',
                                           WSF.uri.fsPath) + ' ');
                try {
                    const HAS_BEEN_INITIALIZED = await newWorkspace.initialize();
                    if (HAS_BEEN_INITIALIZED) {
                        WORKSPACES.push(newWorkspace);

                        outputChannel.appendLine(`[${i18.t('ok')}]`);
                    }
                    else {
                        throw new Error(
                            i18.t('workspaces.errors.notInitialized',
                                  WSF.uri.fsPath)
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

                deploy_helpers.tryDispose(newWorkspace);
            }
        }
    }

    activeWorkspaces = normalizeActiveWorkspaces(WORKSPACES);

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
        const ACTIVE_WORKSPACES = deploy_helpers.asArray(activeWorkspaces)
                                                .map(ws => ws);

        let command: string;
        let color = '#ffffff';
        let text = 'Deploy Reloaded: ';
        if (ACTIVE_WORKSPACES.length < 1) {
            color = '#ffff00';
            text += `(${i18.t('workspaces.noSelected')})`;
        }
        else {
            text += Enumerable.from( ACTIVE_WORKSPACES ).select(ws => {
                return ws.name;
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
    const WF = deploy_workflows.build();

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
    const WF = deploy_workflows.build();

    WF.next(() => {
        currentContext = context;
    });

    // events
    WF.next(() => {
        context.subscriptions.push({
            dispose: () => {
                deploy_events.EVENTS
                             .removeAllListeners();
            }
        });
    });

    // output channel
    WF.next(() => {
        context.subscriptions.push(
            outputChannel = vscode.window.createOutputChannel('Deploy Reloaded')
        );
    });

    // workspace providers
    WF.next(() => {
        deploy_workspaces.setAllWorkspacesProvider(() => {
            return WORKSPACES;
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
                                await deploy_compare.compareFiles(WORKSPACES);
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

            // deploy
            vscode.commands.registerCommand('extension.deploy.reloaded.deploy', async () => {
                try {
                    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.deployFile');
                            },
                            label: '$(rocket)  ' + i18.t('deploy.currentFile.label'),
                            description: i18.t('deploy.currentFile.description'),
                        },
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.deployWorkspace');
                            },
                            label: '$(rocket)  ' + i18.t('deploy.package.label'),
                            description: i18.t('deploy.package.description'),
                        },
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.deployAllOpenFiles');
                            },
                            label: '$(rocket)  ' + i18.t('deploy.allOpenFiles.label'),
                            description: i18.t('deploy.allOpenFiles.description'),
                        },
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.deployGitCommit');
                            },
                            label: '$(git-commit)  ' + i18.t('deploy.gitCommit.label'),
                            description: i18.t('deploy.gitCommit.description'),
                        },
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.deployFileList');
                            },
                            label: '$(list-ordered)  ' + i18.t('deploy.fileList.label'),
                            description: i18.t('deploy.fileList.description'),
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
                              .trace(e, 'extension.deploy.reloaded.deploy');

                    deploy_helpers.showErrorMessage(
                        i18.t('deploy.errors.operationFailed')
                    );
                }
            }),

            // deploy file list
            vscode.commands.registerCommand('extension.deploy.reloaded.deployFileList', async () => {
                try {
                    await deploy_deploy.deployFileList(context);
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deployFileList');
                    
                    deploy_helpers.showErrorMessage(
                        i18.t('deploy.errors.operationFailed')
                    );
                }
            }),

            // deploy workspace
            vscode.commands.registerCommand('extension.deploy.reloaded.deployWorkspace', async () => {
                try {
                    const PKG = await deploy_packages.showPackageQuickPick(
                        context,
                        getAllPackagesSorted(),
                        {
                            placeHolder: i18.t('packages.selectPackage'),
                        }
                    );

                    if (PKG) {
                        await PKG.__workspace
                                 .deployPackage(PKG);
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deployWorkspace');
                    
                    deploy_helpers.showErrorMessage(
                        i18.t('deploy.errors.operationFailed')
                    );
                }
            }),

            // deploy current file
            vscode.commands.registerCommand('extension.deploy.reloaded.deployFile', async () => {
                try {
                    await invokeForActiveEditor(
                        i18.t('targets.selectTarget'),
                        async (file, target) => {
                            await target.__workspace
                                        .deployFileTo(file, target);
                        }
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deployFile');
                    
                    deploy_helpers.showErrorMessage(
                        i18.t('deploy.errors.operationFailed')
                    );
                }
            }),

            // deploy all open files
            vscode.commands.registerCommand('extension.deploy.reloaded.deployAllOpenFiles', async () => {
                try {
                    await deploy_deploy.deployAllOpenFiles(
                        WORKSPACES
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deployAllOpenFiles');
                    
                    deploy_helpers.showErrorMessage(
                        i18.t('deploy.errors.operationFailed')
                    );
                }
            }),

            // deploy git commit
            vscode.commands.registerCommand('extension.deploy.reloaded.deployGitCommit', async () => {
                try {
                    const WORKSPACE = await deploy_workspaces.showWorkspaceQuickPick(
                        context,
                        WORKSPACES,
                        {
                            placeHolder: i18.t('workspaces.selectWorkspace')
                        }
                    );

                    if (!WORKSPACE) {
                        return;
                    }

                    const TARGET = await WORKSPACE.showTargetQuickPick();
                    if (!TARGET) {
                        return;
                    }

                    await WORKSPACE.deployGitCommit(TARGET);
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deployGitCommit');
                    
                    deploy_helpers.showErrorMessage(
                        i18.t('deploy.errors.operationFailed')
                    );
                }
            }),

            // pull
            vscode.commands.registerCommand('extension.deploy.reloaded.pull', async () => {
                try {
                    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.pullFile');
                            },
                            label: '$(cloud-download)  ' + i18.t('pull.currentFile.label'),
                            description: i18.t('pull.currentFile.description'),
                        },

                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.pullWorkspace');
                            },
                            label: '$(cloud-download)  ' + i18.t('pull.package.label'),
                            description: i18.t('pull.package.description'),
                        },

                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.pullAllOpenFiles');
                            },
                            label: '$(cloud-download)  ' + i18.t('pull.allOpenFiles.label'),
                            description: i18.t('pull.allOpenFiles.description'),
                        },
                        
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.pullFileList');
                            },
                            label: '$(list-ordered)  ' + i18.t('pull.fileList.label'),
                            description: i18.t('pull.fileList.description'),
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
                              .trace(e, 'extension.deploy.reloaded.pull');

                    deploy_helpers.showErrorMessage(
                        i18.t('pull.errors.operationFailed')
                    );
                }
            }),

            // pull file list
            vscode.commands.registerCommand('extension.deploy.reloaded.pullFileList', async () => {
                try {
                    await deploy_pull.pullFileList(context);
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.pullFileList');
                    
                    deploy_helpers.showErrorMessage(
                        i18.t('pull.errors.operationFailed')
                    );
                }
            }),

            // pull workspace
            vscode.commands.registerCommand('extension.deploy.reloaded.pullWorkspace', async () => {
                try {
                    const PKG = await deploy_packages.showPackageQuickPick(
                        context,
                        getAllPackagesSorted(),
                        {
                            placeHolder: i18.t('packages.selectPackage'),
                        }
                    );

                    if (PKG) {
                        await PKG.__workspace
                                 .pullPackage(PKG);
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.pullWorkspace');

                    deploy_helpers.showErrorMessage(
                        i18.t('pull.errors.operationFailed')
                    );
                }
            }),

            // pull current file
            vscode.commands.registerCommand('extension.deploy.reloaded.pullFile', async () => {
                try {
                    await invokeForActiveEditor(
                        i18.t('pull.selectSource'),
                        async (file, target) => {
                            await target.__workspace
                                        .pullFileFrom(file, target);
                        }
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.pullFile');

                    deploy_helpers.showErrorMessage(
                        i18.t('pull.errors.operationFailed')
                    );
                }
            }),

            // pull all open files
            vscode.commands.registerCommand('extension.deploy.reloaded.pullAllOpenFiles', async () => {
                try {
                    await deploy_pull.pullAllOpenFiles(
                        WORKSPACES
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.pullAllOpenFiles');

                    deploy_helpers.showErrorMessage(
                        i18.t('pull.errors.operationFailed')
                    );
                }
            }),

            // delete
            vscode.commands.registerCommand('extension.deploy.reloaded.delete', async () => {
                try {
                    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.deleteFile');
                            },
                            label: '$(trashcan)  ' + i18.t('DELETE.currentFile.label'),
                            description: i18.t('DELETE.currentFile.description'),
                        },
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.deletePackage');
                            },
                            label: '$(trashcan)  ' + i18.t('DELETE.package.label'),
                            description: i18.t('DELETE.package.description'),
                        },
                        {
                            action: async () => {
                                await vscode.commands.executeCommand('extension.deploy.reloaded.deleteFileList');
                            },
                            label: '$(list-ordered)  ' + i18.t('DELETE.fileList.label'),
                            description: i18.t('DELETE.fileList.description'),
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
                              .trace(e, 'extension.deploy.reloaded.delete');

                    deploy_helpers.showErrorMessage(
                        i18.t('DELETE.errors.operationFailed')
                    );
                }
            }),

            // delete file list
            vscode.commands.registerCommand('extension.deploy.reloaded.deleteFileList', async () => {
                try {
                    await deploy_delete.deleteFileList(context);
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deleteFileList');
                    
                    deploy_helpers.showErrorMessage(
                        i18.t('DELETE.errors.operationFailed')
                    );
                }
            }),

            // delete package
            vscode.commands.registerCommand('extension.deploy.reloaded.deletePackage', async () => {
                try {
                    const PKG = await deploy_packages.showPackageQuickPick(
                        context,
                        getAllPackagesSorted(),
                        {
                            placeHolder: i18.t('packages.selectPackage'),
                        }
                    );

                    if (PKG) {
                        await PKG.__workspace
                                 .deletePackage(PKG);
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deletePackage');

                    deploy_helpers.showErrorMessage(
                        i18.t('DELETE.errors.operationFailed')
                    );
                }
            }),

            // delete current file
            vscode.commands.registerCommand('extension.deploy.reloaded.deleteFile', async () => {
                try {
                    await invokeForActiveEditor(
                        i18.t('targets.selectTarget'),
                        async (file, target) => {
                            await target.__workspace
                                        .deleteFileIn(file, target);
                        }
                    );
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.deleteFile');
                    
                    deploy_helpers.showErrorMessage(
                        i18.t('DELETE.errors.operationFailed')
                    );
                }
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
                        WORKSPACES
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
                                    getAllPackagesSorted()
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
                            label: '$(package)  ' + i18.t('tools.git.listFileChanges.label'),
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

            // receive file
            vscode.commands.registerCommand('extension.deploy.reloaded.receiveFile', async () => {
                try {
                    await deploy_tools_send_file.receiveFile(context);
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.receiveFile');

                    deploy_helpers.showErrorMessage(
                        i18.t('tools.errors.operationFailed')
                    );
                }
            }),

            // send file
            vscode.commands.registerCommand('extension.deploy.reloaded.sendFile', async () => {
                try {
                    await deploy_tools_send_file.sendFile(context);
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'extension.deploy.reloaded.sendFile');

                    deploy_helpers.showErrorMessage(
                        i18.t('tools.errors.operationFailed')
                    );
                }
            }),

            // close server instance that waits for a file
            vscode.commands.registerCommand(deploy_tools_send_file.CLOSE_SERVER_COMMAND, () => {
                deploy_tools_send_file.closeServer();
            }),
        );
    });

    // HTML document provider
    WF.next(() => {
        let htmlViewer: vscode.Disposable;
        let openHtmlCmd: vscode.Disposable;
        try {
            htmlViewer = vscode.workspace.registerTextDocumentContentProvider(deploy_html.HTML_URI_PROTOCOL,
                                                                              new deploy_html.HtmlTextDocumentContentProvider());
            
            openHtmlCmd = vscode.commands.registerCommand(deploy_html.OPEN_HTML_DOC_COMMAND, async (doc: deploy_contracts.Document) => {
                try {
                    const URL = vscode.Uri.parse(`${deploy_html.HTML_URI_PROTOCOL}://authority/?id=${encodeURIComponent(deploy_helpers.toStringSafe(doc.id))}` + 
                                                 `&x=${encodeURIComponent(deploy_helpers.toStringSafe(new Date().getTime()))}`);

                    let title = deploy_helpers.toStringSafe(doc.title).trim();
                    if ('' === title) {
                        title = `[vscode-deploy-reloaded] ${i18.t('documents.html.defaultName', doc.id)}`;
                    }

                    try {
                        return await vscode.commands.executeCommand('vscode.previewHtml',
                                                                    URL, vscode.ViewColumn.One, title);
                    }
                    finally {
                        deploy_html.removeDocuments(doc);
                    }
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, deploy_html.OPEN_HTML_DOC_COMMAND);
                }
            });

            context.subscriptions.push(
                htmlViewer, openHtmlCmd
            );
        }
        catch (e) {
            deploy_helpers.tryDispose(htmlViewer);
            deploy_helpers.tryDispose(openHtmlCmd);

            deploy_log.CONSOLE
                      .trace(e, 'extension.deploy.reloaded.initHtmlDocProvider');
        }
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
                deploy_tools_bower.resetBowerToolsUsage(context);
                deploy_tools_composer.resetComposerToolsUsage(context);
                deploy_tools_npm.resetNPMToolsUsage(context);
                deploy_packages.resetPackageUsage(context);
                deploy_targets.resetTargetUsage(context);
                deploy_tools.resetToolUsage(context);
                deploy_workspaces.resetWorkspaceUsage(context);
                deploy_tools_yarn.resetYarnToolsUsage(context);

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

    WF.next(() => {
        outputChannel.appendLine('');
        outputChannel.appendLine(i18.t('extension.initialized'));
        outputChannel.appendLine('');
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

    deploy_helpers.tryDispose(fileWatcher);

    while (WORKSPACES.length > 0) {
        deploy_helpers.tryDispose(
            WORKSPACES.pop()
        );
    }

    deploy_helpers.tryDispose(outputChannel);
}
