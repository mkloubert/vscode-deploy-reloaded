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
 * Executes a Visual Studio Code command.
 */
export interface VSCommandTargetOperation extends deploy_targets.TargetOperation {
    /**
     * The arguments for the command.
     */
    readonly arguments?: any[];
    /**
     * The command to execute.
     */
    readonly command: string;
}


/** @inheritdoc */
export async function execute(context: deploy_targets.TargetOperationExecutionContext<VSCommandTargetOperation>) {
    const OPERATION = context.operation;
    const TARGET = context.target;
    const WORKSPACE = TARGET.__workspace;

    const COMMAND = deploy_helpers.toStringSafe(
        WORKSPACE.replaceWithValues(
            OPERATION.command
        )
    );

    let args: any[];
    if (deploy_helpers.isNullOrUndefined(OPERATION.arguments)) {
        args = [];
    }
    else {
        args = deploy_helpers.asArray(OPERATION.arguments);
    }

    await vscode.commands.executeCommand
                         .apply(null, [ <any>COMMAND ].concat(args));
}
