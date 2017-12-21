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


/**
 * An operation that waits a number of milliseconds.
 */
export interface WaitTargetOperation extends deploy_targets.TargetOperation {
    /**
     * The time in milliseconds to wait.
     */
    readonly time?: number;
}


/** @inheritdoc */
export async function execute(context: deploy_targets.TargetOperationExecutionContext<WaitTargetOperation>) {
    let timeToWait = parseInt(
        deploy_helpers.toStringSafe(context.operation.time).trim()
    );
    if (isNaN(timeToWait)) {
        timeToWait = 1000;
    }

    await deploy_helpers.sleep(timeToWait);
}
