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

import * as Path from 'path';
import * as deploy_compilers_coffeescript from './compilers/coffeescript';
// import * as vspt_compilers_htmlminifier from './compilers/htmlminifier';
import * as deploy_compilers_less from './compilers/less';
import * as deploy_compilers_pug from './compilers/pug';
// import * as vspt_compilers_typescript from './compilers/typescript';
import * as deploy_compilers_uglifyjs from './compilers/uglifyjs';
import * as deploy_contracts from './contracts';
import * as deploy_helpers from './helpers';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as i18 from './i18';
import * as vscode from 'vscode';


/**
 * List of known compilers.
 */
export enum Compiler {
    /**
     * Less
     */
    Less = 0,
    /**
     * TypeScript
     */
    TypeScript = 1,
    /**
     * UglifyJS
     */
    UglifyJS = 2,
    /**
     * Pug
     */
    Pug = 3,
    /**
     * Html Minifier
     */
    HtmlMinifier = 4,
    /**
     * CoffeeScript
     */
    CoffeeScript = 5,
}

/**
 * Options for compiliation.
 */
export interface CompileOptions<TOptions = any> extends deploy_contracts.FileFilter {
    /**
     * Special options directly for the underlying compiler.
     */
    readonly options?: TOptions;
    /**
     * The custom directory where to write the output files to.
     */
    readonly outDirectory?: string;
    /**
     * The underlying workspace.
     */
    readonly workspace: deploy_workspaces.Workspace;
}

/**
 * A result of a compiliation.
 */
export interface CompileResult {
    /**
     * The list of result messages.
     */
    readonly messages: CompileResultMessage[];
}

/**
 * A result message (entry).
 */
export interface CompileResultMessage {
    /**
     * The category.
     */
    readonly category?: CompileResultMessageCategory;
    /**
     * The compiler.
     */
    readonly compiler: Compiler;
    /**
     * The underlying file.
     */
    readonly file: string;
    /**
     * The message.
     */
    readonly message?: string;
}

/**
 * List of message categories.
 */
export enum CompileResultMessageCategory {
    /**
     * Error
     */
    Error = 0,
    /**
     * Warning
     */
    Warning = 1,
    /**
     * Info
     */
    Info = 2,
}


function cleanupPatternList(patterns: string | string[],
                            defaultPatterns: string | string[]) {
    let cleanedUpList: string[];

    if (deploy_helpers.isNullOrUndefined(patterns)) {
        cleanedUpList = deploy_helpers.asArray(defaultPatterns);
    }
    else {
        cleanedUpList = deploy_helpers.asArray(patterns);
    }

    return Enumerable.from( cleanedUpList ).select(p => {
        return deploy_helpers.toStringSafe(p);
    }).where(p => {
        return !deploy_helpers.isEmptyString(p);
    }).distinct()
      .toArray();
};

/**
 * Collects files for compilation.
 * 
 * @param {CompileOptions} opts The underlying compile options.
 * @param {string|string[]} [defaultFiles] One or more default pattern for files to INCLUDE.
 * @param {string|string[]} defaultExcludes One or more default pattern for files to EXCLUDE.
 * 
 * @return {Promise<string[]>} The array with the files.
 */
export async function collectFiles(opts: CompileOptions,
                                   defaultFiles?: string | string[],
                                   defaultExcludes?: string | string[]) {
    opts = opts || <any>{};
    
    const WORKSPACE = opts.workspace;

    return await WORKSPACE.findFilesByFilter({
        files: cleanupPatternList(opts.files, defaultFiles),
        exclude: cleanupPatternList(opts.exclude, defaultExcludes),
    });
}

/**
 * Compiles files.
 * 
 * @param {Compiler} compiler The compiler to use.
 * @param {CompileOptions} opts Custom options for the compilation.
 * 
 * @return {Promise<CompileResult>} The promise with the result.
 * 
 * @throws {Error} Compiler not supported.
 */
export async function compile(compiler: Compiler, opts: CompileOptions): Promise<CompileResult> {
    switch (compiler) {
        case Compiler.CoffeeScript:
            return await deploy_compilers_coffeescript.compile(<any>opts);

        case Compiler.HtmlMinifier:
            // return await vspt_compilers_htmlminifier.compile(<any>opts);
            break;

        case Compiler.Less:
            return await deploy_compilers_less.compile(<any>opts);

        case Compiler.Pug:
            return await deploy_compilers_pug.compile(<any>opts);

        case Compiler.TypeScript:
            // return await vspt_compilers_typescript.compile(<any>opts);
            break;

        case Compiler.UglifyJS:
            return await deploy_compilers_uglifyjs.compile(<any>opts);
    }

    throw new Error(i18.t('compilers.notSupported',
                          compiler));
}

/**
 * Returns the output directory from compiler options.
 * 
 * @param {CompileOptions} opts The options.
 * 
 * @return {string|false} The full path of the output directory or (false) if no output directory has been defined.
 */
export function getOutputDirectory(opts: CompileOptions): string | false {
    if (!opts) {
        opts = <any>{};
    }

    const WORKSPACE = opts.workspace;

    let customOutDir: string | false = WORKSPACE.replaceWithValues(opts.outDirectory);
    if (!deploy_helpers.isEmptyString(customOutDir)) {
        if (!Path.isAbsolute(customOutDir)) {
            customOutDir = Path.join(
                WORKSPACE.rootPath,
                customOutDir
            );
        }

        return Path.resolve(customOutDir);
    }

    return false;
}
