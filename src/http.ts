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
import * as HTTP from 'http';
import * as HTTPs from 'https';
const MergeDeep = require('merge-deep');
import * as URL from 'url';


/**
 * Extended request options.
 */
export interface RequestOptions extends HTTP.RequestOptions {
    /**
     * The maximum number of redirections.
     */
    maximumRedirections?: number;
    /**
     * Do not redirect automatically.
     */
    noRedirect?: boolean;
    /**
     * Raise error on 4xx status code or not.
     */
    raiseOnClientError?: boolean;
    /**
     * Raise error on 5xx status code or not.
     */
    raiseOnServerError?: boolean;
    /**
     * Raise error on status code that is greater than 599 or less than 200. Default: (true)
     */
    raiseOnUnsupportedResponse?: boolean;
    /**
     * Function or data for setting up the request.
     */
    setup?: any;
}


/**
 * Stores the address of the default host.
 */
export const DEFAULT_HOST = '127.0.0.1';


/**
 * Reads the content of a HTTP request body.
 * 
 * @param {HTTP.IncomingMessage} msg The HTTP message with the body.
 * 
 * @returns {Promise<Buffer>} The promise with the content.
 */
export async function readBody(msg: HTTP.IncomingMessage) {
    return await deploy_helpers.readAll(msg);
}

/**
 * Starts a HTTP request.
 * 
 * @param {string|URL.Url} url The URL.
 * @param {RequestOptions} opts Additional options for the request.
 * 
 * @return {Promise<HTTP.IncomingMessage>} The promise with the response.
 */
export async function request(url?: string | URL.Url, opts?: RequestOptions) {
    return await requestInner(url,
                              deploy_helpers.cloneObject(opts) || {},
                              0);
}

function requestInner(url: string | URL.Url, opts: RequestOptions,
                      redirections: number): Promise<HTTP.IncomingMessage> {
    let maxRedirections = parseInt(deploy_helpers.toStringSafe(opts.maximumRedirections).trim());
    if (isNaN(maxRedirections)) {
        maxRedirections = 4;
    }
    maxRedirections = Math.max(0, maxRedirections);

    return new Promise<HTTP.IncomingMessage>(async (resolve, reject) => {
        const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

        if (redirections > maxRedirections) {
            //TODO: translate
            COMPLETED(new Error(`Maximum number of redirectrions (${redirections}) reached!`));
            return;
        }

        try {
            // keep sure to have an URL.Url object
            if (!deploy_helpers.isObject<URL.Url>(url)) {
                url = deploy_helpers.toStringSafe(url);
                if (deploy_helpers.isEmptyString(url)) {
                    url = `http://${DEFAULT_HOST}/`;
                }

                url = URL.parse(url);
            }

            const PROTOCOL = deploy_helpers.normalizeString(url.protocol);

            const DEFAULT_OPTS: HTTP.RequestOptions = {
                headers: {},
                hostname: url.hostname,
                method: 'GET',
                path: url.path,
                protocol: PROTOCOL,
            };

            if (!deploy_helpers.isEmptyString(url.auth)) {
                const AUTH = new Buffer(url.auth, 'ascii');

                DEFAULT_OPTS.headers['Authorization'] = `Basic ${AUTH.toString('base64')}`;
            }

            let factory: (options: HTTP.RequestOptions,
                          callback?: (res: HTTP.IncomingMessage) => void) => HTTP.ClientRequest;

            let port = parseInt(deploy_helpers.toStringSafe(url.port).trim());
            if (PROTOCOL === 'https:') {
                factory = HTTPs.request;

                if (isNaN(port)) {
                    port = 443;
                }
            }
            else if (PROTOCOL === 'http:') {
                factory = HTTP.request;

                if (isNaN(port)) {
                    port = 80;
                }
            }

            DEFAULT_OPTS.port = port;

            if (deploy_helpers.isEmptyString(DEFAULT_OPTS.hostname)) {
                DEFAULT_OPTS.hostname = '127.0.0.1';
            }

            const FINAL_REQUEST_OPTS: RequestOptions = MergeDeep(DEFAULT_OPTS, opts);

            if (factory) {
                const REQUEST = factory(FINAL_REQUEST_OPTS, (resp) => {
                    try {
                        switch (resp.statusCode) {
                            case 300:
                            case 301:
                            case 302:
                            case 303:
                            case 305:
                            case 307:
                            case 308:
                                // redirect?
                                if (deploy_helpers.toBooleanSafe(FINAL_REQUEST_OPTS.noRedirect)) {
                                    COMPLETED(null, resp);  // no
                                }
                                else {
                                    let newLocation: string;
                                    if (resp.headers) {
                                        if (!deploy_helpers.isEmptyString(resp.headers['location'])) {
                                            newLocation = deploy_helpers.toStringSafe(resp.headers['location']);
                                        }
                                    }
                
                                    if (deploy_helpers.isEmptyString(newLocation)) {
                                        //TODO: translate
                                        COMPLETED(new Error(`No location defined to redirect to!`));
                                    }
                                    else {
                                        let nextOpts: HTTP.RequestOptions;

                                        if (303 === resp.statusCode) {
                                            // force GET
                                            nextOpts = {
                                                method: 'GET',
                                            };
                                        }

                                        requestInner(URL.parse(newLocation), MergeDeep(FINAL_REQUEST_OPTS, nextOpts || {}),
                                                    redirections + 1).then((resp2) => {
                                            COMPLETED(null, resp2);
                                        }).catch((err) => {
                                            COMPLETED(err);
                                        });
                                    }
                                }
                                break;

                            default:
                                {
                                    let error: any;

                                    if (deploy_helpers.toBooleanSafe(FINAL_REQUEST_OPTS.raiseOnClientError)) {
                                        if (resp.statusCode >= 400 && resp.statusCode < 500) {
                                            //TODO: translate
                                            error = new Error(`CLIENT error '${resp.statusCode}': ${resp.statusMessage}`);
                                        }
                                    }

                                    if (deploy_helpers.toBooleanSafe(FINAL_REQUEST_OPTS.raiseOnServerError)) {
                                        if (resp.statusCode >= 500 && resp.statusCode < 600) {
                                            //TODO: translate
                                            error = new Error(`SERVER error '${resp.statusCode}': ${resp.statusMessage}`);
                                        }
                                    }

                                    if (deploy_helpers.toBooleanSafe(FINAL_REQUEST_OPTS.raiseOnUnsupportedResponse, true)) {
                                        if (resp.statusCode < 200 || resp.statusCode >= 600) {
                                            //TODO: translate
                                            error = new Error(`UNSUPPROTED response '${resp.statusCode}': ${resp.statusMessage}`);
                                        }
                                    }

                                    COMPLETED(null, resp);
                                }
                                break;
                        }
                    }
                    catch (e) {
                        COMPLETED(e);
                    }
                });

                REQUEST.once('error', (err) => {
                    if (err) {
                        COMPLETED(err);
                    }
                });

                let setupAction: () => Promise<void>;

                let requestSetup = opts.setup;
                if (!deploy_helpers.isNullOrUndefined(requestSetup)) {
                    if (deploy_helpers.isFunc(requestSetup)) {
                        // setup request object

                        setupAction = async () => {
                            await Promise.resolve(
                                requestSetup(REQUEST, FINAL_REQUEST_OPTS),
                            );
                        };
                    }
                    else {
                        // write data for response

                        setupAction = async () => {
                            REQUEST.write(
                                await deploy_helpers.asBuffer(requestSetup),
                            );
                        };
                    }
                }

                if (setupAction) {
                    await setupAction();
                }

                REQUEST.end();
            }
            else {
                COMPLETED(new Error(`Protocol '${PROTOCOL}' is NOT supported!`));
            }
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}
