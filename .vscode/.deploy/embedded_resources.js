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

const FS = require('fs');
const Path = require('path');
const Resources = require('./resources');
const ZLib = require('zlib');


function createFileRepository(args, opts) {
    const deploy_helpers = args.require('./helpers');

    const COMPRESS = deploy_helpers.toBooleanSafe(opts.compress);
    const FILES = args.files.map((f) => f);
    const TARGET_FILE = Path.resolve(
        deploy_helpers.toStringSafe(opts.targetFile)
    );
    const VAR_NAME = "REPOSITORY";

    return new Promise(function(resolve, reject) {
        const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

        try {
            // generate files
            {
                let imports = '';
                if (COMPRESS) {
                    imports += `
import * as deploy_helpers from '../helpers';
import * as deploy_resources from '../resources';
import * as ZLib from 'zlib';

`;
                }


                let ts = `${Resources.LICENSE_HEADER}

/**
 * AUTO GENERATED CODE
 */
${imports}
const ${VAR_NAME} = {`;

                const ALL_KEYS = [];
                const FINISHED = () => {
                    ts += `
};
`;

                    let funcs = `

/**
 * Tries to return content from '${VAR_NAME}' constant.
 * 
 * @param {RepositoryKey} key The key inside the constant.
 * 
 * @return {Promise<Buffer>} The promise with the data (if available).
 */
export function getContent(key: RepositoryKey): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        let data: Buffer;

        for (const P in ${VAR_NAME}) {
            if (P === key) {
                data = ${VAR_NAME}[P];
                break;
            }
        }

`;
                    if (COMPRESS) {
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
 * Tries to return content from '${VAR_NAME}' constant.
 * 
 * @param {RepositoryKey} key The key inside the constant.
 * 
 * @return Buffer The data (if available).
 */
export function getContentSync(key: RepositoryKey): Buffer {
    let data: Buffer;

    for (const P in ${VAR_NAME}) {
        if (P === key) {
            data = ${VAR_NAME}[P];
            break;
        }
    }

`;
                    if (COMPRESS) {
                        funcs += `    if (data) {
        return ZLib.gunzipSync(data);
    }
`;
                    }

                    funcs += `
    return data;
}

/**
 * Tries to return content from '${VAR_NAME}' constant as string.
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
 * Tries to return content from '${VAR_NAME}' constant as string.
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

                    FS.writeFile(TARGET_FILE, new Buffer(ts, 'utf8'), (err) => {
                        COMPLETED(err);
                    });
                };

                let nextFile;
                nextFile = () => {
                    if (FILES.length < 1) {
                        FINISHED();
                        return;
                    }

                    const F = FILES.shift();

                    F.onBeforeUpload().then(() => {
                        F.read().then((data) => {
                            const APPEND_VAR = (dataToAppend) => {
                                try {
                                    let base64 = dataToAppend.toString('base64');
                                    let key = deploy_helpers.normalizeString(F.name);

                                    ts += `
    // START: ${key}
    ${JSON.stringify(key)}: new Buffer(${JSON.stringify(base64)}, 'base64'),
    // END: ${key}
`;

                                    ALL_KEYS.push(key);

                                    F.onUploadCompleted().then(() => {
                                        nextFile();
                                    }, (err) => {
                                        COMPLETED(err);
                                    });
                                }
                                catch (err) {
                                    COMPLETED(err);
                                }
                            };

                            if (COMPRESS) {
                                ZLib.gzip(data, (err, compressedData) => {
                                    if (err) {
                                        COMPLETED(err);
                                    }
                                    else {
                                        APPEND_VAR(compressedData);
                                    }
                                });
                            }
                            else {
                                APPEND_VAR(data);
                            }
                        }, (err) => {
                            COMPLETED(err);
                        });
                    }, (err) => {
                        COMPLETED(err);
                    });
                };

                nextFile();
            };
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}


function generateCSS(args) {
    const deploy_helpers = args.require('./helpers');

    return new Promise(function(resolve, reject) {
        const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

        try {
            createFileRepository(args, {
                dir: Path.join(args.workspaceRoot,
                               '_res/css'),
                targetFile: Path.join(args.workspaceRoot,
                                      'src/resources/css.ts'),
                compress: true
            }).then(() => {
                COMPLETED();    
            }).catch((err) => {
                COMPLETED(err);
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

function generateHtml(args) {
    const deploy_helpers = args.require('./helpers');

    return new Promise(function(resolve, reject) {
        const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

        try {
            createFileRepository(args, {
                dir: Path.join(args.workspaceRoot,
                               '_res/html'),
                targetFile: Path.join(args.workspaceRoot,
                                      'src/resources/html.ts'),
                compress: true
            }).then(() => {
                COMPLETED();    
            }).catch((err) => {
                COMPLETED(err);
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}

function generateJavaScript(args) {
    const deploy_helpers = args.require('./helpers');

    return new Promise(function(resolve, reject) {
        const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

        try {
            createFileRepository(args, {
                dir: Path.join(args.workspaceRoot,
                               '_res/javascript'),
                targetFile: Path.join(args.workspaceRoot,
                                      'src/resources/javascript.ts'),
                compress: true
            }).then(() => {
                COMPLETED();    
            }, (err) => {
                COMPLETED(err);
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}


function deploy(args) {
    const deploy_helpers = args.require('./helpers');

    return new Promise(function(resolve, reject) {
        const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

        try {
            let func = false;

            switch ( deploy_helpers.normalizeString(args.options) ) {
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

            if (false !== func) {
                Promise.resolve( func(args) ).then(() => {
                    COMPLETED(null);
                }, (err) => {
                    COMPLETED(err);
                });
            }
            else {
                COMPLETED(new Error(`Type '${TYPE}' is UNKNOWN!`));
            }
        }
        catch (e) {
            COMPLETED(e);
        }
    });
};


// entry point
exports.execute = function(args) {
    switch (args.operation) {
        case 1:
            return deploy(args);
    }

    return Promise.reject(
        new Error(`Operation ${args.operation} not supported!`)
    );
};
