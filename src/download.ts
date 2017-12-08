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
import * as URL from 'url';


type Downloader = (url: URL.Url) => Buffer | PromiseLike<Buffer>


/**
 * Downloads something from a source.
 * 
 * @param {string|URL.Url} url The URL.
 * 
 * @return {Promise<Buffer>} The promise with the downloaded data.
 */
export async function download(url: string | URL.Url): Promise<Buffer> {
    if (!deploy_helpers.isObject<URL.Url>(url)) {
        let urlString = deploy_helpers.toStringSafe(url);
        if (deploy_helpers.isEmptyString(urlString)) {
            urlString = 'http://localhost';
        }

        url = URL.parse(urlString);
    }

    let downloader: Downloader;

    const PROTOCOL = deploy_helpers.normalizeString(url.protocol);

    switch (PROTOCOL) {
        case 'http:':
        case 'https:':
            downloader = download_http;
            break;
    }

    if (!downloader) {
        throw new Error(`Download protocol '${PROTOCOL}' is not supported!`);
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

    if (RESPONSE.statusCode >= 400 && RESPONSE.statusCode < 499) {
        //TODO: translate
        throw new Error(`HTTP CLIENT error '${RESPONSE.statusCode}': '${RESPONSE.statusMessage}'`);
    }
    else if (RESPONSE.statusCode >= 500 && RESPONSE.statusCode < 599) {
        //TODO: translate
        throw new Error(`HTTP SERVER error '${RESPONSE.statusCode}': '${RESPONSE.statusMessage}'`);
    }

    //TODO: translate
    throw new Error(`UNHANDLED HTTP response '${RESPONSE.statusCode}': '${RESPONSE.statusMessage}'`);
}
