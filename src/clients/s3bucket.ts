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
import * as deploy_values from '../values';
import * as Enumerable from 'node-enumerable';
import * as i18 from '../i18';
import * as MimeTypes from 'mime-types';
import * as OS from 'os';
import * as Path from 'path';
import * as Moment from 'moment';


/**
 * A function that detects the ACL for a file when uploading it.
 *
 * @param {string} file The path of the file inside the bucket.
 * @param {string} defaultAcl The default ACL of the bucket.
 *
 * @return {string} The ACL.
 */
export type S3BucketFileAclDetector = (file: string, defaultAcl: string) => string;

/**
 * Options for accessing a S3 bucket.
 */
export interface S3BucketOptions {
    /**
     * The default ACL to set.
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
    };
    /**
     * A custom function that provides scopes directories for relative paths.
     */
    readonly directoryScopeProvider?: S3DirectoryScopeProvider;
    /**
     * A function that detects the ACL for a file
     * when uploading it.
     */
    readonly fileAcl?: S3BucketFileAclDetector;
    /**
     * A function that provides values for a client.
     */
    readonly valueProvider?: S3ValueProvider;
    /**
     * Custom options.
     */
    readonly customOpts?: object;
}

/**
 * A function that provides the scope directories for relative paths.
 */
export type S3DirectoryScopeProvider = () => string | string[] | PromiseLike<string | string[]>;

/**
 * A function that provides values for use in settings for a client.
 */
export type S3ValueProvider = () => deploy_values.Value | deploy_values.Value[] | PromiseLike<deploy_values.Value | deploy_values.Value[]>;

interface SharedIniFileCredentialsOptions {
    profile?: string;
    filename?: string;
    disableAssumeRole?: boolean;
}


/**
 * The default ACL for a file.
 */
export const DEFAULT_ACL = 'public-read';

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

    private async createInstance(): Promise<AWS.S3> {
        const AWS_DIR = Path.resolve(
            Path.join(
                OS.homedir(),
                '.aws'
            )
        );

        let directoryScopeProvider = this.options.directoryScopeProvider;
        if (!directoryScopeProvider) {
            directoryScopeProvider = () => [];
        }

        const DIRECTORY_SCOPES = Enumerable.from(
            deploy_helpers.asArray(
                await Promise.resolve( directoryScopeProvider() )
            )
        ).select(s => {
            return deploy_helpers.toStringSafe(s);
        }).where(s => {
            return !deploy_helpers.isEmptyString(s);
        }).select(s => {
            if (!Path.isAbsolute(s)) {
                s = Path.join(AWS_DIR, s);
            }

            return Path.resolve(s);
        }).toArray();

        if (DIRECTORY_SCOPES.length < 1) {
            DIRECTORY_SCOPES.push( AWS_DIR );  // .aws by default
        }

        let valueProvider = this.options.valueProvider;
        if (!valueProvider) {
            valueProvider = () => [];
        }

        const VALUES = deploy_helpers.asArray(
            await Promise.resolve( valueProvider() )
        );

        const REPLACE_WITH_VALUES = (val: any) => {
            return deploy_values.replaceWithValues(
                VALUES,
                val,
            );
        };

        const FIND_FULL_FILE_PATH = async (p: string): Promise<string> => {
            p = deploy_helpers.toStringSafe(p);

            if (Path.isAbsolute(p)) {
                // exist if file exists

                if (await deploy_helpers.exists(p)) {
                    if ((await deploy_helpers.lstat(p)).isFile()) {
                        return Path.resolve(p);  // file exists
                    }
                }
            }
            else {
                // detect existing, full path
                for (const DS of DIRECTORY_SCOPES) {
                    let fullPath = REPLACE_WITH_VALUES(p);
                    fullPath = Path.join(DS, fullPath);
                    fullPath = Path.resolve(fullPath);

                    if (await deploy_helpers.exists(fullPath)) {
                        if ((await deploy_helpers.lstat(fullPath)).isFile()) {
                            return fullPath;  // file found
                        }
                    }
                }
            }

            throw new Error(i18.t('fileNotFound',
                                  p));
        };

        let bucket = deploy_helpers.toStringSafe(this.options.bucket).trim();
        if ('' === bucket) {
            bucket = 'vscode-deploy-reloaded';
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

            switch (credentialType) {
                case 'environment':
                    // EnvironmentCredentials
                    if (!deploy_helpers.isNullOrUndefined(credentialConfig)) {
                        credentialConfig = REPLACE_WITH_VALUES(credentialConfig).trim();
                    }
                    break;

                case 'file':
                    // FileSystemCredentials
                    if (!deploy_helpers.isNullOrUndefined(credentialConfig)) {
                        credentialConfig = deploy_helpers.toStringSafe(credentialConfig);

                        if (!deploy_helpers.isEmptyString(credentialConfig)) {
                            credentialConfig = await FIND_FULL_FILE_PATH(credentialConfig);
                        }
                    }
                    break;

                case 'shared':
                    // SharedIniFileCredentials
                    {
                        const GET_PROFILE_SAFE = (profile: any): string => {
                            profile = deploy_helpers.toStringSafe(
                                REPLACE_WITH_VALUES(profile)
                            ).trim();
                            if ('' === profile) {
                                profile = undefined;
                            }

                            return profile;
                        };

                        let sharedCfg: string | SharedIniFileCredentialsOptions = deploy_helpers.cloneObject(
                            credentialConfig
                        );
                        if (deploy_helpers.isObject<SharedIniFileCredentialsOptions>(sharedCfg)) {
                            sharedCfg.filename = deploy_helpers.toStringSafe(sharedCfg.filename);
                        }
                        else {
                            sharedCfg = {
                                profile: deploy_helpers.toStringSafe(sharedCfg),
                            };
                        }

                        if (deploy_helpers.isEmptyString(sharedCfg.filename)) {
                            sharedCfg.filename = undefined;
                        }
                        else {
                            sharedCfg.filename = await FIND_FULL_FILE_PATH(sharedCfg.filename);
                        }

                        sharedCfg.profile = GET_PROFILE_SAFE(sharedCfg.profile);

                        credentialConfig = sharedCfg;
                    }
                    break;
            }
        }

        if (!credentialClass) {
            throw new Error(i18.t('s3bucket.credentialTypeNotSupported',
                                  credentialType));
        }

        if (this.options.customOpts) {
            AWS.config.update(this.options.customOpts);
        }

        return new AWS.S3({
            credentials: new credentialClass(credentialConfig),
            params: {
                Bucket: bucket,
                ACL: this.getDefaultAcl(),
            },
        });
    }

    /** @inheritdoc */
    public deleteFile(path: string): Promise<boolean> {
        const ME = this;

        path = toS3Path(path);

        return new Promise<boolean>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const S3 = await ME.createInstance();

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

        return new Promise<Buffer>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const S3 = await ME.createInstance();

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

    private getDefaultAcl() {
        return getAclSafe(this.options.acl);
    }

    /** @inheritdoc */
    public async listDirectory(path: string): Promise<deploy_files.FileSystemInfo[]> {
        const ME = this;

        path = toS3Path(path);

        return new Promise<deploy_files.FileSystemInfo[]>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            const ALL_OBJS: AWS.S3.Object[] = [];
            const ITEMS: deploy_files.FileSystemInfo[] = [];
            const ALL_LOADED = () => {
                const DIRS_ALREADY_ADDED: { [ dir: string ]: deploy_files.DirectoryInfo } = {};
                for (const O of ALL_OBJS) {
                    const KEY = deploy_helpers.toStringSafe(O.Key);
                    const KEY_WITHOUT_PATH = deploy_helpers.normalizePath( KEY.substr(path.length) );

                    if (KEY_WITHOUT_PATH.indexOf('/') > -1) {
                        // directory

                        const DIR = KEY_WITHOUT_PATH.split('/')[0];

                        let existingDir = DIRS_ALREADY_ADDED[DIR];
                        if (!existingDir) {
                            const DI: deploy_files.DirectoryInfo = {
                                //TODO: exportPath: false,
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
                            //TODO: exportPath: false,
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
                const S3 = await ME.createInstance();

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

        return new Promise<void>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const S3 = await ME.createInstance();

                let contentType = MimeTypes.lookup( Path.basename(path) );
                if (false === contentType) {
                    contentType = 'application/octet-stream';
                }

                let acl: string;

                const FILE_ACL = ME.options.fileAcl;
                if (FILE_ACL) {
                    acl = FILE_ACL(path, ME.getDefaultAcl());
                }

                acl = deploy_helpers.normalizeString(acl);
                if ('' === acl) {
                    acl = undefined;
                }

                const PARAMS: AWS.S3.PutObjectRequest = {
                    ACL: acl,
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
 * Returns the name of an ACL safe.
 *
 * @param {string} acl The input value.
 *
 * @return {string} The normalized, safe value.
 */
export function getAclSafe(acl: string) {
    acl = deploy_helpers.normalizeString(acl);
    if ('' === acl) {
        acl = DEFAULT_ACL;
    }

    return acl;
}

/**
 * Converts to a S3 path.
 *
 * @param {string} path The path to convert.
 *
 * @return {string} The converted path.
 */
export function toS3Path(path: string) {
    return deploy_helpers.normalizePath(path);
}
