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
import * as deploy_targets_operations_cleanup from './targets/operations/cleanup';
import * as deploy_targets_operations_command from './targets/operations/command';
import * as deploy_targets_operations_exec from './targets/operations/exec';
import * as deploy_targets_operations_http from './targets/operations/http';
import * as deploy_targets_operations_open from './targets/operations/open';
import * as deploy_targets_operations_script from './targets/operations/script';
import * as deploy_targets_operations_slack from './targets/operations/slack';
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
import * as UUID from 'uuid';
import * as vscode from 'vscode';


/**
 * Options for executing 'prepare' target operations.
 */
export interface ExecutePrepareTargetOperationOptions {
    /**
     * The underlying files.
     */
    readonly files: string[];
    /**
     * The deploy operation.
     */
    readonly deployOperation: deploy_contracts.DeployOperation;
    /**
     * Callback that indicates the client to reload the file list.
     */
    readonly onReloadFileList: (operation: PrepareTargetOperation) => void | PromiseLike<void>;
    /**
     * The underlying target.
     */
    readonly target: Target;
}

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
     * Deploy operation value for 'prepare' operations.
     */
    readonly prepareDeployOperation?: deploy_contracts.DeployOperation;
    /**
     * List of operations to execute when prepare.
     */
    readonly prepareOperations?: PrepareTargetOperationValue | PrepareTargetOperationValue[];
    /**
     * The underlying target.
     */
    readonly target: Target;
}

/**
 * A (prepare) target operation.
 */
export interface PrepareTargetOperation extends TargetOperation {
    /**
     * A list of one or more deploy events the entry is executed when.
     */
    readonly onlyWhen?: string | string[];
    /**
     * Reload list of files or not.
     */
    readonly reloadFileList?: boolean;
}

/**
 * A possible (prepare) target operation (setting) value.
 */
export type PrepareTargetOperationValue = PrepareTargetOperation | string;

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
     * Check for newer files before a deploy operation starts or not.
     */
    readonly checkBeforeDeploy?: boolean;
    /**
     * Check for older files before a pull operation starts or not.
     */
    readonly checkBeforePull?: boolean;
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
     * Operations which are executed even before the operations of
     * 'beforeDeploy' and even if no file is going to be handled.
     */
    readonly prepare?: PrepareTargetOperationValue | PrepareTargetOperationValue[];
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
    /**
     * Prepare
     */
    Prepare = 6,
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

/**
 * A function that resolves one or more targets.
 * 
 * @return {string|string[]} The target name(s).
 */
export type TargetResolver = () => string | string[];


/**
 * The default type or a target operation.
 */
export const DEFAULT_OPERATION_TYPE = 'open';

const KEY_TARGET_USAGE = 'vscdrLastExecutedTargetActions';

/**
 * Storage key for targets' state object.
 */
export const KEY_TARGETS_STATE_STORAGE = 'targets';

/**
 * A storage key where to store data of targets in progress.
 */
export const KEY_TARGETS_IN_PROGRESS = 'targets_in_progress';

/**
 * The regular expression for testing a ZIP filename for a target.
 */
export const REGEX_ZIP_FILENAME = /^(vscode\-ws)(.*)(_)([0-9]{8})(\-)([0-9]{6})(\.zip)$/i;


/**
 * Creates a unique session value for a target.
 * 
 * @param {Target} target The target.
 * 
 * @return {symbol} The session value.
 */
export function createTargetSessionValue(target: Target): symbol {
    if (!target) {
        return <any>target;
    }

    return Symbol(
        `${Moment.utc().unix()}::` + 
        `${getTargetIdHash(target)}::` + 
        `${UUID.v4()}`,
    );
}

/**
 * Executes 'prepare' operations for a target.
 * 
 * @param {ExecutePrepareTargetOperationOptions} opts The options.
 * 
 * @return {Promise<boolean>} The promise with the value, that indicates if whole operation has been cancelled (false) or not (true).
 */
export async function executePrepareTargetOperations(opts: ExecutePrepareTargetOperationOptions) {
    const TARGET = opts.target;
    const WORKSPACE = TARGET.__workspace;

    const PREPARE_OPERATIONS = deploy_helpers.asArray(TARGET.prepare).map(p => {
        return getTargetOperationSafe<PrepareTargetOperation>(p);
    }).filter(p => {
        const ONLY_WHEN = deploy_helpers.asArray(p.onlyWhen).map(ow => {
            return deploy_helpers.normalizeString(ow);
        }).filter(ow => '' !== ow);

        if (ONLY_WHEN.length < 1) {
            return opts.deployOperation === deploy_contracts.DeployOperation.Deploy;
        }

        switch (opts.deployOperation) {
            case deploy_contracts.DeployOperation.Delete:
                return ONLY_WHEN.indexOf( 'delete' ) > -1;

            case deploy_contracts.DeployOperation.Deploy:
                return ONLY_WHEN.indexOf( 'deploy' ) > -1;

            case deploy_contracts.DeployOperation.Pull:
                return ONLY_WHEN.indexOf( 'pull' ) > -1;
        }

        return false;
    });

    let operationIndex = -1;

    const GET_OPERATION_NAME = (operation: PrepareTargetOperation) => {
        let operationName = deploy_helpers.toStringSafe(operation.name).trim();
        if ('' === operationName) {
            operationName = deploy_helpers.normalizeString(operation.type);
            if ('' === operationName) {
                operationName = DEFAULT_OPERATION_TYPE;
            }

            operationName += ' #' + (operationIndex + 1);
        }

        return operationName;
    };

    return await executeTargetOperations({
        files: opts.files,
        onBeforeExecute: async (operation: PrepareTargetOperation) => {
            ++operationIndex;

            WORKSPACE.output.append(
                WORKSPACE.t('targets.operations.runningPrepare',
                            GET_OPERATION_NAME(operation))
            );
        },
        onExecutionCompleted: async (operation: PrepareTargetOperation, err, doesContinue) => {
            if (err) {
                WORKSPACE.output.appendLine(`[${WORKSPACE.t('error', err)}]`);
            }
            else {
                WORKSPACE.output.appendLine(`[${WORKSPACE.t('ok')}]`);

                if (deploy_helpers.toBooleanSafe(operation.reloadFileList, true)) {
                    await Promise.resolve(
                        opts.onReloadFileList(operation)
                    );
                }
            }
        },
        operation: TargetOperationEvent.Prepare,
        prepareDeployOperation: opts.deployOperation,
        prepareOperations: PREPARE_OPERATIONS,
        target: TARGET,
    });
}

/**
 * Executes operations for a target.
 * 
 * @param {ExecuteTargetOperationOptions} opts The options.
 * 
 * @return {Promise<boolean>} The promise with the value, that indicates if whole operation has been cancelled (false) or not (true).
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

        case TargetOperationEvent.Prepare:
            operationsFromTarget = opts.prepareOperations;
            deployOperation = opts.prepareDeployOperation;
            break;
    }

    let prevOperation: TargetOperationExecutionContext;
    for (const OPERATION_VAL of deploy_helpers.asArray(operationsFromTarget)) {
        if (WORKSPACE.isInFinalizeState) {
            return false;
        }

        let operationToExecute = getTargetOperationSafe(OPERATION_VAL);

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

            case 'cleanup':
                executor = deploy_targets_operations_cleanup.execute;
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

            case 'slack':
                executor = deploy_targets_operations_slack.execute;
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
 * Returns the name and path for a file deployment.
 * 
 * @param {string} file The file.
 * @param {Target} target The target.
 * @param {string[]} dirs One or more scope directories.
 * 
 * @return {deploy_contracts.WithNameAndPath|false} The object or (false) if not possible.
 */
export function getNameAndPathForFileDeployment(target: Target,
                                                file: string,
                                                dirs?: string[]): deploy_contracts.WithNameAndPath | false {
    if (!target) {
        return false;
    }

    const WORKSPACE = target.__workspace;

    if (WORKSPACE.isFileIgnored(file)) {
        return false;
    }

    let relPath = WORKSPACE.toRelativePath(file);
    if (false === relPath) {
        return false;
    }

    const TO_MINIMATCH = (str: string) => {
        str = deploy_helpers.toStringSafe(str);
        if (!str.startsWith('/')) {
            str = '/' + str;
        }

        return str;
    };

    let name = Path.basename(relPath);
    let path = Path.dirname(relPath);
    let pathSuffix = '';
    
    const MAPPINGS = target.mappings;
    if (MAPPINGS) {
        for (const P in MAPPINGS) {
            let settings = MAPPINGS[P];
            if (deploy_helpers.isNullOrUndefined(settings)) {
                continue;
            }

            if (!deploy_helpers.isObject<deploy_mappings.FolderMappingSettings>(settings)) {
                settings = {
                    to: deploy_helpers.toStringSafe(settings),
                };
            }

            const PATTERN = TO_MINIMATCH(P);
            const PATH_TO_CHECK = TO_MINIMATCH(relPath);
            
            const MATCH_OPTS: Minimatch.IOptions = {
                dot: true,
                nocase: true,                
            };

            if (deploy_helpers.doesMatch(PATH_TO_CHECK, PATTERN, MATCH_OPTS)) {
                const DIR_NAME = Path.dirname(<string>relPath);

                const MATCHING_DIRS = <string[]>dirs.map(d => {
                    return WORKSPACE.toRelativePath(d);
                }).filter(d => false !== d).filter((d: string) => {
                    return d === DIR_NAME || 
                           DIR_NAME.startsWith(d + '/');
                }).sort((x, y) => {
                    return deploy_helpers.compareValuesBy(x, y,
                                                          (d: string) => d.length);
                });

                if (MATCHING_DIRS.length > 0) {
                    pathSuffix = DIR_NAME.substr(
                        MATCHING_DIRS[0].length
                    );
                }

                path = deploy_helpers.normalizePath(settings.to);
                break;
            }
        }
    }

    if ('.' === path) {
        path = '';
    }

    return {
        name: name,
        path: deploy_helpers.normalizePath(
            '/' +
            deploy_helpers.normalizePath(path) + 
            '/' + 
            deploy_helpers.normalizePath(pathSuffix)
        ),
    };
}

/**
 * Returns the scope directories for target folder mappings.
 * 
 * @param {Target} target The target.
 * 
 * @return {Promise<string[]>} The promise with the directories.
 */
export async function getScopeDirectoriesForTargetFolderMappings(target: Target): Promise<string[]> {
    if (!target) {
        return;
    }

    const WORKSPACE = target.__workspace;

    const PATTERNS: string[] = [];
    
    const MAPPINGS = target.mappings;
    if (deploy_helpers.isObject(MAPPINGS)) {
        for (const P in MAPPINGS) {
            if (!deploy_helpers.isEmptyString(P)) {
                PATTERNS.push(P);
            }
        }
    }

    const DIRS: string[] = [];

    if (PATTERNS.length > 0) {
        const FILES_AND_FOLDERS = await WORKSPACE.findFilesByFilter({
            files: Enumerable.from(PATTERNS)
                             .distinct()
                             .toArray()
        }, {
            absolute: true,
            dot: true,
            nocase: true,
            nodir: false,
            nosort: true,
        });

        for (const FF of FILES_AND_FOLDERS) {
            let dirToAdd: string;

            const STATS = await deploy_helpers.lstat(FF);
            if (STATS.isDirectory()) {
                dirToAdd = FF;
            }
            else {
                dirToAdd = Path.dirname(FF);
            }

            if (deploy_helpers.isEmptyString(dirToAdd)) {
                continue;
            }

            dirToAdd = Path.resolve(dirToAdd);
            if (DIRS.indexOf(dirToAdd) < 0) {
                DIRS.push(dirToAdd);
            }
        }
    }

    return DIRS;
}

/**
 * Returns the hash of a target's ID.
 * 
 * @param {Target} target The target.
 * 
 * @return {string} The hash of its ID. 
 */
export function getTargetIdHash(target: Target): string {
    if (!target) {
        return <any>target;
    }

    return Crypto.createHash('sha256')
                 .update( new Buffer(deploy_helpers.toStringSafe(target.__id), 'utf8') )
                 .digest('hex');
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

function getTargetOperationSafe<TOperation extends TargetOperation = TargetOperation>(
    val: TargetOperation | string
): TOperation
{
    if (!deploy_helpers.isNullOrUndefined(val)) {
        if (!deploy_helpers.isObject<TOperation>(val)) {
            const APP_OPERATION: deploy_targets_operations_open.OpenTargetOperation = {
                target: deploy_helpers.toStringSafe(val),
                type: ''
            };

            val = <any>APP_OPERATION;
        }
    }

    return <any>val;
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
 * Invokes an action for the file of an active text editor
 * by selecting a target.
 * 
 * @param {string} placeHolder The placeholder for the quick pick to use.
 * @param {Function} action The action to invoke.
 */
export async function invokeForActiveEditorAndTarget(placeHolder: string,
                                                     action: (file: string, target: Target) => any) {
    const ACTIVE_EDITOR = vscode.window.activeTextEditor;
    if (!ACTIVE_EDITOR) {
        deploy_helpers.showWarningMessage(
            i18.t('editors.active.noOpen')
        );

        return;
    }

    const MATCHING_WORKSPACES = deploy_workspaces.getAllWorkspaces().filter(ws => {
        return ACTIVE_EDITOR.document &&
               ws.isPathOf(ACTIVE_EDITOR.document.fileName);
    });

    const TARGETS: Target[] = [];
    MATCHING_WORKSPACES.forEach(ws => {
        Enumerable.from( ws.getTargets() )
                  .pushTo(TARGETS);
    });

    const QUICK_PICK_ITEMS: deploy_contracts.ActionQuickPick[] = TARGETS.map((t, i) => {
        return {
            action: async () => {
                if (action) {
                    await Promise.resolve(
                        action(ACTIVE_EDITOR.document.fileName,
                               t)
                    );
                }
            },
            description: deploy_helpers.toStringSafe( t.description ).trim(),
            detail: t.__workspace.rootPath,
            label: getTargetName(t),
        };
    });

    if (QUICK_PICK_ITEMS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('targets.noneFound')
        );

        return;
    }

    let selectedItem: deploy_contracts.ActionQuickPick;
    if (1 === QUICK_PICK_ITEMS.length) {
        selectedItem = QUICK_PICK_ITEMS[0];
    }
    else {
        selectedItem = await vscode.window.showQuickPick(QUICK_PICK_ITEMS, {
            placeHolder: placeHolder,
        });
    }

    if (selectedItem) {
        await selectedItem.action();
    }
}

/**
 * Checks if a target is marked as 'in progress'.
 * 
 * @param {Target} target The target to check.
 * 
 * @return {boolean} Is in progress or not.
 */
export function isTargetInProgress(target: Target): boolean {
    if (!target) {
        return;
    }

    const WORKSPACE = target.__workspace;
    if (!WORKSPACE) {
        return;
    }

    const STORAGE = WORKSPACE.workspaceSessionState[ KEY_TARGETS_STATE_STORAGE ];
    if (!STORAGE) {
        return;
    }

    const TARGET_STORAGE = STORAGE[ KEY_TARGETS_IN_PROGRESS ];
    if (!TARGET_STORAGE) {
        return;
    }

    const TARGET_KEY = getTargetIdHash(target);

    return !deploy_helpers.isNullOrUndefined(
        TARGET_STORAGE[ TARGET_KEY ]
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

    const MAPPING_SCOPE_DIRS = await getScopeDirectoriesForTargetFolderMappings(target);

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

        const NEW_MAPPING = getNameAndPathForFileDeployment(
            target, FULL_PATH,
            MAPPING_SCOPE_DIRS
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
 * Mark a target as 'in progress'.
 * 
 * @param {Target} target The target to mark.
 * @param {any} [valueToSave] The custom value to save in storage.
 * 
 * @return {boolean} Has been marked or not.
 */
export function markTargetAsInProgress(target: Target, valueToSave?: any): boolean {
    if (arguments.length < 3) {
        valueToSave = target;
    }

    if (!target) {
        return;
    }

    const WORKSPACE = target.__workspace;
    if (!WORKSPACE) {
        return;
    }

    const STORAGE = WORKSPACE.workspaceSessionState[ KEY_TARGETS_STATE_STORAGE ];
    if (!STORAGE) {
        return;
    }

    const TARGET_STORAGE = STORAGE[ KEY_TARGETS_IN_PROGRESS ];
    if (!TARGET_STORAGE) {
        return;
    }

    TARGET_STORAGE[ getTargetIdHash(target) ] = valueToSave;
    return true;
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
            state: getTargetIdHash(t),
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

/**
 * Un-Mark a target as 'in progress'.
 * 
 * @param {Target} target The target to un-mark.
 * 
 * @return {boolean} Has been un-marked or not.
 */
export function unmarkTargetAsInProgress(target: Target, valueToCheck?: any): boolean {
    if (arguments.length < 3) {
        valueToCheck = target;
    }
    
    if (!target) {
        return;
    }

    const WORKSPACE = target.__workspace;
    if (!WORKSPACE) {
        return;
    }

    const STORAGE = WORKSPACE.workspaceSessionState[ KEY_TARGETS_STATE_STORAGE ];
    if (!STORAGE) {
        return;
    }

    const TARGET_STORAGE = STORAGE[ KEY_TARGETS_IN_PROGRESS ];
    if (!TARGET_STORAGE) {
        return;
    }

    const TARGET_KEY = getTargetIdHash(target);
    if (valueToCheck === TARGET_STORAGE[ TARGET_KEY ]) {
        delete TARGET_STORAGE[ TARGET_KEY ];

        return true;
    }

    return false;
}

/**
 * Waits until other tasks of a target have been finished.
 * 
 * @param {Target} target The target.
 * @param {vscode.StatusBarItem} [btn] The optional (cancel) button.
 * 
 * @return {Promise<symbol>} The promise with the target session value.
 */
export async function waitForOtherTargets(target: Target, btn?: vscode.StatusBarItem): Promise<symbol> {
    if (!target) {
        return <any>target;
    }

    const WORKSPACE = target.__workspace;
    const TARGET_NAME = getTargetName(target);

    if (btn) {
        btn.text = WORKSPACE.t('targets.waitingForOther',
                               TARGET_NAME);
    }

    await deploy_helpers.waitWhile(() => {
        return isTargetInProgress(target);
    }, {
        timeUntilNextCheck: 500,
        timeout: 60000,
    });

    const TARGET_SESSION = createTargetSessionValue(target);
    markTargetAsInProgress(target, TARGET_SESSION);

    return TARGET_SESSION;
}

/**
 * Wraps a 'before' callback of a file (context) object for a target.
 * 
 * @param {TFile} file The file (context).
 * @param {Target} target The underlying target.
 * @param {string|symbol} property The property (key) of the callback.
 * 
 * @return {TFile} The new object. 
 */
export function wrapOnBeforeFileCallbackForTarget<TFile extends deploy_contracts.WithNameAndPath = deploy_contracts.WithNameAndPath>(
    file: TFile,
    target: Target,
    property: string | symbol
) {
    if (!file) {
        return file;
    }

    const TARGET_NAME = getTargetName(target);

    const CALLBACK_TO_WRAP: (destinationOrSource?: string) => PromiseLike<void> =
        file[property];

    file = deploy_helpers.cloneObjectFlat(file, false);

    file[property] = async (destinationOrSource?: string) => {
        if (arguments.length < 1) {
            destinationOrSource = `${deploy_helpers.toStringSafe(file.path)}`;
        }
        destinationOrSource = `[${TARGET_NAME}] ${deploy_helpers.toStringSafe(destinationOrSource)}`;

        if (CALLBACK_TO_WRAP) {
            await deploy_helpers.applyFuncFor(
                CALLBACK_TO_WRAP,
                file
            )(destinationOrSource);
        }
    };

    return file;
}