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

const Slack = require('@slack/client');
import * as deploy_clients from '../clients';
import * as deploy_download from '../download';
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as deploy_http from '../http';
import * as Enumerable from 'node-enumerable';
import * as FS from 'fs';
import * as Moment from 'moment';
import * as Path from 'path';
import * as Stream from 'stream';


/**
 * File information about a slack file.
 */
export interface FileInfo extends deploy_files.FileInfo {
    /**
     * The private download URL.
     */
    readonly url_private_download: string;
}

type GroupedFiles = { [ name: string ]: any[] };

/**
 * Options for accessing a Slack workspace.
 */
export interface SlackOptions {
    /**
     * The API token to use.
     */
    readonly token: string;
}


/**
 * A Slack client.
 */
export class SlackClient extends deploy_clients.AsyncFileListBase {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {SlackOptions} options The options.
     */
    constructor(public readonly options: SlackOptions) {
        super();
    }

    private createFileInfo(obj: any, path: string): FileInfo {
        if (!obj) {
            return obj;
        }

        const ME = this;

        const FI: FileInfo = {
            download: async function() {
                const RESPONSE = await deploy_http.request(this.url_private_download, {
                    headers: {
                        'Authorization': `Bearer ${deploy_helpers.toStringSafe(ME.options.token).trim()}`,
                    }
                });

                if (200 != RESPONSE.statusCode) {
                    throw new Error(`Unexpected response ${RESPONSE.statusCode}: '${RESPONSE.statusMessage}'`);
                }

                return await deploy_http.readBody(RESPONSE);
            },
            internal_name: obj.id,
            name: obj.name,
            path: path,
            type: deploy_files.FileSystemType.File,
            url_private_download: obj.url_private_download,
        };

        if (!isNaN(obj.timestamp)) {
            (<any>FI).time = Moment.utc( obj.timestamp * 1000 );
        }

        return FI;
    }

    private createInstance() {
        return new Slack.WebClient(
            deploy_helpers.toStringSafe(this.options.token).trim()
        );
    }

    /** @inheritdoc */
    public deleteFile(path: string): Promise<boolean> {
        const ME = this;

        path = toSlackPath(path);
        
        return new Promise<boolean>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                try {
                    const ALL_MATCHING_FILES = await ME.findFiles(path);
                    const FILE_TO_DELETE = ALL_MATCHING_FILES[0];

                    let url = 'https://slack.com/api/files.delete';
                    url += '?token=' + encodeURIComponent(
                        deploy_helpers.toStringSafe(ME.options.token).trim()
                    );
                    url += '&file=' + encodeURIComponent(
                        FILE_TO_DELETE.internal_name
                    );

                    const RESPONSE = await deploy_http.request(url);
                    if (200 == RESPONSE.statusCode) {
                        COMPLETED(null, true);
                    }
                    else {
                        COMPLETED(null, false);
                    }
                }
                catch (e) {
                    COMPLETED(null, false);
                }
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /** @inheritdoc */
    public downloadFile(path: string): Promise<Buffer> {
        const ME = this;

        path = toSlackPath(path);
        
        return new Promise<Buffer>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const ALL_MATCHING_FILES = await ME.findFiles(path);
                const FILE_TO_DOWNLOAD = ALL_MATCHING_FILES[0];

                COMPLETED(null,
                          await FILE_TO_DOWNLOAD.download());
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    private async findFiles(path: string): Promise<FileInfo[]> {
        path = toSlackPath(path);

        const PATH_PARTS = path.split('/');

        const CHANNEL = PATH_PARTS[0];
        const FILE_ID = Enumerable.from(PATH_PARTS).skip(1)
                                                    .joinToString('/');

        const ALL_MATCHING_FILES: FileInfo[] = [];

        const GROUPED_FILES = await this.listDirectoryInner(CHANNEL);
        for (const KEY in GROUPED_FILES) {
            const FILES = GROUPED_FILES[KEY];

            for (const GF of FILES) {
                let add = false;
                if (deploy_helpers.normalizeString(GF.id) === deploy_helpers.normalizeString(FILE_ID)) {
                    add = true;
                }
                else if (deploy_helpers.normalizeString(GF.name) === deploy_helpers.normalizeString(FILE_ID)) {
                    add = true;
                }

                if (add) {
                    ALL_MATCHING_FILES.push(
                        this.createFileInfo(
                            GF,
                            CHANNEL
                        )
                    );
                }
            }
        }

        return Enumerable.from(ALL_MATCHING_FILES).orderByDescending(f => {
            if (f.time) {
                return f.time.unix();
            }

            return null;
        }).toArray();
    }

    private getChannelItems(): Promise<deploy_files.FileSystemInfo[]> {
        const ME = this;

        return new Promise<deploy_files.FileSystemInfo[]>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const CLIENT = ME.createInstance();

                CLIENT.channels.list(function(err, info) {
                    if (err) {
                        COMPLETED(err);
                        return;
                    }

                    try {
                        const ITEMS: deploy_files.FileSystemInfo[] = [];

                        if (info) {
                            if (info.channels) {
                                for (const CHANNEL of info.channels) {
                                    if (!CHANNEL) {
                                        continue;
                                    }

                                    const DI: deploy_files.DirectoryInfo = {
                                        icon: 'book',
                                        internal_name: CHANNEL.id,
                                        name: CHANNEL.name,
                                        path: '',
                                        type: deploy_files.FileSystemType.Directory,
                                    };

                                    if (!isNaN(CHANNEL.created)) {
                                        (<any>DI).time = Moment.utc(CHANNEL.created * 1000);
                                    }

                                    ITEMS.push(DI);
                                }
                            }
                        }

                        COMPLETED(null, ITEMS);
                    }
                    catch (e) {
                        COMPLETED(e);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /** @inheritdoc */
    public async listDirectory(path: string) {
        const ME = this;

        path = toSlackPath(path);

        let items: deploy_files.FileSystemInfo[];

        if (deploy_helpers.isEmptyString(path)) {
            items = await ME.getChannelItems();
        }
        else {
            items = [];

            const GROUPED_FILES = await ME.listDirectoryInner(path);

            for (const KEY in GROUPED_FILES) {
                const FILES = GROUPED_FILES[KEY];

                Enumerable.from(FILES).select(f => {
                    return ME.createFileInfo(f, path);
                }).pushTo(items);
            }
        }

        return items;
    }

    private listDirectoryInner(path: string): Promise<GroupedFiles> {
        const ME = this;

        path = toSlackPath(path);

        const CHANNEL = path.split('/')[0].toUpperCase().trim();

        let file: string | false = Enumerable.from(
            path.split('/')
        ).skip(1)
         .select(x => deploy_helpers.normalizeString(x))
         .joinToString('/');
        if (deploy_helpers.isEmptyString(file)) {
            file = false;
        }

        return new Promise<GroupedFiles>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const CLIENT = ME.createInstance();

                const ALL_FILES: any[] = [];
                const DONE = () => {
                    try {
                        const GROUPED_FILES: GroupedFiles = {};
                        for (const FILE of ALL_FILES) {
                            const KEY = deploy_helpers.normalizeString(FILE.name);
                            
                            if (!GROUPED_FILES[KEY]) {
                                GROUPED_FILES[KEY] = [];
                            }

                            GROUPED_FILES[KEY].push(FILE);
                        }

                        COMPLETED(null, GROUPED_FILES);
                    }
                    catch (e) {
                        COMPLETED(e);
                    }
                };

                let currentPage = 0;

                let nextSegment: () => void;
                nextSegment = () => {
                    try {
                        ++currentPage;

                        CLIENT.files.list({
                            channel: CHANNEL,
                            page: currentPage,
                        }, function(err, info) {
                            if (err) {
                                COMPLETED(err);
                                return;
                            }

                            try {
                                if (info.files) {
                                    for (const FILE of info.files) {
                                        if (FILE) {
                                            ALL_FILES.push(FILE);
                                        }
                                    }
                                }

                                let isDone = true;
                                if (info.paging) {
                                    isDone = currentPage >= info.paging.pages;
                                }

                                if (isDone) {
                                    DONE();
                                }
                                else {
                                    nextSegment();
                                }
                            }
                            catch (e) {
                                COMPLETED(e);
                            }
                        });
                    }
                    catch (e) {
                        COMPLETED(e);
                    }
                };

                nextSegment();
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /** @inheritdoc */
    public get type(): string {
        return 'slack';
    }

    /** @inheritdoc */
    public uploadFile(path: string, data: Buffer): Promise<void> {
        const ME = this;

        path = toSlackPath(path);

        if (!data) {
            data = Buffer.alloc(0);
        }
        
        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                await deploy_helpers.invokeForTempFile(async (tempFile) => {
                    return new Promise<void>((res, rej) => {
                        const COMP = deploy_helpers.createCompletedAction(res, rej);

                        try {
                            const CLIENT = ME.createInstance();

                            const CHANNEL = path.split('/')[0];
                            const FILENAME = Path.basename(path);

                            const UPLOAD_OPTS = {
                                file: FS.createReadStream(tempFile),
                                filetype: 'auto',
                                channels: CHANNEL,
                                title: FILENAME,
                            };
                            
                            CLIENT.files.upload(FILENAME, UPLOAD_OPTS, function(err) {
                                COMP(err);
                            });
                        }
                        catch (e) {
                            COMP(e);
                        }
                    });
                }, {
                    data: data
                });

                COMPLETED(null);
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }
}


/**
 * Creates a new client.
 * 
 * @param {SlackOptions} opts The options.
 * 
 * @return {SlackClient} The new client.
 */
export function createClient(opts: SlackOptions): SlackClient {
    if (!opts) {
        opts = <any>{};
    }

    return new SlackClient(opts);
}

/**
 * Normalizes a path.
 * 
 * @param {string} path The path to normalize.
 * 
 * @return {string} The normalized path. 
 */
export function normalizePath(path: string) {
    path = deploy_helpers.toStringSafe(path);
    path = deploy_helpers.replaceAllStrings(path, Path.sep, '/');

    if (deploy_helpers.isEmptyString(path)) {
        path = '';
    }

    while (path.startsWith('/')) {
        path = path.substr(1);
    }
    while (path.endsWith('/')) {
        path = path.substr(0, path.length - 1);
    }

    return path;
}

/**
 * Converts to a Slack path.
 * 
 * @param {string} path The path to convert.
 * 
 * @return {string} The converted path. 
 */
export function toSlackPath(path: string) {
    return normalizePath(path);
}
