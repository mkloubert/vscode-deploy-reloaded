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
import * as deploy_log from './log';
import * as deploy_mappings from './mappings';
import * as deploy_packages from './packages';
import * as deploy_targets_operations_http from './targets/operations/http';
import * as deploy_targets_operations_open from './targets/operations/open';
import * as deploy_transformers from './transformers';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as Minimatch from 'minimatch';
import * as Moment from 'moment';
import * as Path from 'path';
import * as SanitizeFilename from 'sanitize-filename';
import * as vscode from 'vscode';


/**
 * Options for executing target operations.
 */
export interface ExecuteTargetOperationOptions {
    /**
     * The callback that is invoked BEFORE an operation is going to be executed.
     * 
     * @param {TargetOperation} operation The operation.
     */
    readonly onBeforeExecute: (operation: TargetOperation) => void | PromiseLike<void>;
    /**
     * The callback that is invoked AFTER an operation has been executed.
     * 
     * @param {TargetOperation} operation The operation.
     * @param {any} err The error (if occurred).
     * @param {boolean} doesContinue Indicates if the execution of other operations will be done or not.
     */
    readonly onExecutionCompleted: (operation: TargetOperation, err: any, doesContinue: boolean) => void | PromiseLike<void>;
    /**
     * The operation event.
     */
    readonly operation: TargetOperationEvent;
    /**
     * The underlying target.
     */
    readonly target: Target;
}

/**
 * A target.
 */
export interface Target extends deploy_transformers.CanTransformData,
                                deploy_contracts.ConditionalItem,
                                deploy_contracts.Encryptable,
                                deploy_contracts.PlatformItem,
                                deploy_contracts.WithOptionalName,
                                deploy_workspaces.WorkspaceItemFromSettings
{
    /**
     * One or more target operations that should be invoked
     * BEFORE a deployment to that target starts.
     */
    readonly beforeDeploy?: TargetOperationValue | TargetOperationValue[];
    /**
     * One or more target operations that should be invoked
     * AFTER a deployment to that target has been done.
     */
    readonly deployed?: TargetOperationValue | TargetOperationValue[];
    /**
     * A description.
     */
    readonly description?: string;
    /**
     * A list of one or more package names that indicates
     * if that target is hidden from GUI if one of the package(s) has been selected.
     */
    readonly hideIf?: string | string[];
    /**
     * Defines folder mappings.
     */
    readonly mappings?: deploy_mappings.FolderMappings;
    /**
     * A list of one or more package names that indicates
     * if that target is only shown in GUI if one of the package(s) has been selected.
     */
    readonly showIf?: string | string[];
    /**
     * The type.
     */
    readonly type?: string;
}

/**
 * A target operation.
 */
export interface TargetOperation extends deploy_contracts.ConditionalItem,
                                         deploy_contracts.WithOptionalName {
    /**
     * Continue when target operation fails or not.
     */
    readonly ignoreIfFail?: boolean;
    /**
     * The type.
     */
    readonly type?: string;
}

/**
 * Target operation event types.
 */
export enum TargetOperationEvent {
    /**
     * Before deploy
     */
    BeforeDeploy = 0,
    /**
     * After deployed
     */
    AfterDeployed = 1,
}

/**
 * A target operation execution context.
 */
export interface TargetOperationExecutionContext<TOperation extends TargetOperation = TargetOperation> {
    /**
     * Additional arguments for the execution.
     */
    readonly args: any[];
    /**
     * The event (type).
     */
    readonly event: TargetOperationEvent;
    /**
     * The underlying operation.
     */
    readonly operation: TOperation;
    /**
     * The previous operation (context).
     */
    readonly previousOperation: TargetOperationExecutionContext;
    /**
     * The underlying target.
     */
    readonly target: Target;
    /**
     * The normalized type.
     */
    readonly type: string;
}

/**
 * A target operation executor.
 * 
 * @param {TargetOperationExecutionContext<TOperation>} context The context.
 * 
 * @return {TargetOperationExecutorResult|PromiseLike<TargetOperationExecutorResult>} The result.
 */
export type TargetOperationExecutor<TOperation extends TargetOperation = TargetOperation> =
    (context: TargetOperationExecutionContext<TOperation>) => TargetOperationExecutionResult | PromiseLike<TargetOperationExecutionResult>;

/**
 * Possible results for a target operation executor.
 */
export type TargetOperationExecutionResult = void | null| boolean;

/**
 * A target operation module.
 */
export interface TargetOperationModule<TOperation extends TargetOperation = TargetOperation> {
    /**
     * The execution method.
     */
    readonly execute: TargetOperationExecutor<TOperation>;
}

/**
 * A possible target operation (setting) value.
 */
export type TargetOperationValue = TargetOperation | string;

/**
 * An object that provides target names.
 */
export interface TargetProvider {
    /**
     * One or more target.
     */
    readonly targets?: string | string[];
}

/**
 * The default type or a target operation.
 */
export const DEFAULT_OPERATION_TYPE = 'open';

/**
 * The regular expression for testing a ZIP filename for a target.
 */
export const REGEX_ZIP_FILENAME = /^(vscode\-ws)(.*)(_)([0-9]{8})(\-)([0-9]{6})(\.zip)$/i;


/**
 * Returns the mapped file path by a target.
 * 
 * @param {Target} target The target.
 * @param {string} dir The path / directory of the file.
 * @param {string} fileName The name of the underlying file.
 * @param {Minimatch.IOptions} [opts] Custom options.
 * 
 * @return {string} The mapped (directory) path.
 */
export function getMappedTargetFilePath(target: Target,
                                        dir: string, fileName: string,
                                        opts?: Minimatch.IOptions) {
    const REMOVE_SURROUNDING_SEPS = (str: string) => {
        str = deploy_helpers.replaceAllStrings(str, Path.sep, '/').trim();
        while (str.startsWith('/')) {
            str = str.substr(1).trim();
        }
        while (str.endsWith('/')) {
            str = str.substr(0, str.length - 1).trim();
        }

        return str;
    };

    dir = '/' + REMOVE_SURROUNDING_SEPS(dir);
    fileName = REMOVE_SURROUNDING_SEPS(fileName);

    let mappings: deploy_mappings.FolderMappings;
    if (target) {
        mappings = target.mappings;
    }

    let mappedPath = deploy_helpers.getMappedPath(mappings,
                                                  '/' + REMOVE_SURROUNDING_SEPS(dir + '/' + fileName));
    if (false === mappedPath) {
        mappedPath = dir;
    }

    return REMOVE_SURROUNDING_SEPS(
        REMOVE_SURROUNDING_SEPS(mappedPath + '/' + fileName)
    );
}

/**
 * Executes operations for a target.
 * 
 * @param {ExecuteTargetOperationOptions} opts The options.
 * 
 * @return {boolean} Operation has been cancelled (false) or not (true).
 */
export async function executeTargetOperations(opts: ExecuteTargetOperationOptions) {
    const TARGET = opts.target;
    const WORKSPACE = TARGET.__workspace;
    const EVENT = opts.operation;

    let operationsFromTarget: TargetOperationValue | TargetOperationValue[];
    switch (EVENT) {
        case TargetOperationEvent.AfterDeployed:
            operationsFromTarget = TARGET.deployed;
            break;

        case TargetOperationEvent.BeforeDeploy:
            operationsFromTarget = TARGET.beforeDeploy;
            break;
    }

    let prevOperation: TargetOperationExecutionContext;
    for (const OPERATION_VAL of deploy_helpers.asArray(operationsFromTarget)) {
        if (WORKSPACE.isInFinalizeState) {
            return false;
        }

        let operationToExecute: TargetOperation;

        if (deploy_helpers.isObject<TargetOperation>(OPERATION_VAL)) {
            operationToExecute = OPERATION_VAL;
        }
        else {
            const APP = deploy_helpers.toStringSafe(OPERATION_VAL);
            if (!deploy_helpers.isEmptyString(APP)) {
                const APP_OPERATION: deploy_targets_operations_open.OpenTargetOperation = {
                    target: APP,
                    type: ''
                };

                operationToExecute = APP_OPERATION;
            }
        }

        operationToExecute = Enumerable.from(
            deploy_helpers.filterConditionalItems(
                [ operationToExecute ], true
            )).firstOrDefault(null);

        if (!deploy_helpers.isObject<TargetOperation>(operationToExecute)) {
            continue;
        }

        const IGNORE_IF_FAIL = deploy_helpers.toBooleanSafe(operationToExecute.ignoreIfFail);

        let executor: TargetOperationExecutor;
        let executorArgs: any[];
        
        const TYPE = deploy_helpers.normalizeString(operationToExecute.type);
        switch (TYPE) {
            case '':
            case 'open':
                executor = deploy_targets_operations_open.execute;
                break;

            case 'http':
                executor = deploy_targets_operations_http.execute;
                break;
        }

        if (!executor) {
            //TODO: translate
            throw new Error(`Operation type '${TYPE}' is NOT supported!`);
        }

        try {
            const CTX: TargetOperationExecutionContext = {
                args: executorArgs || [],
                event: EVENT,
                operation: operationToExecute,
                previousOperation: prevOperation,
                target: TARGET,
                type: TYPE,
            };

            prevOperation = CTX;

            await Promise.resolve(
                opts.onBeforeExecute(operationToExecute)
            );

            const ABORT = !deploy_helpers.toBooleanSafe(
                await Promise.resolve(
                    executor.apply(null,
                                [ CTX ])
                ),
                true
            );

            await Promise.resolve(
                opts.onExecutionCompleted(operationToExecute, null, ABORT)
            );

            if (ABORT) {
                return false;
            }
        }
        catch (e) {
            await Promise.resolve(
                opts.onExecutionCompleted(operationToExecute, e, IGNORE_IF_FAIL)
            );

            if (IGNORE_IF_FAIL) {
                deploy_log.CONSOLE
                          .trace(e, 'targets.executeTargetOperations()');
            }
            else {
                throw e;
            }
        }
    }

    return true;
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
 * Returns targets by their names and shows an error message if targets could not be found.
 * 
 * @param {string|string[]} targetNames One or more target name.
 * @param {Target|Target[]} targets One or more existing targets.
 * 
 * @return {Target[]|false} The list of matching targets or (false) if at least one target could not be found.
 */
export function getTargetsByName(targetNames: string | string[],
                                 targets: Target | Target[]): Target[] | false {
    targetNames = Enumerable.from( deploy_helpers.asArray(targetNames) ).select(tn => {
        return deploy_helpers.normalizeString(tn);
    }).distinct()
      .toArray();
    targets = deploy_helpers.asArray(targets);

    const EXISTING_TARGETS: Target[] = [];
    const NON_EXISTING_TARGETS: string[] = [];
    targetNames.forEach(tn => {
        const MATCHING_TARGETS = (<Target[]>targets).filter(t => {
            const TARGET_NAME = deploy_helpers.normalizeString(
                getTargetName(t)
            );

            return TARGET_NAME === tn;
        });

        if (MATCHING_TARGETS.length > 0) {
            EXISTING_TARGETS.push
                            .apply(EXISTING_TARGETS, MATCHING_TARGETS);
        }
        else {
            NON_EXISTING_TARGETS.push(tn);
        }
    });

    if (NON_EXISTING_TARGETS.length > 0) {
        NON_EXISTING_TARGETS.forEach(tn => {
            //TODO: translate
            deploy_helpers.showWarningMessage(
                `The target '${tn}' does NOT EXIST!`
            );
        });

        return false;
    }

    return EXISTING_TARGETS;
}

/**
 * Returns the ZIP filename for a target.
 * 
 * @param {Target} target The target.
 * @param {Moment.Moment} [time] The custom timestamp to use.
 * 
 * @return {string} The filename.
 */
export function getZipFileName(target: Target, time?: Moment.Moment): string {
    if (!target) {
        return <any>target;
    }

    time = deploy_helpers.asUTC(time);
    if (!time) {
        time = Moment.utc();
    }

    let workspaceName: string;

    const WORKSPACE = target.__workspace;
    if (WORKSPACE) {
        workspaceName = deploy_helpers.normalizeString(target.__workspace.name);

        if (workspaceName.length > 32) {
            workspaceName = workspaceName.substr(0, 32).trim();
        }
    }

    if (deploy_helpers.isEmptyString(workspaceName)) {
        workspaceName = '';
    }
    else {
        workspaceName = `_${workspaceName}`;
    }

    return SanitizeFilename(
        `vscode-ws${workspaceName}_${time.format('YYYYMMDD-HHmmss')}.zip`
    );
}

/**
 * Checks if a target is visible for a package.
 * 
 * @param {Target} target The target.
 * @param {deploy_packages.Package} pkg The package.
 * 
 * @return {boolean} Is visible or not.
 */
export function isVisibleForPackage(target: Target, pkg: deploy_packages.Package) {
    if (!target) {
        return false;
    }

    if (!pkg) {
        return true;
    }

    const PACKAGE_NAME = deploy_helpers.normalizeString(
        deploy_packages.getPackageName(pkg)
    );

    const IS_HIDDEN = deploy_helpers.asArray(
        deploy_helpers.asArray(target.hideIf)
    ).map(hif => deploy_helpers.normalizeString(hif))
     .filter(hif => '' !== hif)
     .indexOf(PACKAGE_NAME) > -1;

    if (IS_HIDDEN) {
        return false;
    }

    const SHOW_IF = deploy_helpers.asArray(
        deploy_helpers.asArray(target.hideIf)
    ).map(sif => deploy_helpers.normalizeString(sif))
     .filter(sif => '' !== sif);

    if (SHOW_IF.length < 1) {
        return true;
    }

    return SHOW_IF.indexOf(PACKAGE_NAME) > -1;
}

/**
 * Normalizes the type of a target.
 * 
 * @param {Target} target The target.
 * 
 * @return {string} The normalized target type.
 */
export function normalizeTargetType(target: Target): string {
    if (!target) {
        return <any>target;
    }

    const TARGET_TYPE = deploy_helpers.normalizeString(target.type);
    
    return '' !== TARGET_TYPE ? TARGET_TYPE
                              : 'local';  // default
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
                            .filter(t => deploy_helpers.isObject(t));
    
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
            detail: `${t.__workspace.name} (${t.__workspace.rootPath})`,
            label: getTargetName(t),
        };
    });

    if (QUICK_PICK_ITEMS.length < 1) {
        //TODO: translate
        await deploy_helpers.showWarningMessage(
            `No targets found!`
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
