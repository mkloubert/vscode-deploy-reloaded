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
import * as deploy_workspaces from './workspaces';


/**
 * A package.
 */
export interface Package extends deploy_contracts.FileFilter {
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the zero-based of that package.
     */
    readonly __index: number;
    /**
     * [INTERNAL] DO NOT DEFINE OR OVERWRITE THIS PROPERTY BY YOUR OWN!
     * 
     * Gets the underlying workspace.
     */
    readonly __workspace: deploy_workspaces.Workspace;

    /**
     * A description.
     */
    readonly description?: string;
    /**
     * The (display) name.
     */
    readonly name?: string;
}


/**
 * Returns the name for a package.
 * 
 * @param {Package} pkg The package. 
 * @param {number} [nr] The number of the package.
 * 
 * @return {string} The name. 
 */
export function getPackageName(pkg: Package,
                               nr?: number): string {
    nr = parseInt( deploy_helpers.toStringSafe(nr).trim() );
    
    if (!pkg) {
        return;
    }

    let name = deploy_helpers.toStringSafe(pkg.name).trim();
    if ('' === name) {
        //TODO: translate
        name = 'Package';

        if (!isNaN(nr)) {
            name += ` #${nr}`;
        }
    }

    return name;
}
