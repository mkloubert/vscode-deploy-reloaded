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

import * as deploy_contracts from '../contracts';
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as deploy_workspaces from '../workspaces';
import * as Moment from 'moment';
import * as Path from 'path';


/**
 * A 'test' target.
 */
export interface BatchTarget extends deploy_targets.Target, deploy_targets.TargetProvider {
}

class BatchPlugin extends deploy_plugins.PluginBase<BatchTarget> {
    public get canDelete() {
        return true;
    }
    public get canDownload() {
        return true;
    }
    public get canList() {
        return true;
    }

    public async deleteFiles(context: deploy_plugins.DeleteContext<BatchTarget>) {
        await this.invokeForEachTarget(
            this.getTargets(context.target),
            (t) => t.__workspace.getDeletePlugins(t),
            async (target, plugin) => {
                if (context.isCancelling) {
                    return;
                }

                const CTX: deploy_plugins.DeleteContext = {
                    cancellationToken: undefined,
                    files: context.files,
                    isCancelling: undefined,
                    target: target,
                };

                // CTX.cancellationToken
                Object.defineProperty(CTX, 'cancellationToken', {
                    enumerable: true,

                    get: () => {
                        return context.cancellationToken;
                    }
                });

                // CTX.isCancelling
                Object.defineProperty(CTX, 'isCancelling', {
                    enumerable: true,

                    get: () => {
                        return context.isCancelling;
                    }
                });

                await plugin.deleteFiles(CTX);
            }
        );
    }

    public async downloadFiles(context: deploy_plugins.DownloadContext<BatchTarget>) {
        const FIRST_TARGET = this.getFirstTarget(context.target);

        await this.invokeForEachTarget(
            FIRST_TARGET,
            (t) => t.__workspace.getDownloadPlugins(t),
            async (target, plugin) => {
                if (context.isCancelling) {
                    return;
                }

                const CTX: deploy_plugins.DownloadContext = {
                    cancellationToken: undefined,
                    files: context.files,
                    isCancelling: undefined,
                    target: target,
                };

                // CTX.cancellationToken
                Object.defineProperty(CTX, 'cancellationToken', {
                    enumerable: true,

                    get: () => {
                        return context.cancellationToken;
                    }
                });

                // CTX.isCancelling
                Object.defineProperty(CTX, 'isCancelling', {
                    enumerable: true,

                    get: () => {
                        return context.isCancelling;
                    }
                });

                await plugin.downloadFiles(CTX);
            }
        );
    }

    private async invokeForEachTarget<TTarget extends deploy_targets.Target = deploy_targets.Target>(
        targets: TTarget | TTarget[],
        pluginResolver: (target: TTarget) => deploy_plugins.Plugin<TTarget> | deploy_plugins.Plugin<TTarget>[] | PromiseLike<deploy_plugins.Plugin<TTarget> | deploy_plugins.Plugin<TTarget>[]>,
        action: (target: deploy_targets.Target, plugin: deploy_plugins.Plugin) => any
    ) {
        for (const T of deploy_helpers.asArray(targets)) {
            const PLUGINS =
                await Promise.resolve(
                    pluginResolver(T)
                );

            for (const PI of deploy_helpers.asArray(PLUGINS)) {
                if (action) {
                    await Promise.resolve(
                        action(T, PI)
                    );
                }
            } 
        }
    }

    private getFirstTarget(target: BatchTarget) {
        return this.getTargets(target, true)[0];
    }

    private getTargets(target: BatchTarget, throwIfNonFound = false) {
        if (!target) {
            return;
        }

        const TARGETS = deploy_targets.getTargetsByName(target.targets, target.__workspace.getTargets());
        if (false === TARGETS) {
            // TODO: translate
            throw new Error(`At least one target could not be found!`);
        }

        if (throwIfNonFound) {
            if (TARGETS.length < 1) {
                // TODO: translate
                throw new Error(`No TARGET defined!`);
            }
        }

        const MY_NAME = deploy_helpers.normalizeString(
            target.name
        );
        TARGETS.forEach(t => {
            const OTHER_NAME = deploy_helpers.normalizeString(
                t.name
            );

            if (MY_NAME === OTHER_NAME) {
                throw new Error(`Cannot define '${OTHER_NAME}' as target source!`);
            }
        });

        return TARGETS;
    }

    public async listDirectory(context: deploy_plugins.ListDirectoryContext<BatchTarget>) {
        const FIRST_TARGET = this.getFirstTarget(context.target);

        let result: deploy_plugins.ListDirectoryResult;

        await this.invokeForEachTarget(
            FIRST_TARGET,
            (t) => t.__workspace.getDownloadPlugins(t),
            async (target, plugin) => {
                if (context.isCancelling) {
                    return;
                }

                const CTX: deploy_plugins.ListDirectoryContext = {
                    cancellationToken: undefined,
                    dir: context.dir,
                    isCancelling: undefined,
                    target: target,
                    workspace: target.__workspace,
                };

                // CTX.cancellationToken
                Object.defineProperty(CTX, 'cancellationToken', {
                    enumerable: true,

                    get: () => {
                        return context.cancellationToken;
                    }
                });

                // CTX.isCancelling
                Object.defineProperty(CTX, 'isCancelling', {
                    enumerable: true,

                    get: () => {
                        return context.isCancelling;
                    }
                });

                result = await plugin.listDirectory(CTX);
            }
        );

        return result;
    }

    public async uploadFiles(context: deploy_plugins.UploadContext<BatchTarget>) {
        await this.invokeForEachTarget(
            this.getTargets(context.target),
            (t) => t.__workspace.getUploadPlugins(t),
            async (target, plugin) => {
                if (context.isCancelling) {
                    return;
                }

                const CTX: deploy_plugins.UploadContext = {
                    cancellationToken: undefined,
                    files: context.files,
                    isCancelling: undefined,
                    target: target,
                };

                // CTX.cancellationToken
                Object.defineProperty(CTX, 'cancellationToken', {
                    enumerable: true,

                    get: () => {
                        return context.cancellationToken;
                    }
                });

                // CTX.isCancelling
                Object.defineProperty(CTX, 'isCancelling', {
                    enumerable: true,

                    get: () => {
                        return context.isCancelling;
                    }
                });

                await plugin.uploadFiles(CTX);
            }
        );
    }
}

/**
 * Creates a new instance of that plugin.
 * 
 * @param {deploy_plugins.PluginContext} context The context for the plugin.
 * 
 * @return {deploy_plugins.Plugin} The new plugin.
 */
export function createPlugins(context: deploy_plugins.PluginContext) {
    return new BatchPlugin(context);
}
