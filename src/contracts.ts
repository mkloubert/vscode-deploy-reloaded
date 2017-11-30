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

import * as deploy_packages from './packages';
import * as deploy_targets from './targets';
import * as vscode from 'vscode';


/**
 * A quick pick item based on an action.
 */
export interface ActionQuickPick<TState = any> extends vscode.QuickPickItem {
    /**
     * The action to invoke.
     */
    readonly action?: (state?: TState) => any;
    /**
     * The state value for the action.
     */
    readonly state?: TState;
}

/**
 * Deploy settings.
 */
export interface Configuration {
    /**
     * One or more package.
     */
    readonly packages?: deploy_packages.Package | deploy_packages.Package[];
    /**
     * One or more target.
     */
    readonly targets?: deploy_targets.Target | deploy_targets.Target[];
}

/**
 * List of file change types.
 */
export enum FileChangeType {
    /**
     * New / created
     */
    Created,
    /**
     * Changed / updated
     */
    Changed,
    /**
     * Deleted
     */
    Deleted,
}

/**
 * A file filter.
 */
export interface FileFilter {
    /**
     * One or more (glob) patterns that describes the files to EXCLUDE.
     */
    readonly exclude?: string | string[];
    /**
     * One or more (glob) patterns that describes the files to INCLUDE.
     */
    readonly files?: string | string[];
}

/**
 * Describes the structure of the package file of that extenstion.
 */
export interface PackageFile {
    /**
     * The display name.
     */
    readonly displayName: string;
    /**
     * The (internal) name.
     */
    readonly name: string;
    /**
     * The version string.
     */
    readonly version: string;
}

/**
 * The name of the event that is raised after workspace config has been reloaded.
 */
export const EVENT_CONFIG_RELOADED = 'workspace.config.reloaded';
