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

import * as deploy_clients_s3bucket from '../clients/s3bucket';
import * as deploy_files from '../files';
import * as deploy_log from '../log';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';


interface S3BucketContext extends deploy_plugins.AsyncFileClientPluginContext<S3BucketTarget,
                                                                              deploy_clients_s3bucket.S3BucketClient> {
}

/**
 * A 'S3 bucket' target.
 */
export interface S3BucketTarget extends deploy_targets.Target {
    /**
     * The custom ACL to set.
     */
    readonly acl?: string;
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
    public async createContext(target: S3BucketTarget): Promise<S3BucketContext> {
        return {
            client: await deploy_clients_s3bucket.createClient({
                acl: target.acl,
                bucket: target.bucket,
                credentials: target.credentials,
            }),
            getDir: (subDir) => {
                return deploy_clients_s3bucket.normalizePath(
                    deploy_clients_s3bucket.normalizePath(target.dir).trim() + 
                    '/' + 
                    deploy_clients_s3bucket.normalizePath(subDir).trim()
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
