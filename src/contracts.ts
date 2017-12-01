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
 * Stores data of configuration source.
 */
export interface ConfigSource {
    /**
     * Gets the resource URI.
     */
    readonly resource?: vscode.Uri;
    /**
     * Gets the name of the section.
     */
    readonly section: string;
}

/**
 * Deploy settings.
 */
export interface Configuration {
    /**
     * A list of imports.
     */
    readonly imports?: ImportType | ImportType[];
    /**
     * The ID of the language to use (e.g. 'en', 'de')
     */
    readonly language?: string;
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
 * An import entry.
 */
export interface Import {
    /**
     * An optional description for the entry.
     */
    description?: string;
    /**
     * Gets the source.
     */
    from: string;
}

/**
 * Import types.
 */
export type ImportType = string | Import;

/**
 * A message item with a value.
 */
export interface MessageItemWithValue<TValue = any> extends vscode.MessageItem {
    /**
     * The value.
     */
    value?: TValue;
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
 * An object that can provide translated strings by key.
 */
export interface Translator {
    /**
     * Returns a translated string by key.
     * 
     * @param {string} key The key.
     * @param {any} [args] The optional arguments.
     * 
     * @return {string} The "translated" string.
     */
    readonly t: (key: string, ...args: any[]) => string;
}

/**
 * An object that stores a name and a path.
 */
export interface WithNameAndPath {
    /**
     * The name.
     */
    readonly name: string;
    /**
     * The path.
     */
    readonly path: string;
}

/**
 * An object that stores a (optional) name.
 */
export interface WithOptionalName {
    /**
     * The name.
     */
    readonly name?: string;
}

/**
 * The name of the event that is raised after workspace config has been reloaded.
 */
export const EVENT_CONFIG_RELOADED = 'workspace.config.reloaded';
