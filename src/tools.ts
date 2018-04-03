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
import * as deploy_html from './html';
import * as deploy_log from './log';
import * as deploy_packages from './packages';
import * as deploy_scm from './scm';
import * as deploy_targets from './targets';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as HtmlEntities from 'html-entities';
import * as i18 from './i18';
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * The memento key for the tool usage statistics.
 */
export const KEY_TOOL_USAGE = 'vscdrLastExecutedToolActions';

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
async function deleteFiles(args) {
    for (let file of args.files) {
        // file: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_plugins_.filetodelete.html

        if (args.isCancelling)
            break;  // user wants to cancel

        try {
            await file.onBeforeDelete();  // tell that we are going to start the
                                          // delete operation for this file now
                                          // 
                                          // you can submit an optional string that
                                          // is displayed as 'destination' in the GUI

            // do the delete operation here
            throw new Error('Not implemented!');

            await file.onDeleteCompleted();  // tell that anything worked fine
        }
        catch (e) {
            await file.onDeleteCompleted(e);  // submit the error
        }
    }
}

// DEPLOY / UPLOAD
async function deployFiles(args) {
    for (let file of args.files) {
        // file: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_plugins_.filetoupload.html

        if (args.isCancelling)
            break;  // user wants to cancel

        try {
            await file.onBeforeUpload();  // tell that we are going to start the
                                          // deploy operation for this file now
                                          // 
                                          // you can submit an optional string that
                                          // is displayed as 'destination' in the GUI

            let contentToDeploy = await Promise.resolve( file.read() );

            throw new Error('Not implemented!');

            await file.onUploadCompleted();  // tell that anything worked fine
        }
        catch (e) {
            await file.onUploadCompleted(e);  // submit the error
        }
    }
}

// LIST DIRECTORY
async function listDirectory(args) {
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

    return result;
}

// PULL / DOWNLOAD
async function pullFiles(args) {
    for (let file of args.files) {
        // file: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_plugins_.filetodownload.html

        if (args.isCancelling)
            break;  // user wants to cancel

        try {
            await file.onBeforeDownload();  // tell that we are going to start the
                                            // pull operation for this file now
                                            // 
                                            // you can submit an optional string that
                                            // is displayed as 'source' in the GUI

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
            await file.onDownloadCompleted(null, downloadedData);
        }
        catch (e) {
            await file.onDownloadCompleted(e);  // submit the error
        }
    }
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
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {deploy_workspaces.Workspace|deploy_workspaces.Workspace[]} workspaces One or more workspaces. 
 */
export async function createDeployOperationScript(context: vscode.ExtensionContext,
                                                  workspaces: deploy_workspaces.Workspace | deploy_workspaces.Workspace[]) {
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
exports.execute = async function(args) {
    // args: https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_targets_operations_script_.scripttargetoperationexecutionarguments.html

    // the root path of the underyling workspace
    const WORKSPACE_DIR = args.context.target.__workspace.rootPath;


    // replace the following TEST CODE
    for (let file of args.context.files) {
        vscode.window.showWarningMessage(
            'File: ' + Path.join(WORKSPACE_DIR, file)
        );
    }
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
                        context,
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

/**
 * Detects changes between two git commits.
 * 
 * @param {vscode.ExtensionContext} context The underlying extension context.
 */
export async function detectGitChanges(context: vscode.ExtensionContext) {
    const SELECT_WORKSPACE = await deploy_workspaces.showWorkspaceQuickPick(
        context,
        deploy_workspaces.getAllWorkspaces(),
    );
    if (!SELECT_WORKSPACE) {
        return;
    }

    const GIT_FOLDER = SELECT_WORKSPACE.gitFolder;
    if (!GIT_FOLDER) {
        return;
    }

    const GIT = await SELECT_WORKSPACE.createGitClient();
    if (!GIT) {
        return;
    }

    const RANGE = await deploy_scm.showSCMCommitRangeQuickPick(GIT);
    if (!RANGE) {
        return;
    }

    //TODO: replace withProgress() with notification API
    await deploy_helpers.withProgress(async (ctx) => {
        const BRANCH = RANGE.from.branch;
        const TOTAL_COUNT = await BRANCH.commitCount();
        const SKIP = TOTAL_COUNT - RANGE.from.index - 1;

        const COMMIT_WINDOW: deploy_scm.Commit[] = [];

        const ALL_CHANGES: deploy_contracts.KeyValuePairs<deploy_scm.FileChange> = {};
        let page = 0;
        let run: boolean;
        do
        {
            ++page;
            run = true;

            ctx.message = SELECT_WORKSPACE.t(
                'scm.loadingCommits',
                BRANCH.id, page,
            );

            const CURRENT_COMMITS = await BRANCH.commits(page, SKIP);
            if (CURRENT_COMMITS.length < 1) {
                break;
            }

            for (const C of CURRENT_COMMITS) {
                COMMIT_WINDOW.unshift(C);

                if (C.id === RANGE.to.id) {
                    run = false;
                    break;
                }
            }
        }
        while (run);

        for (let i = 0; i < COMMIT_WINDOW.length; i++) {
            const C = COMMIT_WINDOW[i];

            ctx.message = SELECT_WORKSPACE.t(
                'scm.loadingCommitChanges',
                C.id, i + 1, COMMIT_WINDOW.length,
            );

            const COMMIT_CHANGES = await C.changes();
            for (const CHG of COMMIT_CHANGES) {
                ALL_CHANGES[CHG.file] = CHG;
            }
        }

        const ADDED_FILES: string[] = [];
        const DELETED_FILES: string[] = [];
        const MODIFIED_FILES: string[] = [];
        for (const FILE in ALL_CHANGES) {
            const CHG = ALL_CHANGES[FILE];

            const FULL_PATH = Path.resolve(
                GIT_FOLDER, '..', CHG.file,
            );

            const RELATIVE_PATH = SELECT_WORKSPACE.toRelativePath(FULL_PATH);
            if (false === RELATIVE_PATH) {
                continue;
            }

            switch (CHG.type) {
                case deploy_scm.FileChangeType.Added:
                    ADDED_FILES.push(RELATIVE_PATH);
                    break;

                case deploy_scm.FileChangeType.Deleted:
                    DELETED_FILES.push(RELATIVE_PATH);
                    break;

                case deploy_scm.FileChangeType.Modified:
                    MODIFIED_FILES.push(RELATIVE_PATH);
                    break;
            }
        }

        if (_.isEmpty(ADDED_FILES) && _.isEmpty(DELETED_FILES) && _.isEmpty(MODIFIED_FILES)) {
            SELECT_WORKSPACE.showWarningMessage(
                SELECT_WORKSPACE.t('scm.changes.noneFound')
            );

            return;        
        }

        const DOC = await vscode.workspace.openTextDocument({
            content: '',
            language: 'markdown',
        });
        const EDITOR = await vscode.window.showTextDocument(DOC);

        const EOL = deploy_helpers.toEOL(DOC.eol);

        let text = '';

        const FILES_TO_DISPLAY = [
            [ DELETED_FILES, SELECT_WORKSPACE.t('scm.changes.deleted') ],
            [ ADDED_FILES, SELECT_WORKSPACE.t('scm.changes.added') ],
            [ MODIFIED_FILES, SELECT_WORKSPACE.t('scm.changes.modified') ],
        ];
        for (const ITEM of FILES_TO_DISPLAY) {
            const FTD = <string[]>ITEM[0];
            const HEADER = <string>ITEM[1];

            if (FTD.length < 1) {
                continue;
            }

            text += EOL + `# ${HEADER}` + EOL;

            const SORTED_FILE_LIST = Enumerable
                .from(FTD)
                .distinct()
                .orderBy(f => deploy_helpers.normalizeString(Path.dirname(f)).length)
                .thenBy(f => deploy_helpers.normalizeString(Path.dirname(f)))
                .thenBy(f => deploy_helpers.normalizeString(Path.basename(f)).length)
                .thenBy(f => deploy_helpers.normalizeString(Path.basename(f)));

            for (const FILE of SORTED_FILE_LIST) {
                text += FILE + EOL;            
            }
        }

        await EDITOR.edit((builder) => {
            builder.insert(
                new vscode.Position(0, 0),
                text.trim(),
            );
        });
    });
}

/**
 * Resets the package usage statistics.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function resetToolUsage(context: vscode.ExtensionContext) {
    context.workspaceState.update(KEY_TOOL_USAGE, undefined).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'tools.resetToolUsage()');
    });
}

/**
 * Shows the list of files of a package.
 * 
 * @param {context: vscode.ExtensionContext} context The extension context.
 * @param {deploy_packages.Package|deploy_packages.Package[]} packages The available packages. 
 */
export async function showPackageFiles(context: vscode.ExtensionContext,
                                       packages: deploy_packages.Package | deploy_packages.Package[]) {
    const PACKAGE = await deploy_packages.showPackageQuickPick(
        context,
        packages,
        {
            placeHolder: i18.t('packages.selectPackage'),
        }
    );

    if (!PACKAGE) {
        return;
    }

    const HTML_ENCODER = new HtmlEntities.AllHtmlEntities();
    const PACKAGE_NAME = deploy_packages.getPackageName(PACKAGE);
    const WORKSPACE = PACKAGE.__workspace;

    const PACKAGE_FILES = Enumerable.from( await WORKSPACE.findFilesByFilter(PACKAGE) ).select(f => {
        let realtivePath = WORKSPACE.toRelativePath(f);
        if (false === realtivePath) {
            realtivePath = f;
        }

        return realtivePath;
    }).toArray();

    let md = "# " + HTML_ENCODER.encode( WORKSPACE.t('workspace') ) + "\n";
    md += "`" + HTML_ENCODER.encode(WORKSPACE.rootPath) + "`\n";

    md += "## " + WORKSPACE.t('files') + "\n";

    let files = PACKAGE_FILES.map(f => f);

    // import files from git
    await deploy_packages.importPackageFilesFromGit(PACKAGE,
                                                    deploy_contracts.DeployOperation.Deploy,
                                                    files);
    await deploy_packages.importPackageFilesFromGit(PACKAGE,
                                                    deploy_contracts.DeployOperation.Pull,
                                                    files);
    await deploy_packages.importPackageFilesFromGit(PACKAGE,
                                                    deploy_contracts.DeployOperation.Delete,
                                                    files);

    files = Enumerable.from(files).distinct().orderBy(f => {
        return Path.dirname(f).length;
    }).thenBy(f => {
        return deploy_helpers.normalizeString( Path.dirname(f) );
    }).thenBy(f => {
        return deploy_helpers.normalizeString( Path.basename(f) );
    }).toArray();

    if (files.length > 0) {
        md += "| " + WORKSPACE.t('file') + " | D-O-S<sup>1</sup> | D-O-C<sup>2</sup> | S-W-O<sup>3</sup> | R-O-C<sup>4</sup> \n";
        md += "| ---- |\n";

        for (const F of files) {
            const FULL_PATH = Path.join(
                WORKSPACE.rootPath, F
            );

            let deployOnSave = '';
            {
                let deployOnSaveTargets = await deploy_helpers.applyFuncFor(
                    deploy_packages.findTargetsForFileOfPackage,
                    WORKSPACE
                )(FULL_PATH,
                  () => PACKAGE.deployOnSave,
                  () => {
                      return deploy_packages.getFastFileCheckFlag(
                          PACKAGE, (p) => p.fastCheckOnSave,
                          WORKSPACE.config, (c) => c.fastCheckOnSave,
                      );
                  });
                
                if (false !== deployOnSaveTargets) {
                    if (deployOnSaveTargets.length > 0) {
                        deployOnSave = Enumerable.from( deployOnSaveTargets ).select(t => {
                            return deploy_targets.getTargetName(t);
                        }).orderBy(tn => {
                            return deploy_helpers.normalizeString(tn);
                        }).select(tn => {
                            return '`' + HTML_ENCODER.encode(tn) + '`';
                        }).joinToString(', ');
                    }
                }
            }

            let deployOnChange = '';
            {
                let deployOnChangeTargets = await deploy_helpers.applyFuncFor(
                    deploy_packages.findTargetsForFileOfPackage,
                    WORKSPACE
                )(FULL_PATH,
                  () => PACKAGE.deployOnChange,
                  () => {
                      return deploy_packages.getFastFileCheckFlag(
                          PACKAGE, (p) => p.fastCheckOnChange,
                          WORKSPACE.config, (c) => c.fastCheckOnChange,
                      );
                  });
                
                if (false !== deployOnChangeTargets) {
                    if (deployOnChangeTargets.length > 0) {
                        deployOnChange = Enumerable.from( deployOnChangeTargets ).select(t => {
                            return deploy_targets.getTargetName(t);
                        }).orderBy(tn => {
                            return deploy_helpers.normalizeString(tn);
                        }).select(tn => {
                            return '`' + HTML_ENCODER.encode(tn) + '`';
                        }).joinToString(', ');
                    }
                }
            }

            let syncWhenOpen = '';
            {
                let syncWhenOpenTargets = await deploy_helpers.applyFuncFor(
                    deploy_packages.findTargetsForFileOfPackage,
                    WORKSPACE
                )(FULL_PATH,
                  () => PACKAGE.syncWhenOpen,
                  () => {
                      return deploy_packages.getFastFileCheckFlag(
                          PACKAGE, (p) => p.fastCheckOnSync,
                          WORKSPACE.config, (c) => c.fastCheckOnSync,
                      );
                  });
                
                if (false !== syncWhenOpenTargets) {
                    if (syncWhenOpenTargets.length > 0) {
                        syncWhenOpen = Enumerable.from( syncWhenOpenTargets ).select(t => {
                            return deploy_targets.getTargetName(t);
                        }).orderBy(tn => {
                            return deploy_helpers.normalizeString(tn);
                        }).select(tn => {
                            return '`' + HTML_ENCODER.encode(tn) + '`';
                        }).joinToString(', ');
                    }
                }
            }

            let removeOnChange = '';
            {
                let removeOnChangeTargets = await deploy_helpers.applyFuncFor(
                    deploy_packages.findTargetsForFileOfPackage,
                    WORKSPACE
                )(FULL_PATH,
                  () => PACKAGE.removeOnChange,
                  () => true);
                
                if (false !== removeOnChangeTargets) {
                    if (removeOnChangeTargets.length > 0) {
                        removeOnChange = Enumerable.from( removeOnChangeTargets ).select(t => {
                            return deploy_targets.getTargetName(t);
                        }).orderBy(tn => {
                            return deploy_helpers.normalizeString(tn);
                        }).select(tn => {
                            return '`' + HTML_ENCODER.encode(tn) + '`';
                        }).joinToString(', ');
                    }
                }
            }

            md += "| `" + HTML_ENCODER.encode(F) + "` | " + deployOnSave + " | " + deployOnChange + " | " + syncWhenOpen + " | " + removeOnChange + " |\n";
        }

        md += "<br /><br />";
        md += "<sup>1</sup>&nbsp;&nbsp;" + HTML_ENCODER.encode(WORKSPACE.t('deploy.onSave.text')) + "\n";
        md += "<sup>2</sup>&nbsp;&nbsp;" + HTML_ENCODER.encode(WORKSPACE.t('deploy.onChange.text')) + "\n";
        md += "<sup>3</sup>&nbsp;&nbsp;" + HTML_ENCODER.encode(WORKSPACE.t('sync.whenOpen.text')) + "\n";
        md += "<sup>4</sup>&nbsp;&nbsp;" + HTML_ENCODER.encode(WORKSPACE.t('DELETE.onChange.text')) + "\n";
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
