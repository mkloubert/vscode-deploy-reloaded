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

import * as AWS from 'aws-sdk';
import * as deploy_clients from '../clients';
import * as deploy_files from '../files';
import * as deploy_helpers from '../helpers';
import * as Enumerable from 'node-enumerable';
import * as MimeTypes from 'mime-types';
import * as Path from 'path';
import * as Moment from 'moment';


/**
 * Options for accessing a S3 bucket.
 */
export interface S3BucketOptions {
    /**
     * The custom ACL to set.
     */
    readonly acl?: string;
    /**
     * The name of the bucket.
     */
    readonly bucket: string;
    /**
     * Credential settings.
     */
    readonly credentials?: {
        /**
         * Configuration data for the credential provider.
         */
        readonly config?: any;
        /**
         * The credential provider / type.
         */
        readonly type?: string;
    }
}

const KNOWN_CREDENTIAL_CLASSES = {
    'cognito': AWS.CognitoIdentityCredentials,
    'ec2': AWS.ECSCredentials,
    'ec2meta': AWS.EC2MetadataCredentials,
    'environment': AWS.EnvironmentCredentials,
    'file': AWS.FileSystemCredentials,
    'saml': AWS.SAMLCredentials,
    'shared': AWS.SharedIniFileCredentials,
    'temp': AWS.TemporaryCredentials,
    'web': AWS.WebIdentityCredentials,
};


/**
 * A S3 bucket file client.
 */
export class S3BucketClient extends deploy_clients.AsyncFileListBase {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {S3BucketOptions} options The options.
     */
    constructor(public readonly options: S3BucketOptions) {
        super();
    }

    private createInstance(): AWS.S3 {
        let bucket = deploy_helpers.toStringSafe(this.options.bucket).trim();
        if ('' === bucket) {
            bucket = 'vscode-deploy-reloaded';
        }
    
        let acl = deploy_helpers.normalizeString(this.options.acl);
        if ('' === acl) {
            acl = 'public-read';
        }
    
        let credentialClass: any = AWS.SharedIniFileCredentials;
        let credentialConfig: any;
        let credentialType: string;
        if (this.options.credentials) {
            credentialType = deploy_helpers.normalizeString(this.options.credentials.type);
            if ('' !== credentialType) {
                credentialClass = KNOWN_CREDENTIAL_CLASSES[credentialType];
            }
    
            credentialConfig = this.options.credentials.config;
        }
    
        if (!credentialClass) {
            //TODO: translate
            throw new Error(`Credetial type '${credentialType}' is not supported!`);
        }
    
        return new AWS.S3({
            credentials: new credentialClass(credentialConfig),
            params: {
                Bucket: bucket,
                ACL: acl,
            },
        });
    }

    /** @inheritdoc */
    public deleteFile(path: string): Promise<boolean> {
        const ME = this;

        path = toS3Path(path);

        return new Promise<boolean>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const S3 = ME.createInstance();

                const PARAMS: any = {
                    Key: path,
                };

                S3.deleteObject(PARAMS, (err) => {
                    if (err) {
                        COMPLETED(null, false);
                    }
                    else {
                        COMPLETED(null, true);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /** @inheritdoc */
    public downloadFile(path: string): Promise<Buffer> {
        const ME = this;

        path = toS3Path(path);
        
        return new Promise<Buffer>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const S3 = ME.createInstance();

                const PARAMS: any = {
                    Key: path,
                };

                S3.getObject(PARAMS, (err, data) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        deploy_helpers.asBuffer(data.Body).then((data) => {
                            COMPLETED(null, data);
                        }).catch((err) => {
                            COMPLETED(err);
                        });
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /** @inheritdoc */
    public async listDirectory(path: string): Promise<deploy_files.FileSystemInfo[]> {
        const ME = this;

        path = toS3Path(path);

        return new Promise<deploy_files.FileSystemInfo[]>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            const ALL_OBJS: AWS.S3.Object[] = [];
            const ITEMS: deploy_files.FileSystemInfo[] = [];
            const ALL_LOADED = () => {
                const DIRS_ALREADY_ADDED: { [ dir: string ]: deploy_files.DirectoryInfo } = {};
                for (const O of ALL_OBJS) {
                    const KEY = deploy_helpers.toStringSafe(O.Key);
                    const KEY_WITHOUT_PATH = normalizePath( KEY.substr(path.length) );

                    if (KEY_WITHOUT_PATH.indexOf('/') > -1) {
                        // directory

                        const DIR = KEY_WITHOUT_PATH.split('/')[0];

                        let existingDir = DIRS_ALREADY_ADDED[DIR];
                        if (!existingDir) {
                            const DI: deploy_files.DirectoryInfo = {
                                name: DIR,
                                path: path,
                                type: deploy_files.FileSystemType.Directory,
                            };

                            ITEMS.push(DI);
                            existingDir = DIRS_ALREADY_ADDED[DIR] = DI;
                        }
                    }
                    else {
                        // file

                        const FI: deploy_files.FileInfo = {
                            download: async () => {
                                return await ME.downloadFile(
                                    path + '/' + KEY_WITHOUT_PATH
                                );
                            },
                            name: KEY_WITHOUT_PATH,
                            path: path,
                            size: O.Size,
                            type: deploy_files.FileSystemType.File,
                        };

                        if (!deploy_helpers.isNullOrUndefined(O.LastModified)) {
                            (<any>FI).time = Moment(O.LastModified);
                        }

                        ITEMS.push(FI);
                    }
                }

                COMPLETED(null, ITEMS);
            };

            const HANDLE_RESULT = (result: AWS.S3.ListObjectsV2Output) => {
                if (!result) {
                    return;
                }

                const RESULT_OBJS = result.Contents;
                if (!RESULT_OBJS) {
                    return;
                }

                for (const O of RESULT_OBJS) {
                    if (O) {
                        ALL_OBJS.push(O);
                    }
                }
            };

            try {
                const S3 = ME.createInstance();

                let currentContinuationToken: string | false = false;

                let nextSegment: () => void;
                nextSegment = () => {
                    try {
                        if (false !== currentContinuationToken) {
                            if (deploy_helpers.isEmptyString(currentContinuationToken)) {
                                ALL_LOADED();
                                return;
                            }
                        }
                        else {
                            currentContinuationToken = undefined;
                        }

                        const PARAMS: AWS.S3.Types.ListObjectsV2Request = {
                            Bucket: undefined,
                            ContinuationToken: <any>currentContinuationToken,
                            Prefix: path,
                        };

                        S3.listObjectsV2(PARAMS, (err, result) => {
                            try {
                                if (err) {
                                    COMPLETED(err);
                                }
                                else {
                                    currentContinuationToken = result.NextContinuationToken;

                                    HANDLE_RESULT(result);
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
        return 's3bucket';
    }

    /** @inheritdoc */
    public uploadFile(path: string, data: Buffer): Promise<void> {
        const ME = this;

        path = toS3Path(path);

        if (!data) {
            data = Buffer.alloc(0);
        }
        
        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const S3 = ME.createInstance();

                let contentType = MimeTypes.lookup( Path.basename(path) );
                if (false === contentType) {
                    contentType = 'application/octet-stream';
                }

                const PARAMS: AWS.S3.PutObjectRequest = {
                    Bucket: undefined,
                    ContentType: contentType,
                    Key: path,
                    Body: data,
                };

                S3.putObject(PARAMS, (err) => {
                    COMPLETED(err);
                });
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
 * @param {S3BucketOptions} opts The options.
 * 
 * @return {S3BucketClient} The new client.
 */
export function createClient(opts: S3BucketOptions): S3BucketClient {
    if (!opts) {
        opts = <any>{};
    }

    return new S3BucketClient(opts);
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
 * Converts to a S3 path.
 * 
 * @param {string} path The path to convert.
 * 
 * @return {string} The converted path. 
 */
export function toS3Path(path: string) {
    return normalizePath(path);
}
