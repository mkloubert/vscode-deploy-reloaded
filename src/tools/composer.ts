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


interface ComposerJsonFile {
    require?: {
        [ module: string ]: any
    };
}

const KEY_COMPOSER_TOOLS_USAGE = 'vscdrLastExecutedComposerToolActions';
const KEY_LAST_RUN_COMPOSER_REQUIRE_PACKAGE = 'vscdrRunComposerRequireLastModule';


/**
 * Resets the composer tool usage statistics.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function resetComposerToolsUsage(context: vscode.ExtensionContext) {
    context.globalState.update(KEY_COMPOSER_TOOLS_USAGE, undefined).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'tools.composer.resetComposerToolsUsage()');
    });
}

async function runComposerRemove(ws: deploy_workspaces.Workspace) {
    const COMPOSER_JSON = Path.resolve(
        Path.join(
            ws.rootPath, 'composer.json',
        )
    );

    if (!(await deploy_helpers.exists(COMPOSER_JSON))) {
        ws.showWarningMessage(
            ws.t('tools.composer.runRemove.composerFileNotFound',
                 ws.rootPath),
        );

        return;
    }

    let file: ComposerJsonFile;
    try {
        file = JSON.parse(
            (await deploy_helpers.readFile(COMPOSER_JSON)).toString('utf8')
        );
    }
    catch (e) {
        ws.showErrorMessage(
            ws.t('tools.composer.runRemove.errors.loadingComposerFileFailed',
                 COMPOSER_JSON, e),
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

    if (file.require) {
        for (const P in file.require) {
            const PACKAGE_NAME = deploy_helpers.toStringSafe(P).trim();
            if ('' === PACKAGE_NAME) {
                continue;
            }

            PACKAGES.push({
                name: PACKAGE_NAME,
                version: deploy_helpers.toStringSafe(file.require[P]).trim(),
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
            detail: COMPOSER_JSON,
        };
    });

    if (QUICK_PICKS.length < 1) {
        ws.showWarningMessage(
            ws.t('tools.composer.runRemove.composerFileContainsNoPackages',
                 COMPOSER_JSON),
        );
        
        return;
    }

    const SELECTED_ITEM = await vscode.window.showQuickPick(
        QUICK_PICKS
    );

    if (!SELECTED_ITEM) {
        return;
    }

    const COMPOSER_PACKAGE: string = SELECTED_ITEM.action();

    const CMD = `composer remove ${COMPOSER_PACKAGE}`;

    ws.output.appendLine('');
    ws.output.append(
        ws.t('tools.composer.executing', CMD) + ' '
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

async function runComposerRequire(ws: deploy_workspaces.Workspace) {
    const EXTENSION = ws.context.extension;

    const COMPOSER_PACKAGE = deploy_helpers.normalizeString(
        await vscode.window.showInputBox(
            {
                placeHolder: ws.t('tools.composer.packageExample'),
                prompt: ws.t('tools.composer.runRequire.enterPackageName'),
                value: deploy_helpers.normalizeString(
                    EXTENSION.globalState.get(KEY_LAST_RUN_COMPOSER_REQUIRE_PACKAGE)
                )
            }
        ),
    );
    
    if ('' === COMPOSER_PACKAGE) {
        return;
    }

    EXTENSION.globalState.update(KEY_LAST_RUN_COMPOSER_REQUIRE_PACKAGE, COMPOSER_PACKAGE).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'tools.composer.runComposerRequire(1)');
    });

    const CMD = `composer require ${COMPOSER_PACKAGE}`;

    ws.output.appendLine('');
    ws.output.append(
        ws.t('tools.composer.executing', CMD) + ' '
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
 * Shows composer tools.
 * 
 * @param {vscode.ExtensionContext} context The extension context. 
 */
export async function showComposerTools(context: vscode.ExtensionContext) {
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
                await runComposerRequire(SELECTED_WORKSPACE);
            },

            description: SELECTED_WORKSPACE.t('tools.composer.runRequire.description'),
            detail: SELECTED_WORKSPACE.rootPath,
            label: SELECTED_WORKSPACE.t('tools.composer.runRequire.label'),

            state: 0,
        },

        {
            action: async () => {
                await runComposerRemove(SELECTED_WORKSPACE);
            },

            description: SELECTED_WORKSPACE.t('tools.composer.runRemove.description'),
            detail: SELECTED_WORKSPACE.rootPath,
            label: SELECTED_WORKSPACE.t('tools.composer.runRemove.label'),

            state: 1,
        },
    ];

    const SELECTED_ITEM = await vscode.window.showQuickPick(
        deploy_gui.sortQuickPicksByUsage(
            QUICK_PICKS,
            SELECTED_WORKSPACE.context.extension.globalState,
            KEY_COMPOSER_TOOLS_USAGE,
        )
    );

    if (SELECTED_ITEM) {
        await SELECTED_ITEM.action();
    }
}
