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
    no?: string;
    packages?: {
        defaultName?: string;
    };
    targets?: {
        defaultName?: string;
    };
    yes?: string;
}


/**
 * Initializes the language repository for a workspace.
 * 
 * @returns {Promise<TranslationFunction>} The promise with the translation function.
 */
export async function init(): Promise<i18next.TranslationFunction> {
    const ME: deploy_workspaces.Workspace = this;
    const CONFIG = ME.config || <any>{};

    let lang = CONFIG.language;
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
                    delete require.cache[F];
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

function normalizeLangName(lang: string): string {
    lang = deploy_helpers.normalizeString(lang);
    lang = deploy_helpers.replaceAllStrings(lang, '-', '_');

    return lang;
}
