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

import * as Crypto from 'crypto';
import * as deploy_contracts from './contracts';
import * as deploy_helpers from './helpers';
import * as deploy_gui from './gui';
import * as deploy_log from './log';
import * as deploy_mappings from './mappings';
import * as deploy_packages from './packages';
import * as deploy_targets_operations_command from './targets/operations/command';
import * as deploy_targets_operations_exec from './targets/operations/exec';
import * as deploy_targets_operations_http from './targets/operations/http';
import * as deploy_targets_operations_open from './targets/operations/open';
import * as deploy_targets_operations_script from './targets/operations/script';
import * as deploy_targets_operations_sql from './targets/operations/sql';
import * as deploy_targets_operations_wait from './targets/operations/wait';
import * as deploy_transformers from './transformers';
import * as deploy_values from './values';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as i18 from './i18';
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
     * The underlying files.
     */
    readonly files: string[];
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
export interface Target extends deploy_values.Applyable,
                                deploy_transformers.CanTransformData,
                                deploy_contracts.ConditionalItem,
                                deploy_contracts.Encryptable,
                                deploy_contracts.PlatformItem,
                                deploy_contracts.WithOptionalName,
                                deploy_workspaces.WorkspaceItemFromSettings
{
    /**
     * One or more target operations that should be invoked
     * BEFORE a deletion in that target starts.
     */
    readonly beforeDelete?: TargetOperationValue | TargetOperationValue[];
    /**
     * One or more target operations that should be invoked
     * BEFORE a deployment to that target starts.
     */
    readonly beforeDeploy?: TargetOperationValue | TargetOperationValue[];
    /**
     * One or more target operations that should be invoked
     * BEFORE a pullment from that target starts.
     */
    readonly beforePull?: TargetOperationValue | TargetOperationValue[];
    /**
     * One or more target operations that should be invoked
     * AFTER a deletion in that target has been done.
     */
    readonly deleted?: TargetOperationValue | TargetOperationValue[];
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
     * One or more target operations that should be invoked
     * AFTER a pullment from that target has been done.
     */
    readonly pulled?: TargetOperationValue | TargetOperationValue[];
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
    /**
     * Before pull
     */
    BeforePull = 2,
    /**
     * After pulled
     */
    AfterPulled = 3,
    /**
     * Before delete
     */
    BeforeDelete = 4,
    /**
     * After deleted
     */
    AfterDeleted = 5,
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
     * The underlying deploy operation.
     */
    readonly deployOperation: deploy_contracts.DeployOperation;
    /**
     * The event (type).
     */
    readonly event: TargetOperationEvent;
    /**
     * The underlying files.
     */
    readonly files: string[];
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


const KEY_TARGET_USAGE = 'vscdrLastExecutedTargetActions';

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
    let deployOperation: deploy_contracts.DeployOperation;
    switch (EVENT) {
        case TargetOperationEvent.AfterDeleted:
            operationsFromTarget = TARGET.deleted;
            deployOperation = deploy_contracts.DeployOperation.Delete;
            break;

        case TargetOperationEvent.AfterDeployed:
            operationsFromTarget = TARGET.deployed;
            deployOperation = deploy_contracts.DeployOperation.Deploy;
            break;

        case TargetOperationEvent.AfterPulled:
            operationsFromTarget = TARGET.pulled;
            deployOperation = deploy_contracts.DeployOperation.Pull;
            break;

        case TargetOperationEvent.BeforeDelete:
            operationsFromTarget = TARGET.beforeDelete;
            deployOperation = deploy_contracts.DeployOperation.Delete;
            break;

        case TargetOperationEvent.BeforeDeploy:
            operationsFromTarget = TARGET.beforeDeploy;
            deployOperation = deploy_contracts.DeployOperation.Deploy;
            break;

        case TargetOperationEvent.BeforePull:
            operationsFromTarget = TARGET.beforePull;
            deployOperation = deploy_contracts.DeployOperation.Pull;
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
            WORKSPACE.filterConditionalItems(operationToExecute, true)
        ).singleOrDefault(null);

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

            case 'command':
                executor = deploy_targets_operations_command.execute;
                break;

            case 'exec':
            case 'execute':
                executor = deploy_targets_operations_exec.execute;
                break;

            case 'http':
                executor = deploy_targets_operations_http.execute;
                break;

            case 'script':
                executor = deploy_targets_operations_script.execute;
                break;

            case 'sql':
                executor = deploy_targets_operations_sql.execute;
                break;

            case 'wait':
                executor = deploy_targets_operations_wait.execute;
                break;
        }

        if (!executor) {
            throw new Error(WORKSPACE.t('targets.operations.typeNotSupported',
                                        TYPE));
        }

        try {
            const CTX: TargetOperationExecutionContext = {
                args: executorArgs || [],
                deployOperation: deployOperation,
                event: EVENT,
                files: deploy_helpers.asArray(opts.files),
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
            deploy_helpers.showWarningMessage(
                i18.t('targets.doesNotExist', tn)
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
        deploy_helpers.asArray(target.showIf)
    ).map(sif => deploy_helpers.normalizeString(sif))
     .filter(sif => '' !== sif);

    if (SHOW_IF.length < 1) {
        return true;
    }

    return SHOW_IF.indexOf(PACKAGE_NAME) > -1;
}

/**
 * Maps file objects for a specific target.
 * 
 * @param {Target} target The underlying target.
 * @param {TFile|TFile[]} files The file targets to (re)map.
 * 
 * @return {Promise<TFile[]>} The promise with the new, mapped objects.
 */
export async function mapFilesForTarget<TFile extends deploy_contracts.WithNameAndPath = deploy_contracts.WithNameAndPath>(
    target: Target,
    files: TFile | TFile[]
) {
    const WORKSPACE = target.__workspace;

    const ALL_DIRS = await WORKSPACE.getAllDirectories();

    files = deploy_helpers.asArray(files);

    const MAPPED_FILES: TFile[] = [];
    for (const F of files) {
        const CLONED_FILE = deploy_helpers.cloneObjectFlat(F, false);

        const FULL_PATH = Path.resolve(
            Path.join(
                WORKSPACE.rootPath,
                deploy_helpers.normalizePath(
                    F.path + '/' + F.name
                )
            )
        );
        if (!WORKSPACE.isPathOf(FULL_PATH)) {
            continue;
        }

        const NEW_MAPPING = await WORKSPACE.getNameAndPathForFileDeployment(
            target, FULL_PATH,
            ALL_DIRS
        );
        if (false === NEW_MAPPING) {
            continue;
        }

        (<any>CLONED_FILE).name = NEW_MAPPING.name;
        (<any>CLONED_FILE).path = NEW_MAPPING.path;

        MAPPED_FILES.push(
            CLONED_FILE
        );
    }

    return MAPPED_FILES;
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
 * Resets the target usage statistics.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function resetTargetUsage(context: vscode.ExtensionContext) {
    context.workspaceState.update(KEY_TARGET_USAGE, undefined).then(() => {
    }, (err) => {
        deploy_log.CONSOLE
                  .trace(err, 'targets.resetTargetUsage()');
    });
}

/**
 * Shows a quick pick for a list of targets.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {Target|Target[]} targets One or more targets.
 * @param {vscode.QuickPickOptions} [opts] Custom options for the quick picks.
 * 
 * @return {Promise<Target|false>} The promise that contains the selected target (if selected)
 *                                 or (false) if no target is available.
 */
export async function showTargetQuickPick(context: vscode.ExtensionContext,
                                          targets: Target | Target[],
                                          opts?: vscode.QuickPickOptions): Promise<Target | false> {
    const QUICK_PICKS: deploy_contracts.ActionQuickPick<string>[] = deploy_helpers.asArray(targets).map(t => {
        const WORKSPACE = t.__workspace;

        return {
            action: () => {
                return t;
            },
            label: '$(telescope)  ' + getTargetName(t),
            description: deploy_helpers.toStringSafe(t.description),
            detail: WORKSPACE.rootPath,
            state: Crypto.createHash('sha256')
                         .update( new Buffer(deploy_helpers.toStringSafe(t.__id), 'utf8') )
                         .digest('hex'),
        };
    });

    if (QUICK_PICKS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('targets.noneFound')
        );
        
        return false;
    }

    let selectedItem: deploy_contracts.ActionQuickPick<string>;
    if (1 === QUICK_PICKS.length) {
        selectedItem = QUICK_PICKS[0];
    }
    else {
        selectedItem = await vscode.window.showQuickPick(
            deploy_gui.sortQuickPicksByUsage(QUICK_PICKS,
                                             context.workspaceState,
                                             KEY_TARGET_USAGE,
                                             (i) => {
                                                 // remove icon
                                                 return i.label
                                                         .substr(i.label.indexOf(' '))
                                                         .trim();
                                             }),
            opts,
        );
    }

    if (selectedItem) {
        return selectedItem.action();
    }
}

/**
 * Throws an error if a parent target is defined in a child list of targets.
 * 
 * @param {Target} parentTarget The target to check.
 * @param {Target|Target[]} childTargets One or more children.
 * 
 * @throws Found parent target in child list.
 */
export function throwOnRecurrence(parentTarget: Target, childTargets: Target | Target[]) {
    childTargets = deploy_helpers.asArray(childTargets);
    
    if (!parentTarget) {
        return;
    }

    const WORKSPACE = parentTarget.__workspace;

    for (const CT of childTargets) {
        if (WORKSPACE.id !== CT.__workspace.id) {
            continue;
        }

        if (parentTarget.__id === CT.__id) {
            throw new Error(WORKSPACE.t('targets.cannotDefineOtherAsSource',
                                        getTargetName(CT)));
        }
    }
}
