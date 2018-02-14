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

import * as deploy_clients_dropbox from './clients/dropbox';
import * as deploy_clients_ftp from './clients/ftp';
import * as deploy_clients_sftp from './clients/sftp';
import * as deploy_clients_slack from './clients/slack';
import * as deploy_helpers from './helpers';
import * as deploy_http from './http';
import * as i18 from './i18';
import * as Path from 'path';
import * as URL from 'url';


type DownloadClientConfigMappings = { [ configProperty: string ]: DownloadClientConfigTargetType };

type DownloadClientConfigTargetType = undefined | null |
                                      'bool' |
                                      'int' |
                                      'string_array';

type Downloader = (url: URL.Url) => Buffer | PromiseLike<Buffer>;

/**
 * Additional result data for 'download()' function.
 */
export interface DownloadOutValue {
    /**
     * The full path of the download source.
     */
    fullPath?: string;
    /**
     * The source.
     */
    source?: DownloadSourceType;
    /**
     * The URL.
     */
    url?: URL.Url;
}

/**
 * List of download source types.
 */
export enum DownloadSourceType {
    /**
     * Local file.
     */
    Local = 0,
    /**
     * DropBox
     */
    DropBox = 1,
    /**
     * FTP
     */
    FTP = 2,
    /**
     * HTTP
     */
    HTTP = 3,
    /**
     * SFTP
     */
    SFTP = 4,
    /**
     * Slack channel
     */
    Slack = 5,
}


function createDownloadConfig(url: URL.Url, mappings: DownloadClientConfigMappings): any {
    if (!mappings) {
        mappings = {};
    }

    const CONFIG: any = {};

    const PARAMS = deploy_helpers.uriParamsToObject(url);
    for (const P in PARAMS) {
        for (let prop in mappings) {
            if (P !== deploy_helpers.normalizeString(prop)) {
                continue;
            }

            let val: any = PARAMS[P];

            const TARGET_TYPE = mappings[prop];
            if (!deploy_helpers.isNullOrUndefined(TARGET_TYPE)) {
                switch (TARGET_TYPE) {
                    case 'bool':
                        if (deploy_helpers.isEmptyString(val)) {
                            val = undefined;
                        }
                        else {
                            switch ( deploy_helpers.normalizeString(val) ) {
                                case '1':
                                case 'true':
                                case 'y':
                                case 'yes':
                                    val = true;
                                    break;

                                default:
                                    val = false;
                                    break;
                            }
                        }
                        break;

                    case 'int':
                        if (deploy_helpers.isEmptyString(val)) {
                            val = undefined;
                        }
                        else {
                            val = parseInt( val.trim() );
                        }
                        break;

                    case 'string_array':
                        if (deploy_helpers.isEmptyString(val)) {
                            val = undefined;
                        }
                        else {
                            val = val.split(',');
                        }
                        break;
                }
            }

            CONFIG[prop] = val;
        }
    }

    return CONFIG;
}

/**
 * Downloads something from a source.
 * 
 * @param {string|URL.Url} url The URL.
 * @param {string|string[]} [scopes] One or more custom scope directories.
 * @param {DownloadOutValue} [outVal] Additional result data.
 * 
 * @return {Promise<Buffer>} The promise with the downloaded data.
 */
export async function download(url: string | URL.Url, scopes?: string | string[], outVal?: DownloadOutValue): Promise<Buffer> {
    if (!outVal) {
        outVal = <any>{};
    }
    
    if (!deploy_helpers.isObject<URL.Url>(url)) {
        let urlString = deploy_helpers.toStringSafe(url);
        if (deploy_helpers.isEmptyString(urlString)) {
            urlString = 'http://localhost';
        }

        url = URL.parse(urlString);
    }
    outVal.url = url;
    outVal.fullPath = url.href;

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
        case 'dropbox:':
            downloader = download_dropbox;
            outVal.source = DownloadSourceType.DropBox;
            break;
        
        case 'ftp:':
            downloader = download_ftp;
            outVal.source = DownloadSourceType.FTP;
            break;
            
        case 'http:':
        case 'https:':
            downloader = download_http;
            outVal.source = DownloadSourceType.HTTP;
            break;

        case 'sftp:':
            downloader = download_sftp;
            outVal.source = DownloadSourceType.SFTP;
            break;

        case 'slack:':
            downloader = download_slack;
            outVal.source = DownloadSourceType.Slack;
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

                file = Path.resolve(file);

                outVal.fullPath = file;
                return await deploy_helpers.readFile(
                    file
                );
            };
            outVal.source = DownloadSourceType.Local;
            break;
    }

    return await Promise.resolve(
        downloader(url)
    );
}


async function download_dropbox(url: URL.Url): Promise<Buffer> {
    const CFG: deploy_clients_dropbox.DropboxOptions = createDownloadConfig(url, {
        accessToken: null,
    });

    const CLIENT = deploy_clients_dropbox.createClient(CFG);
    try {
        return await CLIENT.downloadFile(
            url.pathname,
        );
    }
    finally {
        deploy_helpers.tryDispose(CLIENT);
    }
}

async function download_ftp(url: URL.Url): Promise<Buffer> {
    const AUTH = getUserNameAndPassword(url);
    const SERVER = getHostAndPort(url);

    const CFG: deploy_clients_ftp.FTPConnectionOptions = createDownloadConfig(url, {
        engine: null,
    });

    (<any>CFG).host = SERVER.host;
    (<any>CFG).port = SERVER.port;
    (<any>CFG).password = AUTH.password;
    (<any>CFG).user = AUTH.user;

    const CLIENT = await deploy_clients_ftp.openConnection(CFG);
    try {
        return await CLIENT.downloadFile(
            url.pathname,
        );
    }
    finally {
        deploy_helpers.tryDispose(CLIENT);
    }
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

async function download_sftp(url: URL.Url): Promise<Buffer> {
    const AUTH = getUserNameAndPassword(url);
    const SERVER = getHostAndPort(url);

    const CFG: deploy_clients_sftp.SFTPConnectionOptions = createDownloadConfig(url, {
        agent: null,
        agentForward: 'bool',
        debug: 'bool',
        hashAlgorithm: null,
        hashes: 'string_array',
        privateKey: null,
        privateKeyPassphrase: null,
        readyTimeout: 'int',
        tryKeyboard: 'bool',
    });

    (<any>CFG).host = SERVER.host;
    (<any>CFG).port = SERVER.port;
    (<any>CFG).password = AUTH.password;
    (<any>CFG).user = AUTH.user;

    const CLIENT = await deploy_clients_sftp.openConnection(CFG);
    try {
        return await CLIENT.downloadFile(
            url.pathname,
        );
    }
    finally {
        deploy_helpers.tryDispose(CLIENT);
    }
}

async function download_slack(url: URL.Url): Promise<Buffer> {
    const CHANNEL = deploy_helpers.toStringSafe(url.hostname).toUpperCase().trim();

    const CFG: deploy_clients_slack.SlackOptions = createDownloadConfig(url, {
        token: null,
    });

    const CLIENT = deploy_clients_slack.createClient(CFG);
    try {
        return await CLIENT.downloadFile(
            CHANNEL + url.pathname,
        );
    }
    finally {
        deploy_helpers.tryDispose(CLIENT);
    }
}

function getHostAndPort(url: URL.Url) {
    let host = deploy_helpers.toStringSafe(url.hostname);
    let port = parseInt(
        deploy_helpers.toStringSafe(url.port).trim()
    );

    if (deploy_helpers.isEmptyString(host)) {
        host = undefined;
    }

    if (isNaN(port)) {
        port = undefined;
    }

    return {
        host: host,
        port: port,
    };
}

function getUserNameAndPassword(url: URL.Url) {
    let user: string;
    let password: string;

    const AUTH = deploy_helpers.toStringSafe(url.auth);
    if (!deploy_helpers.isEmptyString(AUTH)) {
        const SEP = AUTH.indexOf(':');
        if (SEP > -1) {
            user = AUTH.substr(0, SEP);
            password = AUTH.substr(SEP + 1);
        }
        else {
            user = AUTH;
        }
    }

    if (deploy_helpers.isEmptyString(user)) {
        user = undefined;
    }

    password = deploy_helpers.toStringSafe(password);
    if ('' === password) {
        password = undefined;
    }

    return {
        password: password,
        user: user,
    };
}
