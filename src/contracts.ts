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

import * as deploy_commands from './commands';
import * as deploy_packages from './packages';
import * as deploy_targets from './targets';
import * as deploy_values from './values';
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
 * A button.
 */
export interface Button {
    /**
     * The custom (text) color.
     */
    readonly color?: string;
    /**
     * Enable button or not.
     */
    readonly enabled?: boolean;
    /**
     * Put button on the right side or not.
     */
    readonly isRight?: boolean;
    /**
     * The priority.
     */
    readonly priority?: number;
    /**
     * A custom text for the button.
     */
    readonly text?: string;
    /**
     * A custom tooltip for the button.
     */
    readonly tooltip?: string;
}

/**
 * A button with a custom command.
 */
export interface ButtonWithCustomCommand extends Button {
    /**
     * The custom command.
     */
    readonly command?: string;
}

/**
 * An object whats operation(s) can be cancelled.
 */
export interface Cancelable {
    /**
     * Gets the underlying token.
     */
    readonly cancellationToken: vscode.CancellationToken;
    /**
     * Gets if a cancellation is requested or not.
     */
    readonly isCancelling: boolean;
}

/**
 * An item that uses JavaScript code if it is available or not.
 */
export interface ConditionalItem {
    /**
     * One or more (JavaScript) conditions that check if that item is available or not.
     */
    readonly if?: string | string[];
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
export interface Configuration extends deploy_values.WithValueItems {
    /**
     * Clear output on after config has been reloaded or not.
     */
    readonly clearOutputOnStartup?: boolean;
    /**
     * Defines of or more command for the editor to register.
     */
    readonly commands?: { [command: string]: deploy_commands.ScriptCommand | string };
    /**
     * Activates or deactivates 'deploy on change' feature for all packages.
     */
    readonly deployOnChange?: boolean;
    /**
     * Activates or deactivates 'deploy on save' feature for all packages.
     */
    readonly deployOnSave?: boolean;
    /**
     * Settings for the process's environment.
     */
    readonly env?: {
        /**
         * Automatically import environment variables as placesholders / values.
         */
        readonly importVarsAsPlaceholders?: boolean;
        /**
         * One or more variable for the process to define.
         */
        readonly vars?: KeyValuePairs;
    };
    /**
     * Global data to define.
     */
    readonly globals?: any;
    /**
     * One or more (minimatch) patterns of files that should be ignored
     * even if a deployment is started for them. 
     */
    readonly ignore?: string | string[];
    /**
     * A list of imports.
     */
    readonly imports?: ImportType | ImportType[];
    /**
     * The custom ID of the language to use (e.g. 'en', 'de').
     */
    readonly language?: string;
    /**
     * Open the output window after config has been reloaded or not.
     */
    readonly openOutputOnStartup?: boolean;
    /**
     * One or more package.
     */
    readonly packages?: deploy_packages.Package | deploy_packages.Package[];
    /**
     * Activates or deactivates "remove on change" feature for all packages.
     */
    readonly removeOnChange?: boolean;
    /**
     * Run build task on startup or define the wait time, in milliseconds, after
     * the build task should be run after startup.
     */
    readonly runBuildTaskOnStartup?: boolean | number;
    /**
     * Run Git pull on startup or define the wait time, in milliseconds, after
     * Git pull should be run after startup.
     */
    readonly runGitPullOnStartup?: boolean | number;
    /**
     * Activates or deactivates "sync when open" feature.
     */
    readonly syncWhenOpen?: boolean;
    /**
     * One or more target.
     */
    readonly targets?: deploy_targets.Target | deploy_targets.Target[];
    /**
     * The time (in milliseconds) to wait before activating 'deploy on change' feature.
     */
    readonly timeToWaitBeforeActivateDeployOnChange?: number;
    /**
     * The time (in milliseconds) to wait before activating 'remove on change' feature.
     */
    readonly timeToWaitBeforeActivateRemoveOnChange?: number;
}

/**
 * List of deploy operations.
 */
export enum DeployOperation {
    /**
     * Delete / remove
     */
    Delete = 0,
    /**
     * Deploy / upload
     */
    Deploy = 1,
    /**
     * List directory
     */
    ListDirectory = 2,
    /**
     * Pull / download
     */
    Pull = 3,
}

/**
 * Something that can work with a password.
 */
export interface Encryptable {
    /**
     * The custom password algorithm to use.
     */
    readonly encryptBy?: string;
    /**
     * The password.
     */
    readonly encryptWith?: string;
}

/**
 * List of file change types.
 */
export enum FileChangeType {
    /**
     * New / created
     */
    Created = 0,
    /**
     * Changed / updated
     */
    Changed = 1,
    /**
     * Deleted
     */
    Deleted = 2,
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
export interface Import extends ConditionalItem {
    /**
     * Gets the source.
     */
    readonly from: string;
}

/**
 * Import types.
 */
export type ImportType = string | Import;

/**
 * A key value paris.
 */
export type KeyValuePairs<TValue = any> = { [key: string]: TValue };

/**
 * A message item with a value.
 */
export interface MessageItemWithValue<TValue = any> extends vscode.MessageItem {
    /**
     * The value.
     */
    readonly value?: TValue;
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
 * Arguments for a script.
 */
export interface ScriptArguments {
    /**
     * Global data.
     */
    readonly globals: any;
    /**
     * Options for the script.
     */
    readonly options?: any;
    /**
     * Imports a module from the extension context.
     */
    readonly require: (id: any) => any;
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
