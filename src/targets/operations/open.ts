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

import * as deploy_helpers from '../../helpers';
import * as deploy_targets from '../../targets';
import * as vscode from 'vscode';


/**
 * An operation for open something.
 */
export interface OpenTargetOperation extends deploy_targets.TargetOperation {
    /**
     * The target to open.
     */
    readonly target: string;
    /**
     * Wait until operation has been finished or not.
     */
    readonly wait?: boolean;
}


/** @inheritdoc */
export async function execute(context: deploy_targets.TargetOperationExecutionContext<OpenTargetOperation>) {
    const TARGET_TO_OPEN = deploy_helpers.toStringSafe(context.operation.target);
    if (deploy_helpers.isEmptyString(TARGET_TO_OPEN)) {
        return;
    }

    const WORKSPACE = context.target.__workspace;
    const WAIT = deploy_helpers.toBooleanSafe(context.operation.wait, true);

    await deploy_helpers.open(TARGET_TO_OPEN, {
        cwd: WORKSPACE.folder.uri.fsPath,
        wait: WAIT,
    });
}
