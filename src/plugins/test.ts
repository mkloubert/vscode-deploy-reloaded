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
import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';


/**
 * A 'test' target.
 */
export interface TestTarget extends deploy_targets.Target {
}

class TestPlugin extends deploy_plugins.PluginBase<TestTarget> {
    public async download(context: deploy_plugins.DownloadContext) {
        await deploy_helpers.forEachAsync(context.files, async (f) => {
            try {
                await f.onBeforeDownload()

                await deploy_helpers.readFile(
                    f.file,
                );

                await f.onDownloadCompleted(null);
            }
            catch (e) {
                await f.onDownloadCompleted(e);
            }
        });
    }

    public async upload(context: deploy_plugins.UploadContext) {
        await deploy_helpers.forEachAsync(context.files, async (f) => {
            try {
                await f.onBeforeUpload();

                await f.read();

                await f.onUploadCompleted();
            }
            catch (e) {
                await f.onUploadCompleted(e);
            }
        });
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
    return new TestPlugin(context);
}
