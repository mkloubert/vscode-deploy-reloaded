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
import * as deploy_workspaces from './workspaces';
import * as vscode from 'vscode';


/**
 * A target.
 */
export interface Target {
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the zero-based of that target.
     */
    readonly __index: number;
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the underlying workspace.
     */
    readonly __workspace: deploy_workspaces.Workspace;

    /**
     * A description.
     */
    readonly description?: string;
    /**
     * The (display) name.
     */
    readonly name?: string;
    /**
     * The type.
     */
    readonly type?: string;
}

/**
 * Returns the name for a target.
 * 
 * @param {Target} target The target.
 * 
 * @return {string} The name. 
 */
export function getTargetName(target: Target): string {
    if (!target) {
        return;
    }

    const TRANSLATOR: deploy_contracts.Translator = target.__workspace;

    let name = deploy_helpers.toStringSafe(target.name).trim();
    if ('' === name) {
        name = TRANSLATOR.t('targets.defaultName', target.__index + 1);
    }

    return name;
}

/**
 * Shows a quick for targets.
 * 
 * @param {TTarget|TTarget[]} targets One or more target.
 * @param {string} placeHolder The placeholder.
 * @param {Function} action The action to invoke.
 * @param {TNoTargets} [ifNoTargets] The custom value to return if no target was found.
 * 
 * @return {TResult|TNoTargets|void} The result of the action (if available) or 'ifNoTargets' if no target has been found.
 */
export async function showTargetQuickPick<TTarget extends Target = Target, TResult = any, TNoTargets = false>(
    targets: TTarget | TTarget[],
    placeHolder: string,
    action: (target: TTarget) => TResult,
    ifNoTargets: TNoTargets = <any>false,
): Promise<TResult | TNoTargets | void>
{
    targets = deploy_helpers.asArray(targets)
                            .filter(t => 'object' === typeof t);
    
    const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = targets.map(t => {
        return {
            action: async () => {
                if (action) {
                    await Promise.resolve(
                        action(t)
                    )
                }
            },
            description: deploy_helpers.toStringSafe( t.description ).trim(),
            detail: t.__workspace.FOLDER.uri.fsPath,
            label: getTargetName(t),
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
            placeHolder: deploy_helpers.toStringSafe(placeHolder),
        });
    }

    if (selectedItem) {
        return await Promise.resolve(
            selectedItem.action(),
        );
    }
}
