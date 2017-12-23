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

var resources = require('./resources');
var vscode = require('vscode');


function createCompletedAction(ctx, resolve, reject) {
    var completedInvoked = false;

    return function(err) {
        if (completedInvoked) {
            return;
        }
        completedInvoked = true;

        if (err) {
            reject(err);
        }
        else {
            resolve(ctx);
        }
    };
}

function createFileRepository(ctx, opts) {
    if (!opts) {
        opts = {};
    }

    var args = ctx.arguments;
    var deploy_helpers = args.require('./helpers');

    var compress = deploy_helpers.toBooleanSafe(opts.compress);
    var dir = deploy_helpers.toStringSafe(opts.dir);
    var files = opts.files.map(function(f) { return f; });
    var excludeFiles = opts.excludeFiles;
    var targetFile = opts.targetFile;
    // var varName = deploy_helpers.toStringSafe(opts.varName);
    var varName = "REPOSITORY";

    return new Promise(function(resolve, reject) {
        var completed = createCompletedAction(args, resolve, reject);

        try {
            var FS = require('fs');
            var Path = require('path');
            
            var ZLib = require('zlib');

            dir = Path.resolve(dir);
            targetFile = Path.resolve(targetFile);

            // generate files
            {
                var imports = '';
                if (compress) {
                    imports += `
import * as deploy_helpers from '../helpers';
import * as deploy_resources from '../resources';
import * as ZLib from 'zlib';

`;
                }


                var ts = `${resources.LICENSE_HEADER}

/**
 * AUTO GENERATED CODE
 */
${imports}
const ${varName} = {`;

                const ALL_KEYS = [];
                var finished = () => {
                    ts += `
};
`;

                    var funcs = `

/**
 * Tries to return content from '${varName}' constant.
 * 
 * @param {RepositoryKey} key The key inside the constant.
 * 
 * @return {Promise<Buffer>} The promise with the data (if available).
 */
export function getContent(key: RepositoryKey): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        let data: Buffer;

        for (const P in ${varName}) {
            if (P === key) {
                data = ${varName}[P];
                break;
            }
        }

`;
                    if (compress) {
                        funcs += `        if (data) {
            ZLib.gunzip(data, (err, uncompressedData) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(uncompressedData);
                }
            });
        }
        else {
            resolve(data);
        }`;
                    }
                    else {
                        funcs += `        resolve(data);`;
                    }
                    funcs += `
    });
}

/**
 * Tries to return content from '${varName}' constant.
 * 
 * @param {RepositoryKey} key The key inside the constant.
 * 
 * @return Buffer The data (if available).
 */
export function getContentSync(key: RepositoryKey): Buffer {
    let data: Buffer;

    for (const P in ${varName}) {
        if (P === key) {
            data = ${varName}[P];
            break;
        }
    }

`;
                    if (compress) {
                        funcs += `    if (data) {
        return ZLib.gunzipSync(data);
    }
`;
                    }

                    funcs += `
    return data;
}

/**
 * Tries to return content from '${varName}' constant as string.
 * 
 * @param {RepositoryKey} key The key inside the constant.
 * @param {string} \[enc\] The encoding to use. Default: 'utf8'.
 * 
 * @return {Promise<string>} The promise with the data (if available).
 */
export async function getStringContent(key: RepositoryKey, enc?: string): Promise<string> {
    enc = deploy_helpers.normalizeString(enc);
    if ('' === enc) {
        enc = 'utf8';
    }

    const DATA = await getContent(key);
    if (DATA) {
        return deploy_resources.replaceTemplateVars(
            DATA.toString(enc)
        );
    }
}

/**
 * Tries to return content from '${varName}' constant as string.
 * 
 * @param {RepositoryKey} key The key inside the constant.
 * @param {string} \[enc\] The encoding to use. Default: 'utf8'.
 * 
 * @return {string} The data (if available).
 */
export function getStringContentSync(key: RepositoryKey, enc?: string): string {
    enc = deploy_helpers.normalizeString(enc);
    if ('' === enc) {
        enc = 'utf8';
    }

    const DATA = getContentSync(key);
    if (DATA) {
        return deploy_resources.replaceTemplateVars(
            DATA.toString(enc)
        );
    }
}
`;

                    // keys
                    ts += `

/**
 * A possible value for a repository key.
 */
export type RepositoryKey = `;
                    if (ALL_KEYS.length > 0) {
                        ts += ALL_KEYS.sort((x, y) => {
                            return deploy_helpers.compareValuesBy(x, y,
                                                                  i => deploy_helpers.normalizeString());
                        }).map(k => {
                            return JSON.stringify(k);
                        }).join(' | ');
                    }
                    else {
                        ts += "never";
                    }
                    ts += `;
`;

                    ts += funcs;

                    FS.writeFile(targetFile, new Buffer(ts, 'utf8'), (err) => {
                        completed(err);
                    });            
                };

                var nextFile;
                nextFile = () => {
                    if (files.length < 1) {
                        finished();
                        return;
                    }

                    var f = files.shift();
                    ctx.onBeforeDeployFile(f);

                    FS.readFile(f, (err, data) => {
                        if (err) {
                            completed(err);
                        }
                        else {
                            var appendVar = (dataToAppend) => {
                                try {
                                    var base64 = dataToAppend.toString('base64');
                                    var key = deploy_helpers.normalizeString(Path.basename(f));

                                    ts += `
    // START: ${key}
    ${JSON.stringify(key)}: new Buffer(${JSON.stringify(base64)}, 'base64'),
    // END: ${key}
`;

                                    ALL_KEYS.push(key);

                                    ctx.onFileCompleted(null, f);
                                    nextFile();
                                }
                                catch (err) {
                                    completed(err);
                                }
                            };

                            if (compress) {
                                ZLib.gzip(data, (err, compressedData) => {
                                    if (err) {
                                        completed(err);
                                    }
                                    else {
                                        appendVar(compressedData);
                                    }
                                });
                            }
                            else {
                                appendVar(data);
                            }
                        }
                    });
                };

                nextFile();
            };
        }
        catch (e) {
            completed(e);
        }
    });
}

function generateCSS(ctx) {
    var args = ctx.arguments;

    return new Promise(function(resolve, reject) {
        var completed = createCompletedAction(ctx, resolve, reject);

        try {
            var Path = require('path');

            var workspaceDir = vscode.workspace.rootPath;
            var cssDir = Path.join(workspaceDir, '_res/css');
            var outFile = Path.join(workspaceDir, 'src/resources/css.ts');

            createFileRepository(ctx, {
                dir: cssDir,
                varName: 'STYLES',
                targetFile: outFile,
                files: ctx.files,
                compress: true
            }).then(function() {
                completed();    
            }).catch(function(err) {
                completed(err);
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

function generateHtml(ctx) {
    var args = ctx.arguments;

    return new Promise(function(resolve, reject) {
        var completed = createCompletedAction(ctx, resolve, reject);

        try {
            var Path = require('path');

            var workspaceDir = vscode.workspace.rootPath;
            var htmlDir = Path.join(workspaceDir, '_res/html');
            var outFile = Path.join(workspaceDir, 'src/resources/html.ts');

            createFileRepository(ctx, {
                dir: htmlDir,
                varName: 'TEMPLATES',
                targetFile: outFile,
                files: ctx.files,
                compress: true
            }).then(function() {
                completed();    
            }).catch(function(err) {
                completed(err);
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

function generateJavaScript(ctx) {
    var args = ctx.arguments;

    return new Promise(function(resolve, reject) {
        var completed = createCompletedAction(ctx, resolve, reject);

        try {
            var Path = require('path');

            var workspaceDir = vscode.workspace.rootPath;
            var jsDir = Path.join(workspaceDir, '_res/javascript');
            var outFile = Path.join(workspaceDir, 'src/resources/javascript.ts');

            createFileRepository(ctx, {
                dir: jsDir,
                varName: 'SCRIPTS',
                targetFile: outFile,
                files: ctx.files,
                compress: true
            }).then(function() {
                completed();    
            }).catch(function(err) {
                completed(err);
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

function deploy(args, files) {
    var deploy_helpers = args.require('./helpers');

    return new Promise(function(resolve, reject) {
        args.context.once('deploy.cancel', function() {
            args.canceled = true;
        });

        var onBeforeDeployFile = function(file) {
            if (args.deployOptions.onBeforeDeployFile) {
                args.deployOptions.onBeforeDeployFile(args.sender, {
                    file: file,
                    target: args.target
                });
            }
        };

        var onFileCompleted = function(err, file) {
            if (args.deployOptions.onFileCompleted) {
                args.deployOptions.onFileCompleted(args.sender, {
                    error: err,
                    file: file,
                    target: args.target
                });
            }
        };

        var completed = function(err) {
            if (err) {
                reject(err);
            }
            else {
                resolve(args);
            }
        };

        try {
            var func;
            var type = deploy_helpers.normalizeString(args.targetOptions);
            switch (type) {
                case 'css':
                    func = generateCSS;
                    break;

                case 'html':
                    func = generateHtml;
                    break;

                case 'js':
                    func = generateJavaScript;
                    break;
            }

            if (func) {
                var ctx = {
                    arguments: args,
                    files: files,
                    onBeforeDeployFile: onBeforeDeployFile,
                    onFileCompleted: onFileCompleted,
                };

                Promise.resolve(func(ctx)).then(function() {
                    completed(null);
                }).catch(function(err) {
                    completed(err);
                });
            }
            else {
                completed(new Error("Type '" + type + "' is UNKNOWN!"));
            }
        }
        catch (e) {
            completed(e);
        }
    });
};

exports.deployWorkspace = function(args) {
    return Promise.resolve(deploy(args, args.files));
};
