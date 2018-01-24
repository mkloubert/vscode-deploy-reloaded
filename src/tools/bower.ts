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


interface BowerJsonFile {
    dependencies?: {
        [ module: string ]: any
    };
}

const KEY_BOWER_TOOLS_USAGE = 'vscdrLastExecutedBowerToolActions';
const KEY_LAST_RUN_BOWER_INSTALL_PACKAGE = 'vscdrRunBowerInstallLastModule';


/**
 * Resets the bower tool usage statistics.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function resetBowerToolsUsage(context: vscode.ExtensionContext) {
    context.globalState.update(KEY_BOWER_TOOLS_USAGE, undefined).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'tools.bower.resetBowerToolsUsage()');
    });
}


async function runBowerInstall(ws: deploy_workspaces.Workspace) {
    const EXTENSION = ws.context.extension;

    const BOWER_PACKAGE = deploy_helpers.normalizeString(
        await vscode.window.showInputBox(
            {
                placeHolder: ws.t('tools.bower.packageExample'),
                prompt: ws.t('tools.bower.runInstall.enterPackageName'),
                value: deploy_helpers.normalizeString(
                    EXTENSION.globalState.get(KEY_LAST_RUN_BOWER_INSTALL_PACKAGE)
                )
            }
        ),
    );
    
    if ('' === BOWER_PACKAGE) {
        return;
    }

    EXTENSION.globalState.update(KEY_LAST_RUN_BOWER_INSTALL_PACKAGE, BOWER_PACKAGE).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'tools.bower.runBowerInstall(1)');
    });

    const CMD = `bower install --save ${BOWER_PACKAGE}`;

    ws.output.appendLine('');
    ws.output.append(
        ws.t('tools.bower.executing', CMD) + ' '
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

async function runBowerUninstall(ws: deploy_workspaces.Workspace) {
    const BOWER_JSON = Path.resolve(
        Path.join(
            ws.rootPath, 'bower.json',
        )
    );

    if (!(await deploy_helpers.exists(BOWER_JSON))) {
        ws.showWarningMessage(
            ws.t('tools.bower.runUninstall.bowerFileNotFound',
                 ws.rootPath),
        );

        return;
    }

    let file: BowerJsonFile;
    try {
        file = JSON.parse(
            (await deploy_helpers.readFile(BOWER_JSON)).toString('utf8')
        );
    }
    catch (e) {
        ws.showErrorMessage(
            ws.t('tools.bower.runUninstall.errors.loadingBowerFileFailed',
                 BOWER_JSON, e),
        );

        return;
    }

    if (!file) {
        file = {};
    }

    const PACKAGES: {
        name: string,
        version: string,
    }[] = [];

    if (file.dependencies) {
        for (const D in file.dependencies) {
            const PACKAGE_NAME = deploy_helpers.toStringSafe(D).trim();
            if ('' === PACKAGE_NAME) {
                continue;
            }

            PACKAGES.push({
                name: PACKAGE_NAME,
                version: deploy_helpers.toStringSafe(file.dependencies[D]).trim(),
            });
        }
    }

    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = PACKAGES.sort((x, y) => {
        return deploy_helpers.compareValuesBy(x, y,
                                              p => deploy_helpers.normalizeString(p.name));
    }).map(p => {
        return {
            action: () => {
                return p.name;
            },

            label: p.name,
            description: p.version,
            detail: BOWER_JSON,
        };
    });

    if (QUICK_PICKS.length < 1) {
        ws.showWarningMessage(
            ws.t('tools.bower.runUninstall.bowerFileContainsNoPackages',
                 BOWER_JSON),
        );
        
        return;
    }

    const SELECTED_ITEM = await vscode.window.showQuickPick(
        QUICK_PICKS
    );

    if (!SELECTED_ITEM) {
        return;
    }

    const BOWER_PACKAGE: string = SELECTED_ITEM.action();

    const CMD = `bower uninstall --save ${BOWER_PACKAGE}`;

    ws.output.appendLine('');
    ws.output.append(
        ws.t('tools.bower.executing', CMD) + ' '
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
 * Shows bower tools.
 * 
 * @param {vscode.ExtensionContext} context The extension context. 
 */
export async function showBowerTools(context: vscode.ExtensionContext) {
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
                await runBowerInstall(SELECTED_WORKSPACE);
            },

            description: SELECTED_WORKSPACE.t('tools.bower.runInstall.description'),
            detail: SELECTED_WORKSPACE.rootPath,
            label: SELECTED_WORKSPACE.t('tools.bower.runInstall.label'),

            state: 0,
        },

        {
            action: async () => {
                await runBowerUninstall(SELECTED_WORKSPACE);
            },

            description: SELECTED_WORKSPACE.t('tools.bower.runUninstall.description'),
            detail: SELECTED_WORKSPACE.rootPath,
            label: SELECTED_WORKSPACE.t('tools.bower.runUninstall.label'),

            state: 1,
        },
    ];

    const SELECTED_ITEM = await vscode.window.showQuickPick(
        deploy_gui.sortQuickPicksByUsage(
            QUICK_PICKS,
            SELECTED_WORKSPACE.context.extension.globalState,
            KEY_BOWER_TOOLS_USAGE,
        )
    );

    if (SELECTED_ITEM) {
        await SELECTED_ITEM.action();
    }
}
