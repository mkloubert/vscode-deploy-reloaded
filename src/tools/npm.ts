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

import * as deploy_contracts from '../contracts';
import * as deploy_gui from '../gui';
import * as deploy_helpers from '../helpers';
import * as deploy_log from '../log';
import * as deploy_workspaces from '../workspaces';
import * as i18 from '../i18';
import * as Path from 'path';
import * as vscode from 'vscode';


interface PackageJsonFile {
    dependencies?: {
        [ module: string ]: any
    };
}

const KEY_NPM_TOOLS_USAGE = 'vscdrLastExecutedNPMToolActions';
const KEY_LAST_RUN_NPM_INSTALL_MODULE = 'vscdrRunNPMInstallLastModule';
const KEY_LAST_RUN_NPM_LINK_MODULE = 'vscdrRunNPMLinkLastModule';


/**
 * Resets the NPM tool usage statistics.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function resetNPMToolsUsage(context: vscode.ExtensionContext) {
    context.globalState.update(KEY_NPM_TOOLS_USAGE, undefined).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'tools.npm.resetNPMToolsUsage()');
    });
}

async function runNPMInstall(ws: deploy_workspaces.Workspace) {
    const EXTENSION = ws.context.extension;

    const NPM_MODULE = deploy_helpers.normalizeString(
        await vscode.window.showInputBox(
            {
                placeHolder: ws.t('tools.npm.moduleExample'),
                prompt: ws.t('tools.npm.runInstall.enterModuleName'),
                value: deploy_helpers.normalizeString(
                    EXTENSION.globalState.get(KEY_LAST_RUN_NPM_INSTALL_MODULE)
                )
            }
        ),
    );
    
    if ('' === NPM_MODULE) {
        return;
    }

    EXTENSION.globalState.update(KEY_LAST_RUN_NPM_INSTALL_MODULE, NPM_MODULE).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'tools.npm.runNPMInstall(1)');
    });

    const CMD = `npm install --save ${NPM_MODULE}`;

    ws.output.appendLine('');
    ws.output.append(
        ws.t('tools.npm.executing', CMD) + ' '
    );
    try {
        await ws.exec(CMD);

        ws.output.appendLine(
            `[${ws.t('ok')}]`
        );
    }
    catch (e) {
        ws.output.appendLine(
            `[${ws.t('error', e)}]`
        );
    }
}

async function runNPMLink(ws: deploy_workspaces.Workspace) {
    const EXTENSION = ws.context.extension;

    const NPM_MODULE = deploy_helpers.normalizeString(
        await vscode.window.showInputBox(
            {
                placeHolder: ws.t('tools.npm.moduleExample'),
                prompt: ws.t('tools.npm.runLink.enterModuleName'),
                value: deploy_helpers.normalizeString(
                    EXTENSION.globalState.get(KEY_LAST_RUN_NPM_LINK_MODULE)
                )
            }
        ),
    );
    
    if ('' === NPM_MODULE) {
        return;
    }

    EXTENSION.globalState.update(KEY_LAST_RUN_NPM_LINK_MODULE, NPM_MODULE).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'tools.npm.runNPMLink(1)');
    });

    const CMD = `npm link ${NPM_MODULE}`;

    ws.output.appendLine('');
    ws.output.append(
        ws.t('tools.npm.executing', CMD) + ' '
    );
    try {
        await ws.exec(CMD);

        ws.output.appendLine(
            `[${ws.t('ok')}]`
        );
    }
    catch (e) {
        ws.output.appendLine(
            `[${ws.t('error', e)}]`
        );
    }
}

async function runNPMUnInstall(ws: deploy_workspaces.Workspace) {
    const PACKAGE_JSON = Path.resolve(
        Path.join(
            ws.rootPath, 'package.json',
        )
    );

    if (!(await deploy_helpers.exists(PACKAGE_JSON))) {
        ws.showWarningMessage(
            ws.t('tools.npm.runUninstall.packageFileNotFound',
                 ws.rootPath),
        );

        return;
    }

    let file: PackageJsonFile;
    try {
        file = JSON.parse(
            (await deploy_helpers.readFile(PACKAGE_JSON)).toString('utf8')
        );
    }
    catch (e) {
        ws.showErrorMessage(
            ws.t('tools.npm.runUninstall.errors.loadingPackageFileFailed',
                 PACKAGE_JSON, e),
        );

        return;
    }

    if (!file) {
        file = {};
    }

    const MODULES: {
        name: string,
        version: string,
    }[] = [];

    if (file.dependencies) {
        for (const M in file.dependencies) {
            const MODULE_NAME = deploy_helpers.toStringSafe(M).trim();
            if ('' === MODULE_NAME) {
                continue;
            }

            MODULES.push({
                name: MODULE_NAME,
                version: deploy_helpers.toStringSafe(file.dependencies[M]).trim(),
            });
        }
    }

    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = MODULES.sort((x, y) => {
        return deploy_helpers.compareValuesBy(x, y,
                                              m => deploy_helpers.normalizeString(m.name));
    }).map(m => {
        return {
            action: () => {
                return m.name;
            },

            label: m.name,
            description: m.version,
            detail: PACKAGE_JSON,
        };
    });

    if (QUICK_PICKS.length < 1) {
        ws.showWarningMessage(
            ws.t('tools.npm.runUninstall.packageFileContainsNoModules',
                 PACKAGE_JSON),
        );
        
        return;
    }

    const SELECTED_ITEM = await vscode.window.showQuickPick(
        QUICK_PICKS
    );

    if (!SELECTED_ITEM) {
        return;
    }

    const NPM_MODULE: string = SELECTED_ITEM.action();

    const CMD = `npm uninstall --save ${NPM_MODULE}`;

    ws.output.appendLine('');
    ws.output.append(
        ws.t('tools.npm.executing', CMD) + ' '
    );
    try {
        await ws.exec(CMD);

        ws.output.appendLine(
            `[${ws.t('ok')}]`
        );
    }
    catch (e) {
        ws.output.appendLine(
            `[${ws.t('error', e)}]`
        );
    }
}

/**
 * Shows npm tools.
 * 
 * @param {vscode.ExtensionContext} context The extension context. 
 */
export async function showNPMTools(context: vscode.ExtensionContext) {
    const SELECTED_WORKSPACE = await deploy_workspaces.showWorkspaceQuickPick(
        context,
        deploy_workspaces.getActiveWorkspaces(),
        {
            placeHolder: i18.t('workspaces.selectWorkspace')
        }
    );

    if (!SELECTED_WORKSPACE) {
        return;
    }

    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
        {
            action: async () => {
                await runNPMInstall(SELECTED_WORKSPACE);
            },

            description: SELECTED_WORKSPACE.t('tools.npm.runInstall.description'),
            detail: SELECTED_WORKSPACE.rootPath,
            label: SELECTED_WORKSPACE.t('tools.npm.runInstall.label'),

            state: 0,
        },

        {
            action: async () => {
                await runNPMLink(SELECTED_WORKSPACE);
            },

            description: SELECTED_WORKSPACE.t('tools.npm.runLink.description'),
            detail: SELECTED_WORKSPACE.rootPath,
            label: SELECTED_WORKSPACE.t('tools.npm.runLink.label'),

            state: 1,
        },

        {
            action: async () => {
                await runNPMUnInstall(SELECTED_WORKSPACE);
            },

            description: SELECTED_WORKSPACE.t('tools.npm.runUninstall.description'),
            detail: SELECTED_WORKSPACE.rootPath,
            label: SELECTED_WORKSPACE.t('tools.npm.runUninstall.label'),

            state: 2,
        },
    ];

    const SELECTED_ITEM = await vscode.window.showQuickPick(
        deploy_gui.sortQuickPicksByUsage(
            QUICK_PICKS,
            SELECTED_WORKSPACE.context.extension.globalState,
            KEY_NPM_TOOLS_USAGE,
        )
    );

    if (SELECTED_ITEM) {
        await SELECTED_ITEM.action();
    }
}
