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
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * An operation for executing something inside the workspace folder.
 */
export interface ExecTargetOperation extends deploy_targets.TargetOperation {
    /**
     * The (shell) command to execute.
     */
    readonly command: string;
    /**
     * The custom working directory.
     */
    readonly cwd?: string;
    /**
     * Do not use placeholders in 'command' property.
     */
    readonly noPlaceHolders?: boolean;
}


/** @inheritdoc */
export async function execute(context: deploy_targets.TargetOperationExecutionContext<ExecTargetOperation>) {
    const OPERATION = context.operation;
    const TARGET = context.target;
    const WORKSPACE = TARGET.__workspace;

    let command = deploy_helpers.toStringSafe(OPERATION.command);
    if (!deploy_helpers.toBooleanSafe(OPERATION.noPlaceHolders)) {
        command = WORKSPACE.replaceWithValues(command);
    }

    let cwd = deploy_helpers.toStringSafe(
        WORKSPACE.replaceWithValues( OPERATION.cwd )
    );
    if (deploy_helpers.isEmptyString(cwd)) {
        cwd = WORKSPACE.rootPath;
    }
    if (!Path.isAbsolute(cwd)) {
        cwd = Path.join(WORKSPACE.rootPath, cwd);
    }
    cwd = Path.resolve(cwd);

    await deploy_helpers.exec(command, {
        cwd: cwd,
    });
}
