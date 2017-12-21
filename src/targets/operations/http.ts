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

import * as deploy_contracts from '../../contracts';
import * as deploy_helpers from '../../helpers';
import * as deploy_http from '../../http';
import * as deploy_log from '../../log';
import * as deploy_targets from '../../targets';
import * as i18 from '../../i18';
import * as OS from 'os';
import * as Path from 'path';
import * as Url from 'url';
import * as vscode from 'vscode';


/**
 * A module for getting the request body for a HTTP operation.
 */
export interface HttpBodyModule {
    /**
     * Gets the request body data.
     */
    readonly getBody: HttpBodyModuleExecutor;
}

/**
 * The function / method that gets the request body data.
 * 
 * @param {HttpBodyModuleExecutionArguments} args The arguments for the execution.
 * 
 * @return {any} The data to send.
 */
export type HttpBodyModuleExecutor = (args: HttpBodyModuleExecutionArguments) => any;

/**
 * Arguments for the function / method that gets the request body data.
 */
export interface HttpBodyModuleExecutionArguments extends deploy_contracts.ScriptArguments {
    /**
     * The underlying operation context.
     */
    readonly context: deploy_targets.TargetOperationExecutionContext<HttpTargetOperation>;
    /**
     * The request URL.
     */
    readonly url: Url.Url;
}

/**
 * An operation for doing a HTTP request.
 */
export interface HttpTargetOperation extends deploy_targets.TargetOperation {
    /**
     * The body or the path to a script that returns the body to send.
     */
    readonly body?: string;
    /**
     * The request headers.
     */
    readonly headers?: any;
    /**
     * Indicates if 'body' is Base64 encoded or not.
     */
    readonly isBodyBase64?: boolean;
    /**
     * Indicates if 'body' contains the path to a script instead the content to send.
     */
    readonly isBodyScript?: boolean;
    /**
     * The HTTP request method.
     */
    readonly method?: string;
    /**
     * A list of headers that should NOT use placeholders / values.
     */
    readonly noPlaceholdersForTheseHeaders?: string | string[] | boolean;
    /**
     * The options for the script that returns the body to send.
     */
    readonly options?: any;
    /**
     * The password for basic auth.
     */
    readonly password?: string;
    /**
     * The URL.
     */
    readonly url?: string;
    /**
     * The username for basic auth.
     */
    readonly username?: string;
}


/** @inheritdoc */
export async function execute(context: deploy_targets.TargetOperationExecutionContext<HttpTargetOperation>) {
    const OPERATION = context.operation;
    const TARGET = context.target;
    const WORKSPACE = TARGET.__workspace;

    const SCOPES = [
        WORKSPACE.settingFolder,
        Path.join(OS.homedir(), deploy_contracts.HOMEDIR_SUBFOLDER),
    ];

    let u = deploy_helpers.toStringSafe(OPERATION.url);
    if (deploy_helpers.isEmptyString(u)) {
        u = 'http://localhost/';
    }

    const URL = Url.parse(u);

    const PROTOCOL = deploy_helpers.normalizeString(URL.protocol);
    switch (PROTOCOL) {
        case 'http:':
        case 'https:':
            break;

        default:
            throw new Error(i18.t('targets.operations.http.protocolNotSupported',
                                  PROTOCOL));
    }

    const HEADERS = context.operation.headers || {};
    for (const P in HEADERS) {
        let name = deploy_helpers.normalizeString(P);
        let value = HEADERS[P];

        let usePlaceholders: boolean;
        if (deploy_helpers.isBool(OPERATION.noPlaceholdersForTheseHeaders)) {
            usePlaceholders = !OPERATION.noPlaceholdersForTheseHeaders;
        }
        else {
            usePlaceholders = deploy_helpers.asArray(OPERATION.noPlaceholdersForTheseHeaders)
                                            .map(n => deploy_helpers.normalizeString(n))
                                            .indexOf(name) < 0;
        }

        if (usePlaceholders) {
            value = WORKSPACE.replaceWithValues(value);
        }

        HEADERS[P] = value;
    }

    const USERNAME = deploy_helpers.toStringSafe(OPERATION.username);
    const PASSWORD = deploy_helpers.toStringSafe(OPERATION.password);
    if ('' !== USERNAME.trim() || '' !== PASSWORD) {
        // Basic Auth

        HEADERS['Authorization'] = 'Basic ' + 
            (new Buffer(`${USERNAME}:${PASSWORD}`, 'ascii')).toString('base64');
    }

    let method = deploy_helpers.toStringSafe(OPERATION.method).toUpperCase().trim();
    if ('' === method) {
        method = 'GET';
    }

    let body: string;
    let getBodyToSend: () => Buffer | PromiseLike<Buffer> = () => {
        let strBody = deploy_helpers.toStringSafe(body);

        if (deploy_helpers.toBooleanSafe(OPERATION.isBodyBase64)) {
            if (!deploy_helpers.isEmptyString(strBody)) {
                return new Buffer(strBody.trim(), 'base64');
            }
        }
        else {
            return new Buffer(strBody, 'ascii');
        }
    };
    if (deploy_helpers.toBooleanSafe(OPERATION.isBodyScript)) {
        let bodyScript: string | false = deploy_helpers.toStringSafe(
            WORKSPACE.replaceWithValues(OPERATION.body)
        );
        if (deploy_helpers.isEmptyString(bodyScript)) {
            bodyScript = './getBody.js';
        }

        let bodyScriptFullPath = await WORKSPACE.getExistingSettingPath(bodyScript);

        if (false === bodyScriptFullPath) {
            throw new Error(i18.t('targets.operations.http.bodyScriptNotFound',
                                  bodyScript));
        }

        const BODY_MODULE = await deploy_helpers.loadModule<HttpBodyModule>(bodyScriptFullPath);
        if (BODY_MODULE) {
            const GET_BODY = BODY_MODULE.getBody;
            if (GET_BODY) {
                getBodyToSend = async () => {
                    const ARGS: HttpBodyModuleExecutionArguments = {
                        context: context,
                        globals: WORKSPACE.globals,
                        globalState: WORKSPACE.sessionState['target_operations']['http']['global'],
                        logger: deploy_log.CONSOLE,
                        options: deploy_helpers.cloneObject(OPERATION.options),
                        require: (id) => {
                            return deploy_helpers.requireFromExtension(id);
                        },
                        state: undefined,
                        url: URL,
                    };

                    // ARGS.state
                    Object.defineProperty(ARGS, 'state', {
                        enumerable: true,

                        get: () => {
                            return WORKSPACE.sessionState['target_operations']['http']['body_scripts'][<string>bodyScriptFullPath];
                        },

                        set: (newValue) => {
                            WORKSPACE.sessionState['target_operations']['http']['body_scripts'][<string>bodyScriptFullPath] = newValue;
                        }
                    });

                    return await Promise.resolve(
                        GET_BODY.apply(BODY_MODULE, [ ARGS ])
                    );
                };
            }
            else {
                throw new Error(i18.t('targets.operations.http.noBodyScriptFunction',
                                      bodyScriptFullPath));
            }
        }
        else {
            throw new Error(i18.t('targets.operations.http.noBodyScriptModule',
                                  bodyScriptFullPath));
        }
    }
    else {
        body = OPERATION.body;
    }
    
    const BODY_TO_SEND =
        await deploy_helpers.asBuffer( 
            await Promise.resolve(
                getBodyToSend()
            )
        );

    await deploy_http.request(URL, {
        headers: HEADERS,
        method: method,
        raiseOnClientError: true,
        raiseOnServerError: true,
        raiseOnUnsupportedResponse: true,
        setup: BODY_TO_SEND,
    });
}
