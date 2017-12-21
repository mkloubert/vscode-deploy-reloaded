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
import * as deploy_http from './http';
import * as HTTP from 'http';
import * as i18 from './i18';
import * as Path from 'path';
import * as URL from 'url';


type Downloader = (url: URL.Url) => Buffer | PromiseLike<Buffer>


/**
 * Downloads something from a source.
 * 
 * @param {string|URL.Url} url The URL.
 * @param {string|string[]} [scopes] One or more custom scope directories.
 * 
 * @return {Promise<Buffer>} The promise with the downloaded data.
 */
export async function download(url: string | URL.Url, scopes?: string | string[]): Promise<Buffer> {
    if (!deploy_helpers.isObject<URL.Url>(url)) {
        let urlString = deploy_helpers.toStringSafe(url);
        if (deploy_helpers.isEmptyString(urlString)) {
            urlString = 'http://localhost';
        }

        url = URL.parse(urlString);
    }

    scopes = deploy_helpers.asArray(scopes).map(s => {
        return deploy_helpers.toStringSafe(s);
    }).filter(s => {
        return !deploy_helpers.isEmptyString(s);
    }).map(s => {
        if (!Path.isAbsolute(s)) {
            s = Path.join(process.cwd(), s);
        }

        return Path.resolve(s);
    });

    if (scopes.length < 1) {
        scopes.push( process.cwd() );
    }

    let downloader: Downloader;

    const PROTOCOL = deploy_helpers.normalizeString(url.protocol);

    switch (PROTOCOL) {
        case 'http:':
        case 'https:':
            downloader = download_http;
            break;

        default:
            // handle as local file
            downloader = async () => {
                const LOCAL_URL = <URL.Url>url;

                let file: string | false = LOCAL_URL.href;
                if (!Path.isAbsolute(file)) {
                    file = false;

                    for (const S of scopes) {
                        const PATH_TO_CHECK = Path.join(S, LOCAL_URL.href);
                        if (await deploy_helpers.exists(PATH_TO_CHECK)) {
                            if ((await deploy_helpers.lstat(PATH_TO_CHECK)).isFile()) {
                                file = PATH_TO_CHECK;
                                break;
                            }
                        }
                    }
                }

                if (false === file) {
                    throw new Error(`Local file '${LOCAL_URL.href}' not found!`);
                }

                return await deploy_helpers.readFile(
                    Path.resolve(file)
                );
            };
            break;
    }

    return await Promise.resolve(
        downloader(url)
    );
}


async function download_http(url: URL.Url): Promise<Buffer> {
    const RESPONSE = await deploy_http.request(url);
    
    if (RESPONSE.statusCode >= 200 && RESPONSE.statusCode < 299) {
        return await deploy_http.readBody(RESPONSE);
    }

    let errorKey = 'http.errors.unknown';
    if (RESPONSE.statusCode >= 400 && RESPONSE.statusCode < 499) {
        errorKey = 'http.errors.client';
    }
    else if (RESPONSE.statusCode >= 500 && RESPONSE.statusCode < 599) {
        errorKey = 'http.errors.server';
    }

    throw new Error(i18.t(errorKey,
                          RESPONSE.statusCode, RESPONSE.statusMessage));
}
