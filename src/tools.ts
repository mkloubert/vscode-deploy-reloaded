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
import * as deploy_html from './html';
import * as deploy_packages from './packages';
import * as deploy_targets from './targets';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as HtmlEntities from 'html-entities';
import * as i18 from './i18';
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * Creates a deploy script.
 * 
 * @param {deploy_workspaces.Workspace|deploy_workspaces.Workspace[]} workspaces One or more workspaces. 
 */
export async function createDeployScript(workspaces: deploy_workspaces.Workspace | deploy_workspaces.Workspace[]) {
    workspaces = deploy_helpers.asArray(workspaces);

    const QUICK_PICKS: deploy_contracts.ActionQuickPick<deploy_workspaces.Workspace>[] = workspaces.map(ws => {
        return {
            label: ws.name,
            description: '',
            detail: ws.rootPath,
            state: ws,
        };
    });

    if (QUICK_PICKS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('workspaces.noneFound')
        );

        return;
    }

    let selectedWorkspace: deploy_workspaces.Workspace;

    if (1 === QUICK_PICKS.length) {
        selectedWorkspace = QUICK_PICKS[0].state;
    }
    else {
        const SELECTED_ITEM = await vscode.window.showQuickPick(QUICK_PICKS, {
            placeHolder: i18.t('workspaces.selectWorkspace'),
        });

        if (SELECTED_ITEM) {
            selectedWorkspace = SELECTED_ITEM.state;
        }
    }

    if (!selectedWorkspace) {
        return;
    }

    let scriptFile = './deploy.js';
    let scopeDir = selectedWorkspace.rootPath;

    if (await deploy_helpers.exists(selectedWorkspace.settingFolder)) {
        if ((await deploy_helpers.lstat(selectedWorkspace.settingFolder)).isDirectory()) {
            scopeDir = selectedWorkspace.settingFolder;
        }
    }

    if (!Path.isAbsolute(scriptFile)) {
        scriptFile = Path.resolve(
            Path.join(scopeDir, scriptFile)
        );
    }

    // find unique name
    let doesExist: boolean;
    let index = 0;
    do {
        doesExist = false;

        if (await deploy_helpers.exists(scriptFile)) {
            if ((await deploy_helpers.lstat(scriptFile)).isFile()) {
                doesExist = true;
            }
        }

        if (doesExist) {
            ++index;

            const DIR = Path.dirname(scriptFile);
            const EXT = Path.extname(scriptFile);
            const BASENAME = Path.basename(scriptFile, EXT);

            scriptFile = Path.resolve(
                Path.join(DIR,
                          `${BASENAME}-${index}${EXT}`)
            );
        }
    }
    while (doesExist);

    scriptFile = await vscode.window.showInputBox({
        prompt: selectedWorkspace.t('tools.createDeployScript.askForScriptPath'),
        value: scriptFile,
    });

    if (deploy_helpers.isEmptyString(scriptFile)) {
        return;
    }

    let scriptContent = `// Node.js API provided by Visual Studio Code: https://nodejs.org/en/docs
const Path = require('path');

// Visual Studio Code API: https://code.visualstudio.com/docs/extensionAPI/vscode-api
const vscode = require('vscode');


// entry point
exports.execute = function(args) {
    // args: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_plugins_script_.scriptarguments.html

    // module shipped with extension: https://github.com/mkloubert/vscode-deploy-reloaded/blob/master/package.json
    const FSExtra = args.require('fs-extra');
    // module of extension: https://github.com/mkloubert/vscode-deploy-reloaded/tree/master/src
    const Helpers = args.require('./helpers');

    if (0 == args.operation)
        // Delete files
        return deleteFiles(args);  // s. below

    if (1 == args.operation)
        // Deploy / upload
        return deployFiles(args);  // s. below

    if (2 == args.operation)
        // list directory
        return listDirectory(args);  // s. below

    if (3 == args.operation)
        // Pull / download
        return pullFiles(args);  // s. below

    throw new Error(args.operation + ' operation is not supported!');
};


// DELETE
function deleteFiles(args) {
    return new Promise((resolve, reject) => {
        try {
            for (let file of args.files) {
                // file: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_plugins_.filetodelete.html

                if (args.isCancelling)
                    break;  // user wants to cancel

                try {
                    file.onBeforeDelete();  // tell that we are going to start the
                                            // delete operation for this file now
                                            // 
                                            // you can submit an optional string that
                                            // is displayed as 'destination' in the GUI
                                            //
                                            // this is done async

                    // do the delete operation here
                    throw new Error('Not implemented!');

                    file.onDeleteCompleted();  // tell that anything worked fine (async)
                }
                catch (e) {
                    file.onDeleteCompleted(e);  // submit the error (async)
                }
            }

            resolve();
        }
        catch (e) {
            reject( e );
        }
    });
}

// DEPLOY / UPLOAD
function deployFiles(args) {
    return new Promise((resolve, reject) => {
        try {
            for (let file of args.files) {
                // file: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_plugins_.filetoupload.html

                if (args.isCancelling)
                    break;  // user wants to cancel

                try {
                    file.onBeforeUpload();  // tell that we are going to start the
                                            // deploy operation for this file now
                                            // 
                                            // you can submit an optional string that
                                            // is displayed as 'destination' in the GUI
                                            //
                                            // this is done async

                    // do the deploy operation here
                    
                    // reads the content of this file async
                    // and returns a Promise with the buffer
                    // of the data to deploy
                    // 
                    let contentToDeploy = file.read();

                    throw new Error('Not implemented!');

                    file.onUploadCompleted();  // tell that anything worked fine (async)
                }
                catch (e) {
                    file.onUploadCompleted(e);  // submit the error (async)
                }
            }

            resolve();
        }
        catch (e) {
            reject( e );
        }
    });
}

// LIST DIRECTORY
function listDirectory(args) {
    return new Promise((resolve, reject) => {
        try {
            let result = {
                dirs: [],   // DirectoryInfo: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_files_.directoryinfo.html
                files: [],  // FileInfo: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_files_.fileinfo.html
                others: [],  // other FileSystemInfo objects: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_files_.filesysteminfo.html
                target: args.target
            };

            // the directory to list is stored in
            // 'args.dir'

            // args.isCancelling provides if
            // user wants to cancel or not

            throw new Error('Not implemented!');

            resolve( result );
        }
        catch (e) {
            reject( e );
        }
    });
}

// PULL / DOWNLOAD
function pullFiles(args) {
    return new Promise((resolve, reject) => {
        try {
            for (let file of args.files) {
                // file: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_plugins_.filetodownload.html

                if (args.isCancelling)
                    break;  // user wants to cancel

                try {
                    file.onBeforeDownload();  // tell that we are going to start the
                                              // pull operation for this file now
                                              // 
                                              // you can submit an optional string that
                                              // is displayed as 'source' in the GUI
                                              //
                                              // this is done async

                    // do the pull operation here
                    // 
                    // we store the data in 'downloadedData' var
                    // for this example
                    // 
                    // recommended is to load the data as buffer
                    // or readable NodeJS stream
                    throw new Error('Not implemented!');

                    // tell that anything worked fine
                    // and submit the data to write
                    // 
                    // this is done async
                    file.onDownloadCompleted(null, downloadedData);
                }
                catch (e) {
                    file.onDownloadCompleted(e);  // submit the error (async)
                }
            }

            resolve();
        }
        catch (e) {
            reject( e );
        }
    });
}
`;

    await deploy_helpers.writeFile(scriptFile,
                                   new Buffer(scriptContent, 'utf8'));

    try {
        const ASK_IF_WRITE_TO_SETTINGS_ITEMS: deploy_contracts.MessageItemWithValue[] = [
            {
                isCloseAffordance: true,
                title: selectedWorkspace.t('no'),
                value: 0,
            },

            {
                title: selectedWorkspace.t('yes'),
                value: 1,
            }
        ];

        const SELECTED_ITEM: deploy_contracts.MessageItemWithValue =
            await selectedWorkspace.showWarningMessage
                                   .apply(selectedWorkspace,
                                          [ <any>selectedWorkspace.t('tools.createDeployScript.askForUpdatingSettings') ].concat(ASK_IF_WRITE_TO_SETTINGS_ITEMS));

        if (SELECTED_ITEM) {
            if (1 === SELECTED_ITEM.value) {
                let targetExists: boolean;
                let newTargetName: string;
                do
                {
                    targetExists = false;

                    newTargetName = await vscode.window.showInputBox({
                        placeHolder: selectedWorkspace.t('tools.createDeployScript.askForNewTargetName'),
                    });

                    if (deploy_helpers.isEmptyString(newTargetName)) {
                        break;
                    }

                    targetExists = Enumerable.from( selectedWorkspace.getTargets() ).any(t => {
                        return deploy_helpers.normalizeString(t.name) ===
                               deploy_helpers.normalizeString(newTargetName);
                    });

                    if (targetExists) {
                        selectedWorkspace.showWarningMessage(
                            selectedWorkspace.t('tools.createDeployScript.targetAlreadyDefined')
                        );
                    }
                }
                while (targetExists);

                if (!deploy_helpers.isEmptyString(newTargetName)) {
                    const CFG = selectedWorkspace.config;

                    const TARGETS_FROM_CFG = deploy_helpers.asArray(
                        CFG.targets
                    );

                    let targetScriptPath = scriptFile;
                    if (scriptFile.startsWith(selectedWorkspace.settingFolder)) {
                        targetScriptPath = './' + deploy_helpers.normalizePath(
                            scriptFile.substr(selectedWorkspace.settingFolder.length)
                        );
                    }

                    TARGETS_FROM_CFG.push(
                        <any>{
                            name: newTargetName.trim(),
                            options: {
                                exampleSetting1: true,
                                exampleSetting2: null,
                                exampleSetting3: "3",
                                exampleSetting4: 4.5,
                                exampleSetting5: [ false, null, "6", 7.8 ],
                                exampleSetting6: {
                                    exampleSubSetting6_1: "1.1",
                                    exampleSubSetting6_2: 2.3
                                }
                            },
                            script: targetScriptPath,
                            type: 'script'
                        }
                    );

                    const CLONED_CFG = deploy_helpers.cloneObjectWithoutFunctions(CFG);
                    (<any>CLONED_CFG).targets = deploy_helpers.cloneObject(TARGETS_FROM_CFG);

                    const SETTINGS_FILE = Path.resolve(
                        selectedWorkspace.configSource.resource.fsPath,
                    );
                    const SETTINGS_SECTION = selectedWorkspace.configSource.section;

                    let settings: any;
                    if (await deploy_helpers.exists(SETTINGS_FILE)) {
                        settings = JSON.parse(
                            (await deploy_helpers.readFile(SETTINGS_FILE)).toString('utf8')
                        );
                    }

                    if (deploy_helpers.isNullOrUndefined(settings)) {
                        settings = {};
                    }

                    settings[SETTINGS_SECTION] = CLONED_CFG;

                    await deploy_helpers.writeFile(
                        SETTINGS_FILE,
                        new Buffer( JSON.stringify(settings, null, 4) )
                    );
                }
            }
        }
    }
    catch (e) {
        selectedWorkspace.showWarningMessage(
            selectedWorkspace.t('tools.createDeployScript.errors.updateTargetSettingsFailed', e)
        );
    }

    selectedWorkspace.showInformationMessage(
        selectedWorkspace.t('tools.createDeployScript.scriptCreated', scriptFile)
    );

    await vscode.window.showTextDocument(
        await vscode.workspace.openTextDocument(scriptFile)
    );
}

/**
 * Creates a script for a deploy operation.
 * 
 * @param {deploy_workspaces.Workspace|deploy_workspaces.Workspace[]} workspaces One or more workspaces. 
 */
export async function createDeployOperationScript(workspaces: deploy_workspaces.Workspace | deploy_workspaces.Workspace[]) {
    workspaces = deploy_helpers.asArray(workspaces);

    const QUICK_PICKS: deploy_contracts.ActionQuickPick<deploy_workspaces.Workspace>[] = workspaces.map(ws => {
        return {
            label: ws.name,
            description: '',
            detail: ws.rootPath,
            state: ws,
        };
    });

    if (QUICK_PICKS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('workspaces.noneFound')
        );

        return;
    }

    let selectedWorkspace: deploy_workspaces.Workspace;

    if (1 === QUICK_PICKS.length) {
        selectedWorkspace = QUICK_PICKS[0].state;
    }
    else {
        const SELECTED_ITEM = await vscode.window.showQuickPick(QUICK_PICKS, {
            placeHolder: i18.t('workspaces.selectWorkspace'),
        });

        if (SELECTED_ITEM) {
            selectedWorkspace = SELECTED_ITEM.state;
        }
    }

    if (!selectedWorkspace) {
        return;
    }

    let scriptFile: string;
    let operationEvent: deploy_targets.TargetOperationEvent;
    
    const OPERATION_TYPE_QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
        {
            label: selectedWorkspace.t('tools.createDeployOperationScript.askForOperationType.afterDeployment'),
            description: '',
            action: () => {
                operationEvent = deploy_targets.TargetOperationEvent.AfterDeployed;
                scriptFile = './afterDeployed.js';
            }
        },

        {
            label: selectedWorkspace.t('tools.createDeployOperationScript.askForOperationType.beforeDeploy'),
            description: '',
            action: () => {
                operationEvent = deploy_targets.TargetOperationEvent.BeforeDeploy;
                scriptFile = './beforeDeploy.js';
            }
        },
    ];

    const SELECTED_OPERATION_TYPE_QUICK_PICK = await vscode.window.showQuickPick(
        OPERATION_TYPE_QUICK_PICKS,
        {
            placeHolder: selectedWorkspace.t('tools.createDeployOperationScript.askForOperationType.placeHolder'),
        }
    );
    if (!SELECTED_OPERATION_TYPE_QUICK_PICK) {
        return;
    }

    SELECTED_OPERATION_TYPE_QUICK_PICK.action();

    let scopeDir = selectedWorkspace.rootPath;

    if (await deploy_helpers.exists(selectedWorkspace.settingFolder)) {
        if ((await deploy_helpers.lstat(selectedWorkspace.settingFolder)).isDirectory()) {
            scopeDir = selectedWorkspace.settingFolder;
        }
    }

    if (!Path.isAbsolute(scriptFile)) {
        scriptFile = Path.resolve(
            Path.join(scopeDir, scriptFile)
        );
    }

    // find unique name
    let doesExist: boolean;
    let index = 0;
    do {
        doesExist = false;

        if (await deploy_helpers.exists(scriptFile)) {
            if ((await deploy_helpers.lstat(scriptFile)).isFile()) {
                doesExist = true;
            }
        }

        if (doesExist) {
            ++index;

            const DIR = Path.dirname(scriptFile);
            const EXT = Path.extname(scriptFile);
            const BASENAME = Path.basename(scriptFile, EXT);

            scriptFile = Path.resolve(
                Path.join(DIR,
                          `${BASENAME}-${index}${EXT}`)
            );
        }
    }
    while (doesExist);

    scriptFile = await vscode.window.showInputBox({
        prompt: selectedWorkspace.t('tools.createDeployOperationScript.askForScriptPath'),
        value: scriptFile,
    });

    if (deploy_helpers.isEmptyString(scriptFile)) {
        return;
    }

    let scriptContent = `// Node.js API provided by Visual Studio Code: https://nodejs.org/en/docs
const Path = require('path');

// Visual Studio Code API: https://code.visualstudio.com/docs/extensionAPI/vscode-api
const vscode = require('vscode');


// entry point
exports.execute = function(args) {
    // args: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_targets_operations_script_.scripttargetoperationexecutionarguments.html

    // you also can execute the
    // function synchronous
    return new Promise((resolve, reject) => {
        try {
            // the root path of the underyling workspace
            const WORKSPACE_DIR = args.context.target.__workspace.rootPath;


            // replace the following TEST CODE
            for (let file of args.context.files) {
                vscode.window.showWarningMessage(
                    'File: ' + Path.join(WORKSPACE_DIR, file)
                );
            }


            // call this on SUCCESS
            resolve();
        }
        catch (e) {
            // call this on ERROR
            reject( e );
        }
    });
}
`;

    await deploy_helpers.writeFile(scriptFile,
                                   new Buffer(scriptContent, 'utf8'));

    const WORKSPACE_TARGETS = selectedWorkspace.getTargets();
    if (WORKSPACE_TARGETS.length > 0) {
        try {
            const ASK_IF_WRITE_TO_SETTINGS_ITEMS: deploy_contracts.MessageItemWithValue[] = [
                {
                    isCloseAffordance: true,
                    title: selectedWorkspace.t('no'),
                    value: 0,
                },

                {
                    title: selectedWorkspace.t('yes'),
                    value: 1,
                }
            ];

            const SELECTED_ITEM: deploy_contracts.MessageItemWithValue =
                await selectedWorkspace.showWarningMessage
                                    .apply(selectedWorkspace,
                                            [ <any>selectedWorkspace.t('tools.createDeployOperationScript.askForUpdatingSettings') ].concat(ASK_IF_WRITE_TO_SETTINGS_ITEMS));

            if (SELECTED_ITEM) {
                if (1 === SELECTED_ITEM.value) {
                    const selectedTarget = await deploy_targets.showTargetQuickPick(
                        WORKSPACE_TARGETS,
                        {
                            placeHolder: selectedWorkspace.t('tools.createDeployOperationScript.selectTarget')
                        }
                    );

                    if (selectedTarget) {
                        const CFG = selectedWorkspace.config;

                        const TARGETS_FROM_CFG = deploy_helpers.asArray(
                            CFG.targets
                        );

                        const CLONED_CFG = deploy_helpers.cloneObjectWithoutFunctions(CFG);
                        (<any>CLONED_CFG).targets = deploy_helpers.cloneObject(TARGETS_FROM_CFG);

                        const SETTINGS_FILE = Path.resolve(
                            selectedWorkspace.configSource.resource.fsPath,
                        );
                        const SETTINGS_SECTION = selectedWorkspace.configSource.section;

                        const CLONED_TARGETS_FROM_CFG = deploy_helpers.asArray(
                            CLONED_CFG.targets
                        );

                        let targetScriptPath = scriptFile;
                        if (scriptFile.startsWith(selectedWorkspace.settingFolder)) {
                            targetScriptPath = './' + deploy_helpers.normalizePath(
                                scriptFile.substr(selectedWorkspace.settingFolder.length)
                            );
                        }

                        let operationStorage: deploy_targets.TargetOperationValue[] | false = false;
                        let updater: () => void;

                        const TARGET_ITEM_FROM_CLONED_CFG = CLONED_TARGETS_FROM_CFG[selectedTarget.__index];
                        if (TARGET_ITEM_FROM_CLONED_CFG) {
                            switch (operationEvent) {
                                case deploy_targets.TargetOperationEvent.AfterDeployed:
                                    operationStorage = deploy_helpers.asArray(TARGET_ITEM_FROM_CLONED_CFG.deployed);
                                    updater = () => {
                                        (<any>TARGET_ITEM_FROM_CLONED_CFG).deployed = <any>operationStorage;
                                    };
                                    break;

                                case deploy_targets.TargetOperationEvent.BeforeDeploy:
                                    operationStorage = deploy_helpers.asArray(TARGET_ITEM_FROM_CLONED_CFG.beforeDeploy);
                                    updater = () => {
                                        (<any>TARGET_ITEM_FROM_CLONED_CFG).beforeDeploy = <any>operationStorage;
                                    };
                                    break;
                            }
                        }

                        if (false === operationStorage) {
                            return;
                        }

                        let newTargetOperationName = await vscode.window.showInputBox({
                            placeHolder: selectedWorkspace.t('tools.createDeployOperationScript.askForNewOperationName'),
                        });
                        newTargetOperationName = deploy_helpers.toStringSafe(newTargetOperationName).trim();
                        if ('' === newTargetOperationName) {
                            newTargetOperationName = undefined;
                        }

                        operationStorage.push(<any>{
                            name: newTargetOperationName,
                            script: targetScriptPath,                                
                            type: 'script'
                        });

                        updater();

                        let settings: any;
                        if (await deploy_helpers.exists(SETTINGS_FILE)) {
                            settings = JSON.parse(
                                (await deploy_helpers.readFile(SETTINGS_FILE)).toString('utf8')
                            );
                        }

                        if (deploy_helpers.isNullOrUndefined(settings)) {
                            settings = {};
                        }

                        settings[SETTINGS_SECTION] = CLONED_CFG;

                        await deploy_helpers.writeFile(
                            SETTINGS_FILE,
                            new Buffer( JSON.stringify(settings, null, 4) )
                        );
                    }
                }
            }
        }
        catch (e) {
            selectedWorkspace.showWarningMessage(
                selectedWorkspace.t('tools.createDeployOperationScript.errors.updateSettingsFailed', e)
            );
        }
    }

    selectedWorkspace.showInformationMessage(
        selectedWorkspace.t('tools.createDeployOperationScript.scriptCreated', scriptFile)
    );

    await vscode.window.showTextDocument(
        await vscode.workspace.openTextDocument(scriptFile)
    );
}


export async function showPackageFiles(workspaces: deploy_workspaces.Workspace | deploy_workspaces.Workspace[]) {
    workspaces = deploy_helpers.asArray(workspaces);

    const QUICK_PICKS: deploy_contracts.ActionQuickPick<deploy_packages.Package>[] = Enumerable.from(workspaces).selectMany((ws) => {
        return ws.getPackages();
    }).select(pkg => {
        return {
            label: deploy_packages.getPackageName(pkg),
            description: deploy_helpers.toStringSafe(pkg.description).trim(),
            detail: pkg.__workspace.rootPath,
            state: pkg,
        };
    }).orderBy(qp => {
        return deploy_helpers.normalizeString(qp.label);
    }).toArray();

    if (QUICK_PICKS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('packages.noneFound')
        );

        return;
    }

    let selectedItem: deploy_contracts.ActionQuickPick<deploy_packages.Package>;
    if (1 === QUICK_PICKS.length) {
        selectedItem = QUICK_PICKS[0];
    }
    else {
        selectedItem = await vscode.window.showQuickPick(
            QUICK_PICKS,
            {
                placeHolder: i18.t('packages.selectPackage'),
            }
        );
    }

    if (!selectedItem) {
        return;
    }

    const HTML_ENCODER = new HtmlEntities.AllHtmlEntities();
    const PACKAGE = selectedItem.state;
    const PACKAGE_NAME = deploy_packages.getPackageName(PACKAGE);
    const WORKSPACE = PACKAGE.__workspace;

    const FILES = Enumerable.from( await WORKSPACE.findFilesByFilter(PACKAGE) ).select(f => {
        let realtivePath = WORKSPACE.toRelativePath(f);
        if (false === realtivePath) {
            realtivePath = f;
        }

        return realtivePath;
    }).distinct()
      .orderBy(f => {
        return Path.dirname(f).length;
    }).thenBy(f => {
        return deploy_helpers.normalizeString( Path.dirname(f) );
    }).thenBy(f => {
        return deploy_helpers.normalizeString( Path.basename(f) );
    }).toArray();

    let md = "# " + HTML_ENCODER.encode( WORKSPACE.t('workspace') ) + "\n";
    md += "`" + HTML_ENCODER.encode(WORKSPACE.rootPath) + "`\n";

    md += "## " + WORKSPACE.t('files') + "\n";

    if (FILES.length > 0) {
        md += "| " + WORKSPACE.t('file') + " |\n";
        md += "| ---- |\n";

        for (const F of FILES) {
            md += "| `" + HTML_ENCODER.encode(F) + "` |\n";
        }
    }
    else {
        md += "\n";
        md += WORKSPACE.t('noFiles');
    }

    await deploy_html.openMarkdownDocument(md, {
        documentTitle: "[vscode-deploy-reloaded] " + WORKSPACE.t('tools.showPackageFiles.title',
                                                                 PACKAGE_NAME),
    });
}
