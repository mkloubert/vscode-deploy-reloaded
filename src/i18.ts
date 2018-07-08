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

import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as deploy_workspaces from './workspaces';
import * as i18next from 'i18next';
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * Stores the strings of a translation.
 */
export interface Translation {
    apis?: {
        errors?: {
            couldNotRegister?: string;
            failed?: string;
        };
        noneFound?: string;
        selectHost?: string;
        startHost?: string;
        stopHost?: string;
    };
    cancel?: string;
    canceled?: string;
    changelog?: string;
    close?: string;
    commands?: {
        executionError?: string;
        scriptNotFound?: string;
    };
    compare?: {
        currentFile?: {
            description?: string;
            failed?: string;
            label?: string;
        };
        errors?: {
            operationFailed?: string,
        };
        title?: string;
    };
    compilers?: {
        errors?: {
            couldNotDeleteSourceFile?: string;
        };
        notSupported?: string;
    };
    'continue'?: string;
    credentials?: {
        enterPassphrase?: string;
        enterPassword?: string;
        enterUsername?: string;
    };
    currentFileOrFolder?: {
        noneSelected?: string;
    };
    DELETE?: {
        askIfDeleteLocalFile?: string;
        askIfDeleteLocalFiles?: string;
        canceledByOperation?: string;
        currentFile?: {
            description?: string;
            label?: string;
        };
        currentFileOrFolder?: {
            file?: {
                description?: string;
                label?: string;
            },
            folder?: {
                description?: string;
                label?: string;
            },
            items?: {
                description?: string;
                label?: string;
            }
        };
        deletingFile?: string;
        deletingFiles?: string;
        errors?: {
            invalidWorkspace?: string;
            invalidWorkspaceForPackage?: string;
            operationFailed?: string;
        };
        finishedButton?: {
            text?: string;
            tooltip?: string;
        };
        finishedOperation?: string;
        finishedOperationWithErrors?: string;
        fileList?: {
            description?: string;
            label?: string;
        };
        onChange?: {
            activated?: string;
            button?: {
                text?: string;
                tooltip?: string;
            };
            failed?: string;
            text?: string;
            waitingBeforeActivate?: string;
        };
        package?: {
            description?: string;
            label?: string;
        };
        popups?: {
            allFailed?: string;
            fileFailed?: string;
            fileSucceeded?: string;
            someFailed?: string;
            succeeded?: string;
        };
        selectTarget?: string;
        startOperation?: string;
    };
    deploy?: {
        allOpenFiles?: {
            description?: string;
            label?: string;
        };
        askForCancelOperation?: string;
        canceledByOperation?: string;
        checkBeforeDeploy?: {
            beginOperation?: string;
            newerFilesFound?: string;
            notSupported?: string;
            report?: {
                lastChange?: string;
                localFile?: string;
                remoteFile?: string;
                size?: string;
                title?: string;
            };
        };
        currentFile?: {
            description?: string;
            label?: string;
        };
        currentFileOrFolder?: {
            file?: {
                description?: string;
                label?: string;
            },
            folder?: {
                description?: string;
                label?: string;
            },
            items?: {
                description?: string;
                label?: string;
            }
        };
        deployingFile?: string;
        deployingFiles?: string;
        errors?: {
            invalidWorkspace?: string;
            invalidWorkspaceForPackage?: string;
            operationFailed?: string;
            operationToTargetFailed?: string;
        };
        finishedButton?: {
            text?: string;
            tooltip?: string;
        };
        finishedOperation?: string;
        finishedOperationWithErrors?: string;
        fileList?: {
            description?: string;
            label?: string;
        };
        gitCommit?: {
            description?: string;
            label?: string;
            patterns?: {
                askForFilesToExclude?: {
                    placeHolder?: string;
                    prompt?: string;
                },
                askForFilesToInclude?: {
                    placeHolder?: string;
                    prompt?: string;
                }
            };
        };
        onChange?: {
            button?: {
                text?: string;
                tooltip?: string;
            };
            activated?: string;
            failed?: string;
            text?: string;
            waitingBeforeActivate?: string;
        };
        onSave?: {
            button?: {
                text?: string;
                tooltip?: string;
            };
            failed?: string;
            text?: string;
        };
        package?: {
            description?: string;
            label?: string;
        };
        popups?: {
            allFailed?: string;
            fileFailed?: string;
            fileSucceeded?: string;
            someFailed?: string;
            succeeded?: string;
        };
        selectTarget?: string;
        startOperation?: string;
        uncomittedGitFiles?: {
            description?: string;
            label?: string;
        };
    };
    disposeNotAllowed?: string;
    documents?: {
        html?: {
            defaultName?: string;
        };
    };
    done?: string;
    editors?: {
        active?: {
            noOpen?: string;
        };
        noOpen?: string;
    };
    error?: string;
    extension?: {
        initialized?: string;
        initializing?: string;
    };
    file?: string;
    fileNotFound?: string;
    files?: string;
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
        copyPathToClipboard?: {
            description?: string;
            errors?: {
                failed?: string;
            };
            label?: string;
        };
        currentDirectory?: string;
        currentFileOrFolder?: {
            description?: string;
            label?: string;
            removeFolder?: {
                askBeforeRemove?: string;
                description?: string;
                label?: string;
                removing?: string;
                yesWithLocalFolder?: string;
            };
        };
        directoryIsEmpty?: string;
        errors?: {
            failed?: string;
            operationFailed?: string;
        };
        lastModified?: string;
        loading?: string;
        noName?: string;
        parentDirectory?: string;
        pull?: {
            enterLocalFolder?: string;
            errors?: {
                maxPathDepthReached?: string;
            };
            folder?: {
                description?: string;
                label?: string;
                title?: string;
            };
            folderWithSubfolders?: {
                description?: string;
                label?: string;
                title?: string;
            };
            pullingFile: string;
            pullingFrom: string;
        };
        removeFolder?: {
            askBeforeRemove?: string;
            description?: string;
            label?: string;
            removing?: string;
        };
        selectSource?: string;
        size?: string;
    };
    log?: {
        noFileFound?: string;
        selectLogFile?: string;
    };
    maxDepthReached?: string;
    network?: {
        hostname?: string;
        interfaces?: {
            list?: string;
        };
    };
    no?: string;
    noFiles?: string;
    notFound?: {
        dir?: string;
    };
    notifications?: {
        defaultName?: string;
        loading?: string;
        noneFound?: string;
        selectNotifications?: string;
    };
    ok?: string;
    output?: {
        open?: string;
    };
    packages?: {
        buttons?: {
            defaultText?: string;
            defaultTooltip?: string;
            prompts?: {
                askBeforeDelete?: string;
                askBeforeDeploy?: string;
                askBeforePull?: string;
            };
            unknownOperationType?: string;
        };
        defaultName?: string;
        deploymentFailed?: string;
        noneFound?: string;
        selectPackage?: string;
        virtualTarget?: string;
    };
    pagination?: {
        previousPage?: string;
        nextPage?: string;
    };
    plugins?: {
        __loaded?: string;

        app?: {
            invalidDirectory?: string;
        };
        compiler?: {
            invalidDirectory?: string;
        };
        errors?: {
            initializationFailed?: string;
            loadingFailed?: string;
            noFactoryFunction?: string;
            noModule?: string;
            noneFoundIn?: string;
            notInitialized?: string;
        };
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
    proxies?: {
        buttons?: {
            defaultText?: string;
            defaultTooltip?: string;
        };
        errors?: {
            couldNotRegister?: string;
            couldNotToggleRunningState?: string;
            failed?: string;
        },
        noneFound?: string;
        selectProxy?: string;
        startProxy?: string;
        stopProxy?: string;        
    };
    pull?: {
        allOpenFiles?: {
            description?: string;
            label?: string;
        };
        askForCancelOperation?: string;
        canceledByOperation?: string;
        checkBeforePull?: {
            beginOperation?: string;
            notSupported?: string;
            olderFilesFound?: string;
            report?: {
                lastChange?: string;
                localFile?: string;
                remoteFile?: string;
                size?: string;
                title?: string;
            };
        };
        currentFile?: {
            description?: string;
            label?: string;
        };
        currentFileOrFolder?: {
            file?: {
                description?: string;
                label?: string;
            },
            folder?: {
                description?: string;
                label?: string;
            },
            items?: {
                description?: string;
                label?: string;
            }
        };
        errors?: {
            invalidWorkspace?: string;
            invalidWorkspaceForPackage?: string;
            operationFailed?: string;
            operationForSourceFailed?: string;
        };
        finishedButton?: {
            text?: string;
            tooltip?: string;
        };
        finishedOperation?: string;
        finishedOperationWithErrors?: string;
        fileList?: {
            description?: string;
            label?: string;
        };
        package?: {
            description?: string;
            label?: string;
        };
        popups?: {
            allFailed?: string;
            fileFailed?: string;
            fileSucceeded?: string;
            someFailed?: string;
            succeeded?: string;
        };
        pullingFile?: string;
        pullingFiles?: string;
        selectSource?: string;
        startOperation?: string;
    };
    requirements?: {
        conditions?: {
            defaultName?: string;
            mustMatch?: string;
            shouldMatch?: string;
        };
        extensions?: {
            mustBeInstalled?: string;
            openInMarketplace?: string;
            shouldBeInstalled?: string;
        };
    };
    s3bucket?: {
        credentialTypeNotSupported?: string;
    };
    scm?: {
        branches?: {
            noneFound?: string;
            selectBranch?: string;
        };
        changes?: {
            added?: string;
            deleted?: string;
            modified?: string;
            noneFound?: string;
        };
        commits?: {
            errors?: {
                selectingCommitFailed?: string;
                selectingCommitRangeFailed?: string;
            };
            noneFound?: string;
            selectCommit?: string;
            selectFirstCommit?: string;
            selectLastCommit?: string;
        };
        loadingCommitChanges?: string;
        loadingCommits?: string;
    };
    sftp?: {
        privateKeyNotFound?: string;
    };
    shell?: {
        executing?: string;
    };
    sql?: {
        notSupported?: string;
    };
    switches?: {
        errors?: {
            operationFailed?: string;
        };
    };
    sync?: {
        whenOpen?: {
            errors?: {
                allFailed?: string;
            };
            text?: string;
        };
    };
    targets?: {
        atLeastOneNotFound?: string;
        cannotDefineOtherAsSource?: string;
        defaultName?: string;
        doesNotExist?: string;
        errors?: {
            couldNotLoadDataTransformer?: string;
        };
        noneFound?: string;
        noPluginsFound?: string;
        noWorkspaceFound?: string;
        operations?: {
            devTools?: {
                errors?: {
                    couldNotConnectTo?: string;
                };
                pages?: {
                    defaultTitle?: string;
                    selectPage?: string;
                };
            };
            http?: {
                bodyScriptNotFound?: string;
                noBodyScriptFunction?: string;
                noBodyScriptModule?: string;
            };
            runningAfterDeleted?: string;
            runningAfterDeployed?: string;
            runningAfterPulled?: string;
            runningBeforeDelete?: string;
            runningBeforeDeploy?: string;
            runningBeforePull?: string;
            runningPrepare?: string;
            script?: {
                noScriptFunction?: string;
                noScriptModule?: string;
                scriptNotFound?: string;
            };
            typeNotSupported?: string;
        };
        selectTarget?: string;
        waitingForOther?: string;
    };
    time?: {
        date?: string;
        dateTime?: string;
        dateTimeWithSeconds?: string;
        timeWithSeconds?: string;
    };
    tools?: {
        bower?: {
            description?: string;
            executing?: string;
            label?: string;
            packageExample?: string;
            runInstall?: {
                description?: string;
                enterPackageName?: string;
                label?: string;
            };
            runUninstall?: {
                bowerFileContainsNoPackages?: string;
                bowerFileNotFound?: string;                
                description?: string;
                errors?: {
                    loadingBowerFileFailed?: string;
                };
                label?: string;
            };
        };
        composer?: {
            description?: string;
            executing?: string;
            label?: string;
            packageExample?: string;
            runRemove?: {
                composerFileContainsNoPackages?: string;
                composerFileNotFound?: string;
                description?: string;
                errors?: {
                    loadingComposerFileFailed?: string;
                };
                label?: string;
            };
            runRequire?: {
                description?: string;
                enterPackageName?: string;
                label?: string;
            };
        };
        createDeployScript?: {
            askForNewTargetName?: string;
            askForScriptPath?: string;
            askForUpdatingSettings?: string;
            description?: string;
            errors?: {
                targetAlreadyDefined?: string;
                updateTargetSettingsFailed?: string;
            };
            label?: string;
            scriptCreated?: string;
        };
        createDeployOperationScript?: {
            askForNewOperationName?: string;
            askForOperationType?: {
                afterDeployment?: string;
                beforeDeploy?: string;
                placeHolder?: string;
            };
            askForScriptPath?: string;
            askForUpdatingSettings?: string;
            description?: string;
            errors?: {
                updateSettingsFailed?: string;
            };
            label?: string;
            scriptCreated?: string;
            selectTarget?: string;
        };
        errors?: {
            operationFailed?: string;
        };
        git?: {
            listFileChanges?: {
                description?: string;
                label?: string;
            };
        };
        npm?: {
            description?: string;
            executing?: string;
            label?: string;
            moduleExample?: string;
            runInstall?: {
                description?: string;
                enterModuleName?: string;
                label?: string;
            };
            runLink?: {
                description?: string;
                enterModuleName?: string;
                label?: string;
            };
            runUninstall?: {
                description?: string;
                errors?: {
                    loadingPackageFileFailed?: string;
                };
                packageFileContainsNoModules?: string;
                packageFileNotFound?: string;
                label?: string;
            };
        };
        quickExecution?: {
            description?: string;
            errors?: {
                failed?: string;
            };
            help?: {
                title?: string;
            },
            inputCode?: string;
            label?: string;
            result?: {
                title?: string;
            },
            uuid?: {
                notSupported?: string;
            };
        };
        sendOrReceiveFile?: {
            description?: string;
            label?: string;
            receive?: {
                button?: {
                    text?: string;
                    tooltip?: string;
                };
                description?: string;
                enterPort?: string;
                errors?: {
                    couldNotReceiveFile?: string;
                    startHostFailed?: string;
                };
                label?: string;
            };
            send?: {
                description?: string;
                enterRemoteAddress?: string;
                errors?: {
                    couldNotSendFile?: string;
                };
                label?: string;
            };
        };
        showPackageFiles?: {
            description?: string;
            label?: string;
            title?: string;
        };
        yarn?: {
            description?: string;
            executing?: string;
            label?: string;
            moduleExample?: string;
            runAdd?: {
                description?: string;
                enterModuleName?: string;                
                label?: string;                
            };
            runRemove?: {
                description?: string;
                errors?: {
                    loadingPackageFileFailed?: string;
                };
                label?: string;
                packageFileContainsNoModules?: string;
                packageFileNotFound?: string;
            };
        };
    };
    values?: {
        errors?: {
            targetFormatNotSupported?: string;
        };
        typeNotSupported?: string;
    };
    'vs-deploy'?: {
        continueAndInitialize?: string;
        currentlyActive?: string;
    };
    warning?: string;
    waiting?: string;
    workspace?: string;
    workspaces?: {
        active?: {
            errors?: {
                selectWorkspaceFailed?: string;
            };
            noneFound?: string;
            selectWorkspace?: string;
        };
        bower?: {
            install?: {
                errors?: {
                    failed?: string;
                };
                running?: string;
            }
        };
        composer?: {
            install?: {
                errors?: {
                    failed?: string;
                };
                running?: string;
            }
        };
        errors?: {
            cannotDetectGitClient?: string;
            cannotDetectGitFolder?: string;
            cannotDetectMappedPathInfoForFile?: string;
            cannotDetectPathInfoForFile?: string;
            cannotFindBranch?: string;
            cannotFindScmHash?: string;
            cannotUseTargetForFile?: string;
            initNodeModulesFailed?: string;
            notInitialized?: string;
        };
        initializing?: string;
        noneFound?: string;
        noSelected?: string;
        npm?: {
            install?: {
                errors?: {
                    failed?: string;
                };
                running?: string;
            }
        };
        removing?: string;
        selectButton?: {
            tooltip?: string;
        };
        selectSource?: string;
        selectTarget?: string;
        selectWorkspace?: string;
        yarn?: {
            install?: {
                errors?: {
                    failed?: string;
                };
                running?: string;
            }
        };
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

    return await deploy_helpers.buildWorkflow().next(async () => {
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
