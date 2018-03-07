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
import * as deploy_clients_s3bucket from '../clients/s3bucket';
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as OS from 'os';
import * as Path from 'path';


interface S3BucketContext extends deploy_plugins.AsyncFileClientPluginContext<S3BucketTarget,
                                                                              deploy_clients_s3bucket.S3BucketClient> {
}

/**
 * Filters for detecting the ACL for a file.
 */
export type S3BucketAclFilters = { [acl: string]: string | string[] | deploy_contracts.FileFilter };

/**
 * A 'S3 bucket' target.
 */
export interface S3BucketTarget extends deploy_targets.Target {
    /**
     * The custom ACL to set.
     */
    readonly acl?: string | S3BucketAclFilters;
    /**
     * The name of the bucket.
     */
    readonly bucket: string;
    /**
     * Credential settings.
     */
    readonly credentials?: {
        /**
         * Configuration data for the credential provider.
         */
        readonly config?: any;
        /**
         * The credential provider / type.
         */
        readonly type?: string;
    };
    /**
     * The custom root directory. 
     */
    readonly dir?: string;
}


class S3BucketPlugin extends deploy_plugins.AsyncFileClientPluginBase<S3BucketTarget,
                                                                      deploy_clients_s3bucket.S3BucketClient,
                                                                      S3BucketContext> {
    protected createContext(target: S3BucketTarget): S3BucketContext {
        const ME = this;

        const DIR = ME.replaceWithValues(target, target.dir);
        
        const FILTERS: deploy_contracts.KeyValuePairs<deploy_contracts.FileFilter> = {};
        if (deploy_helpers.isObject<S3BucketAclFilters>(target.acl)) {
            for (const ACL in target.acl) {
                const ITEM = target.acl[ACL];

                let ff: deploy_contracts.FileFilter;
                if (deploy_helpers.isObject<deploy_contracts.FileFilter>(ITEM)) {
                    ff = ITEM;
                }
                else {
                    ff = {
                        files: deploy_helpers.asArray(ITEM),
                    };
                }

                FILTERS[ deploy_clients_s3bucket.getAclSafe(ACL) ] = ff;
            }
        }
        else {
            FILTERS[ deploy_clients_s3bucket.getAclSafe(target.acl) ] = {
                files: '**'
            };
        }

        const SCOPES: string[] = [];
        SCOPES.push
              .apply(SCOPES,
                     target.__workspace.getSettingScopes());
        SCOPES.push(
            Path.resolve(
                Path.join(
                    OS.homedir(),
                    '.aws'
                )
            )
        );

        return {
            client: deploy_clients_s3bucket.createClient({
                acl: ME.replaceWithValues(target, target.acl),
                bucket: ME.replaceWithValues(target, target.bucket),
                credentials: target.credentials,
                directoryScopeProvider: () => {
                    return SCOPES;
                },
                fileAcl: (file, defAcl) => {
                    for (const ACL in FILTERS) {
                        if (deploy_helpers.checkIfDoesMatchByFileFilter('/' + file,
                                                                        deploy_helpers.toMinimatchFileFilter(FILTERS[ACL]))) {
                            return ME.replaceWithValues(target, ACL);
                        }
                    }

                    return defAcl;
                },
                valueProvider: () => {
                    return target.__workspace.getValues();
                }
            }),
            getDir: (subDir) => {
                return deploy_helpers.normalizePath(
                    deploy_helpers.normalizePath(DIR).trim() + 
                    '/' + 
                    deploy_helpers.normalizePath(subDir).trim()
                );
            },
            target: target
        };
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
    return new S3BucketPlugin(context);
}
