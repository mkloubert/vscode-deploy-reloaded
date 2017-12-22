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
import * as deploy_log from './log';
import * as deploy_workflows from './workflows';
import * as deploy_workspaces from './workspaces';
import * as i18next from 'i18next';
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * Stores the strings of a translation.
 */
export interface Translation {
    cancel?: string;
    commands?: {
        executionError?: string;
        scriptNotFound?: string;
    };
    compare?: {
        currentFile?: {
            failed?: string;
        };
    };
    editors?: {
        active?: {
            noOpen?: string;
        };
    };
    ftp?: {
        couldNotConnect?: string;
        couldNotConnectWithJSFTP?: string;
    };
    http?: {
        errors?: {
            client?: string;
            maxRedirections?: string;
            noRedirectLocation?: string;
            protocolNotSupported?: string;
            server?: string;
            unknown?: string;
        };
    };
    initializationCanceled?: string;
    isNo?: {
        directory?: string;
        file?: string;
    };
    listDirectory?: {
        currentDirectory?: string;
        directoryIsEmpty?: string;
        lastModified?: string;
        loading?: string;
        noName?: string;
        parentDirectory?: string;
        size?: string;
    };
    no?: string;
    packages?: {
        buttons?: {
            defaultText?: string;
            defaultTooltip?: string;
        };
        defaultName?: string;
        deploymentFailed?: string;
        virtualTarget?: string;
    };
    plugins?: {
        list?: {
            defaultEntryName?: string;
            selectEntry?: string;
        };
        local?: {
            invalidDirectory?: string;
        };
        mail?: {
            subject?: string;
            text?: string;
        };
        prompt?: {
            validation?: {
                noBool?: string;
                noFloat?: string;
                noInt?: string;
                noJSON?: string;
            };
        };
        script?: {
            noScriptFunction?: string;
            noScriptModule?: string;
            scriptNotFound?: string;
        };
        switch?: {
            button?: {
                text?: string;
                tooltip?: string;
            };
            changeSwitch?: {
                description?: string;
                label?: string;
            };
            defaultOptionName?: string;
            noDefined?: string;
            noOptionsDefined?: string;
            noOptionSelected?: string;
            noOptionSelected2?: string;
            selectOption?: string;
            selectSwitch?: string;
        };
        test?: {
            invalidDirectory?: string;
        };
        zip?: {
            errors?: {
                fileAlreadyExists?: string;
                fileNotFound?: string;
                noFilesFound?: string;
            };
            invalidDirectory?: string;
        };
    };
    s3bucket?: {
        credentialTypeNotSupported?: string;
    };
    sftp?: {
        privateKeyNotFound?: string;
    };
    sql?: {
        notSupported?: string;
    };
    targets?: {
        defaultName?: string;
        doesNotExist?: string;
        noneFound?: string;
        noPluginsFound?: string;
        noWorkspaceFound?: string;
        operations?: {
            http?: {
                bodyScriptNotFound?: string;
                noBodyScriptFunction?: string;
                noBodyScriptModule?: string;
            };
            script?: {
                noScriptFunction?: string;
                noScriptModule?: string;
                scriptNotFound?: string;
            };
            typeNotSupported?: string;
        };
    };
    time?: {
        dateTimeWithSeconds?: string;
    };
    tools?: {
        createDeployScript?: {
            askForNewTargetName?: string;
            askForScriptPath?: string;
            askForUpdatingSettings?: string;
            errors?: {
                targetAlreadyDefined?: string;
                updateTargetSettingsFailed?: string;
            };
            scriptCreated?: string;
        };
    };
    'vs-deploy'?: {
        continueAndInitialize?: string;
        currentlyActive?: string;
    };
    workspaces?: {
        noneFound?: string;
        selectWorkspace?: string;
    };
    yes?: string;
}


let globalTranslator: i18next.TranslationFunction;


/**
 * Creates a new the language repository.
 * 
 * @param {string} [lang] The custom language ID to use.
 * 
 * @returns {Promise<TranslationFunction>} The promise with the translation function.
 */
export async function create(lang?: string): Promise<i18next.TranslationFunction> {
    lang = deploy_helpers.toStringSafe(lang);
    if (deploy_helpers.isEmptyString(lang)) {
        lang = vscode.env.language;
    }
    lang = normalizeLangName(lang);
    if ('' === lang) {
        lang = 'en';
    }

    const LANG_DIR = Path.join(__dirname, 'lang');
    const RESOURCES: any = {};

    let isDirectory = false;

    return await deploy_workflows.build().next(async () => {
        try {
            if (await deploy_helpers.exists(LANG_DIR)) {
                isDirectory = (await deploy_helpers.lstat(LANG_DIR)).isDirectory();
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'i18.init(1)');
        }
    }).next(async () => {
        if (!isDirectory) {
            return;
        }

        try {
            const FILES = await deploy_helpers.glob('*.js', {
                cwd: LANG_DIR,
                nocase: false,
                root: LANG_DIR,
            });

            for (const F of FILES) {
                try {
                    const FILENAME = Path.basename(F);
                    const LANG_NAME = normalizeLangName( FILENAME.substr(0, FILENAME.length - 3) );
                    if ('' === LANG_NAME) {
                        continue;  // no language name available
                    }

                    if (!(await deploy_helpers.lstat(F)).isFile()) {
                        continue;  // no file
                    }

                    // deleted cached data
                    // and load current translation
                    // from file
                    RESOURCES[LANG_NAME] = {
                        translation: require(F).translation,
                    };
                }
                catch (e) {
                    deploy_log.CONSOLE
                              .trace(e, 'i18.init(3)');
                }
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'i18.init(2)');
        }
    }).next((ctx) => {
        return new Promise<i18next.TranslationFunction>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                i18next.createInstance({
                    lng: lang,
                    resources: RESOURCES,
                    fallbackLng: 'en',
                }, (err, tr) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        COMPLETED(null, tr);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }).start();
}

/**
 * Initializes the global translations.
 * 
 * @return {Promise<boolean>} The promise that indicates if operation was succcessful or not.
 */
export async function init(): Promise<boolean> {
    try {
        globalTranslator = await create();

        return true;
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'i18.init()');

        return false;
    }
}

/**
 * Initializes the language repository for a workspace.
 * 
 * @returns {Promise<TranslationFunction>} The promise with the translation function.
 */
export async function initForWorkspace(): Promise<i18next.TranslationFunction> {
    const ME: deploy_workspaces.Workspace = this;

    return await create(ME.config.language);
}

function normalizeLangName(lang: string): string {
    lang = deploy_helpers.normalizeString(lang);
    lang = deploy_helpers.replaceAllStrings(lang, '-', '_');

    return lang;
}

/**
 * Returns a translated string by key.
 * 
 * @param {string} key The key.
 * @param {any} [args] The optional arguments.
 * 
 * @return {string} The "translated" string.
 */
export function t(key: string, ...args: any[]): string {
    return translateWith.apply(null,
                               [ <any>globalTranslator, null, key ].concat( args ));
}

/**
 * Returns a translated string by key and a specific function.
 * 
 * @param {i18next.TranslationFunction} func The function to use.
 * @param {Function} fallback The fallback function.
 * @param {string} key The key.
 * @param {any} [args] The optional arguments.
 * 
 * @return {string} The "translated" string.
 */
export function translateWith(func: i18next.TranslationFunction,
                              fallback: () => string,
                              key: string, ...args: any[]): string {
    if (!fallback) {
        fallback = () => key;
    }

    try {
        if (func) {
            let formatStr = func(deploy_helpers.toStringSafe(key));
            formatStr = deploy_helpers.toStringSafe(formatStr);

            return deploy_helpers.formatArray(formatStr, args);
        }

        return fallback();
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'i18.translateWith()');

        return key;
    }
}
