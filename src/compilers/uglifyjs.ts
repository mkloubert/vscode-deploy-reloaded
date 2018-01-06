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
const UglifyJS = require('uglify-js');


/**
 * UglifyJS compile options.
 */
export interface CompileOptions extends deploy_compilers.CompileOptions {
    /**
     * Delete the source file(s) on success or not.
     */
    readonly deleteSources?: boolean;
    /**
     * The encoding of / for the files.
     */
    readonly encoding?: string;
    /**
     * The extension to use for the output files.
     */
    readonly extension?: string;
}

/**
 * UglifyJS compiler result.
 */
export interface CompileResult extends deploy_compilers.CompileResult {
    /** @inheritdoc */
    readonly messages: CompileResultMessage[];
}

/**
 * A UglifyJS result message (entry).
 */
export interface CompileResultMessage extends deploy_compilers.CompileResultMessage {
}


/**
 * Minifies JavaScript files by UglifyJS.
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
    
    const OPTS = compileOpts.options || {};

    let outExt: string;
    if (deploy_helpers.isNullOrUndefined(compileOpts.extension)) {
        outExt = 'min.js';
    }
    else {
        outExt = deploy_helpers.toStringSafe(
            WORKSPACE.replaceWithValues(compileOpts.extension)
        ).trim();
    }

    let enc = deploy_helpers.normalizeString(
        WORKSPACE.replaceWithValues(compileOpts.encoding)
    );
    if ('' === enc) {
        enc = 'utf8';
    }

    const FILES_TO_COMPILE = await deploy_compilers.collectFiles(
        compileOpts,
        '**/*.js',
        '**/*.min.js',
    );

    const DELETE_SOURCES = deploy_helpers.toBooleanSafe(compileOpts.deleteSources);

    for (const FTC of FILES_TO_COMPILE) {
        let msg: CompileResultMessage;

        try {
            const OUTPUT_FILE_PATH = deploy_compilers.getFullOutputPathForSourceFile(FTC, compileOpts);
            const OUT_DIR = Path.dirname(OUTPUT_FILE_PATH);

            await deploy_helpers.createDirectoryIfNeeded(OUT_DIR);

            const EXT = Path.extname(OUTPUT_FILE_PATH);
            const FILENAME = Path.basename(OUTPUT_FILE_PATH, EXT);

            let outputFile: string;
            if ('' === outExt) {
                outputFile = OUTPUT_FILE_PATH;
            }
            else {
                outputFile = Path.join(OUT_DIR,
                                       FILENAME + '.' + outExt);
            }
            outputFile = Path.resolve(outputFile);

            const UGLY_RESULT: any = UglifyJS.minify((await deploy_helpers.readFile(FTC)).toString(enc),
                                                     OPTS);

            if (UGLY_RESULT.error) {
                // error occurred

                RESULT.messages.push({
                    category: deploy_compilers.CompileResultMessageCategory.Error,
                    compiler: deploy_compilers.Compiler.UglifyJS,
                    file: FTC,
                    message: JSON.stringify(UGLY_RESULT.error),
                });
            }
            else {
                deploy_helpers.asArray(UGLY_RESULT.warnings).filter(w => !deploy_helpers.isEmptyString(w)).forEach(w => {
                    RESULT.messages.push({
                        category: deploy_compilers.CompileResultMessageCategory.Warning,
                        compiler: deploy_compilers.Compiler.UglifyJS,
                        file: FTC,
                        message: JSON.stringify(w),
                    });
                });

                const UGLY_CODE = deploy_helpers.toStringSafe(UGLY_RESULT.code);
                
                await deploy_helpers.writeFile(outputFile,
                                               new Buffer(UGLY_CODE, enc));

                if (DELETE_SOURCES) {
                    try {
                        if (outputFile !== Path.resolve(FTC)) {
                            await deploy_helpers.unlink(FTC);
                        }
                    }
                    catch (e) {
                        RESULT.messages.push({
                            category: deploy_compilers.CompileResultMessageCategory.Warning,
                            compiler: deploy_compilers.Compiler.UglifyJS,
                            file: FTC,
                            message: WORKSPACE.t('compilers.errors.couldNotDeleteSourceFile',
                                                 e),
                        });
                    }
                }
            }
        }
        catch (e) {
            msg = {
                category: deploy_compilers.CompileResultMessageCategory.Error,
                compiler: deploy_compilers.Compiler.UglifyJS,
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
