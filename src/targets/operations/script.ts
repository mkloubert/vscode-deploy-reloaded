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

import * as deploy_contracts from '../../contracts';
import * as deploy_events from '../../events';
import * as deploy_helpers from '../../helpers';
import * as deploy_session from '../../session';
import * as deploy_targets from '../../targets';
import * as i18 from '../../i18';


/**
 * An operation that executes a script.
 */
export interface ScriptTargetOperation extends deploy_targets.TargetOperation {
    /**
     * Additional data / options for the script.
     */
    readonly options?: any;
    /**
     * The path to the script to execute.
     */
    readonly script: string;
}

/**
 * Arguments for script execution.
 */
export interface ScriptTargetOperationExecutionArguments extends deploy_contracts.ScriptArguments {
    /**
     * The underlying operation context.
     */
    readonly context: deploy_targets.TargetOperationExecutionContext<ScriptTargetOperation>;
}

/**
 * A function / method that executes a script.
 * 
 * @param {ScriptTargetOperationExecutionArguments} args The arguments.
 * 
 * @return {any} The result,
 */
export type ScriptTargetOperationExecutor = (args: ScriptTargetOperationExecutionArguments) => any;

/**
 * A script module.
 */
export interface ScriptTargetOperationModule {
    /**
     * Executes the script.
     */
    readonly execute: ScriptTargetOperationExecutor;
}


/** @inheritdoc */
export async function execute(context: deploy_targets.TargetOperationExecutionContext<ScriptTargetOperation>) {
    const OPERATION = context.operation;
    const TARGET = context.target;
    const WORKSPACE = TARGET.__workspace;

    let scriptFile = deploy_helpers.toStringSafe(
        WORKSPACE.replaceWithValues(OPERATION.script)
    );
    if (deploy_helpers.isEmptyString(scriptFile)) {
        switch (context.event) {
            case deploy_targets.TargetOperationEvent.AfterDeployed:
                scriptFile = './deployed.js';
                break;

            case deploy_targets.TargetOperationEvent.BeforeDeploy:
                scriptFile = './beforeDeploy.js';
                break;
        }
    }

    let scriptFullPath = await WORKSPACE.getExistingSettingPath(scriptFile);

    if (false === scriptFullPath) {
        throw new Error(i18.t('targets.operations.script.scriptNotFound',
                              scriptFile));
    }

    const SCRIPT_MODULE = deploy_helpers.loadModule<ScriptTargetOperationModule>(scriptFullPath);
    if (SCRIPT_MODULE) {
        const EXECUTE = SCRIPT_MODULE.execute;
        if (EXECUTE) {
            const ARGS: ScriptTargetOperationExecutionArguments = {
                _: require('lodash'),
                context: context,
                events: WORKSPACE.workspaceSessionState['target_operations']['script']['events'],
                extension: WORKSPACE.context.extension,
                folder: WORKSPACE.folder,
                globalEvents: deploy_events.EVENTS,
                globals: WORKSPACE.globals,
                globalState: WORKSPACE.workspaceSessionState['target_operations']['script']['global'],
                homeDir: deploy_helpers.getExtensionDirInHome(),
                logger: WORKSPACE.createLogger(),
                options: deploy_helpers.cloneObject(OPERATION.options),
                output: WORKSPACE.output,
                replaceWithValues: (val) => {
                    return WORKSPACE.replaceWithValues(val);
                },
                require: (id) => {
                    return deploy_helpers.requireFromExtension(id);
                },
                sessionState: deploy_session.SESSION_STATE,
                settingFolder: WORKSPACE.settingFolder,
                state: undefined,
                workspaceRoot: WORKSPACE.rootPath,
            };

            // ARGS.state
            Object.defineProperty(ARGS, 'state', {
                enumerable: true,

                get: () => {
                    return WORKSPACE.workspaceSessionState['target_operations']['script']['scripts'][<string>scriptFullPath];
                },

                set: (newValue) => {
                    WORKSPACE.workspaceSessionState['target_operations']['script']['scripts'][<string>scriptFullPath] = newValue;
                }
            });

            await Promise.resolve(
                EXECUTE.apply(SCRIPT_MODULE, [ ARGS ])
            );
        }
        else {
            throw new Error(i18.t('targets.operations.script.noScriptFunction',
                                  scriptFile));
        }
    }
    else {
        throw new Error(i18.t('targets.operations.script.noScriptModule',
                              scriptFile));
    }
}
