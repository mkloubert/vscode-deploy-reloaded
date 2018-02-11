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
import * as deploy_log from '../../log';
import * as deploy_targets from '../../targets';
import * as Path from 'path';


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
     * Largest amount of data in bytes allowed on stdout or stderr.
     */
    readonly maxBuffer?: number;
    /**
     * Do not use placeholders in 'command' property.
     */
    readonly noPlaceHolders?: boolean;
    /**
     * Print the result from stdout to output channel or not.
     */
    readonly printOutput?: boolean;
    /**
     * Execution timeout.
     */
    readonly timeout?: number;
}


/** @inheritdoc */
export async function execute(context: deploy_targets.TargetOperationExecutionContext<ExecTargetOperation>) {
    const OPERATION = context.operation;
    const OPERATION_NAME = deploy_helpers.toStringSafe(OPERATION.name).trim();
    const TARGET = context.target;
    const TARGET_NAME = deploy_targets.getTargetName(TARGET);
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

    let maxBuffer = parseInt(
        deploy_helpers.toStringSafe(OPERATION.maxBuffer).trim()
    );
    if (isNaN(maxBuffer)) {
        maxBuffer = undefined;
    }

    let timeout = parseInt(
        deploy_helpers.toStringSafe(OPERATION.timeout).trim()
    );
    if (isNaN(timeout)) {
        timeout = undefined;
    }

    const RESULT = await deploy_helpers.exec(command, {
        cwd: cwd,
        maxBuffer: maxBuffer,
        timeout: timeout,
    });

    if (deploy_helpers.toBooleanSafe(OPERATION.printOutput, true)) {
        const OUTPUT = deploy_helpers.toStringSafe(RESULT.stdOut);

        if ('' !== OUTPUT) {
            WORKSPACE.output.appendLine('');
            WORKSPACE.output.appendLine('');

            WORKSPACE.output.appendLine(OUTPUT); 
            
            WORKSPACE.output.appendLine('');
        }
    }

    const ERR = deploy_helpers.toStringSafe(RESULT.stdErr);
    if ('' !== ERR) {
        deploy_log.CONSOLE
                  .err(ERR, `targets.operations.exec('${TARGET_NAME}' :: '${OPERATION_NAME}')`);
    }
}
