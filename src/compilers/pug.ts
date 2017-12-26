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

import * as deploy_compilers from '../compilers';
import * as deploy_helpers from '../helpers';
import * as Path from 'path';
import * as Pug from 'pug';
import * as vscode from 'vscode';


/**
 * Pug compile options.
 */
export interface CompileOptions extends deploy_compilers.CompileOptions<Pug.Options> {
    /**
     * The encoding of / for the files.
     */
    readonly encoding?: string;
    /**
     * The custom file extension for the output files to use.
     */
    readonly extension?: string;
}

/**
 * Pug compiler result.
 */
export interface CompileResult extends deploy_compilers.CompileResult {
    /** @inheritdoc */
    readonly messages: CompileResultMessage[];
}

/**
 * A Pug result message (entry).
 */
export interface CompileResultMessage extends deploy_compilers.CompileResultMessage {
}


/**
 * Compiles Pug files.
 * 
 * @param {CompileOptions} compileOpts The options for the compilation.
 * 
 * @return {Promise<CompileResult>} The promise with the result.
 */
export async function compile(compileOpts: CompileOptions) {
    const WORKSPACE = compileOpts.workspace;

    const RESULT: CompileResult = {
        messages: [],
    };
    
    const OPTS: Pug.Options = compileOpts.options || {};

    const FILES_TO_COMPILE = await deploy_compilers.collectFiles(
        compileOpts,
        '**/*.pug'
    );

    let enc = deploy_helpers.normalizeString(
        WORKSPACE.replaceWithValues(compileOpts.encoding)
    );
    if ('' === enc) {
        enc = 'utf8';
    }

    let outExt = deploy_helpers.toStringSafe(
        WORKSPACE.replaceWithValues(compileOpts.extension)
    ).trim();
    if ('' === outExt) {
        outExt = 'html';
    }

    for (const FTC of FILES_TO_COMPILE) {
        let msg: CompileResultMessage;
        
        try {
            const PUG_OPTS = deploy_helpers.cloneObject(OPTS);
            PUG_OPTS.filename = FTC;

            let outDir = deploy_compilers.getOutputDirectory(compileOpts);
            if (false === outDir) {
                outDir = Path.dirname(FTC);
            }

            const EXT = Path.extname(FTC);
            const FILENAME = Path.basename(FTC, EXT);

            const OUTPUT_FILE = Path.join(outDir,
                                          FILENAME + '.' + outExt);

            const HTML = Pug.render((await deploy_helpers.readFile(FTC)).toString(enc),
                                    PUG_OPTS);

            await deploy_helpers.writeFile(OUTPUT_FILE,
                                           new Buffer(HTML, enc));
        }
        catch (e) {
            msg = {
                category: deploy_compilers.CompileResultMessageCategory.Error,
                compiler: deploy_compilers.Compiler.Pug,
                file: FTC,
                message: deploy_helpers.toStringSafe(e),
            };
        }

        if (msg) {
            RESULT.messages.push(msg);
        }
    }

    return RESULT;
}
