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

import * as _ from 'lodash';
import * as deploy_contracts from './contracts';
import * as deploy_helpers from './helpers';
import * as deploy_html from './html';
import * as deploy_values from './values';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as Events from 'events';
import * as Express from 'express';
import * as HTTP from 'http';
import * as HTTPs from 'https';
import * as i18 from './i18';
import * as ip from 'ip';
const MergeDeep = require('merge-deep');
import * as OS from 'os';
import * as Path from 'path';
import * as vscode from 'vscode';


/**
 * A value for an API endpoint.
 */
export type ApiEndpoint = ApiEndpointSettings | string;

/**
 * Settings for an API endpoint.
 */
export interface ApiEndpointSettings {
    /**
     * A list of one or more HTTP methods, which are allowed.
     */
    readonly methods?: string | string[];
    /**
     * Options for the script.
     */
    readonly options?: any;
    /**
     * The script to execute.
     */
    readonly script: string;    
}

/**
 * Arguments for an API endpoint script.
 */
export interface ApiEndpointArguments extends deploy_contracts.ScriptArguments {
    /**
     * The underlying workspace.
     */
    readonly workspace: deploy_workspaces.Workspace;
}

/**
 * An API endpoint module.
 */
export interface ApiEndpointModule {
}

/**
 * Stores the name and description of an API host.
 */
export interface ApiHostNameAndDescription extends deploy_contracts.WithOptionalName {
    /**
     * The description.
     */
    readonly description?: string;
    /**
     * The underlying host.
     */
    readonly host: ApiHost;
}

/**
 * A list of APIs.
 */
export type ApiList = { [port: string]: ApiSettingValue };

/**
 * Settings for an API (host).
 */
export interface ApiSettings extends deploy_contracts.WithOptionalName {
    /**
     * One or more allowed IP addresses in CIDR format.
     */
    readonly allowed?: string | string[];
    /**
     * Auto start host or not.
     */
    readonly autoStart?: boolean;
    /**
     * A description for the host.
     */
    readonly description?: string;
    /**
     * One or more custom endpoints.
     */
    readonly endpoints?: deploy_contracts.KeyValuePairs<ApiEndpoint>;
    /**
     * The custom name of the real for basic authentification.
     */
    readonly realm?: string;
    /**
     * SSL settings.
     */
    readonly ssl?: {
        /**
         * The path to the ca file.
         */
        readonly ca?: string;
        /**
         * The path to the file of the certificate.
         */
        readonly cert?: string;
        /**
         * The path to the key file.
         */
        readonly key?: string;
        /**
         * The required password for the key file.
         */
        readonly passphrase?: string;
        /**
         * Request unauthorized or not.
         */
        readonly rejectUnauthorized?: boolean;
    };
    /**
     * Use build-in endpoints or not.
     */
    readonly useBuildIn?: boolean;
    /**
     * One or more users to define.
     */
    readonly users?: ApiUserList;
}

/**
 * A possible value for API (host= settings.
 */
export type ApiSettingValue = boolean | ApiSettings;

/**
 * An API user.
 */
export interface ApiUser {
}

/**
 * A list of API users.
 */
export type ApiUserList = deploy_contracts.KeyValuePairs<ApiUserListValue>;

/**
 * A possible value for an API user list.
 */
export type ApiUserListValue = ApiUserWithPassword | string;

/**
 * An API user with credentials.
 */
export interface ApiUserWithCredentials extends ApiUserWithPassword {
    /**
     * Gets the username.
     */
    readonly name: string;
}

/**
 * An API user with password.
 */
export interface ApiUserWithPassword extends ApiUser {
    /**
     * Is user active or not.
     */
    readonly isActive?: boolean;
    /**
     * The password for the user.
     */
    readonly password?: string;
}

interface HostInfo {
    os: string;
}

interface MarkdownDocument {
    content: string;
    options?: deploy_html.MarkdownDocumentOptions;
    title?: string;
}

interface MeInfo {
    address: string;    
    port: number;
}

interface PopupMessage {
    message: string;
    type?: string;
}

interface VSCodeInfo {
    eol: string;
    name: string;
    node: {
        v8: string;
        version: string;
    };
    version: string;
}

/**
 * Name of the workspace variable for storing API hosts.
 */
export const WS_VAR_APIS = 'apis';
/**
 * Name of the HTTP header that stores the language of an editor.
 */
export const X_HEADER_EDITOR_LANG = 'X-Vscode-Deploy-Reloaded-Lang';

/**
 * An API host.
 */
export class ApiHost extends deploy_helpers.DisposableBase {
    private readonly _EVENTS: NodeJS.EventEmitter = new Events.EventEmitter();
    private readonly _GLOBAL_STATE: deploy_contracts.KeyValuePairs = {};
    private readonly _SCRIPT_STATES: deploy_contracts.KeyValuePairs = {};
    private _server: HTTP.Server | HTTPs.Server;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {deploy_workspaces.Workspace} workspace The underlying workspace.
     * @param {number} port The TCP port the host should listen on.
     * @param {ApiSettings} settings The settings for that host.
     */
    public constructor(public readonly workspace: deploy_workspaces.Workspace,
                       public readonly port: number,
                       public readonly settings: ApiSettings) {
        super();

        this.port = port;        
        this.settings = settings;

        if (isNaN(this.port)) {
            if (_.isNil(this.settings.ssl)) {
                this.port = 80;
            }
            else {
                this.port = 443;
            }
        }
    }

    /**
     * Gets if the host should be started automatically or not.
     */
    public get autoStart(): boolean {
        return deploy_helpers.toBooleanSafe(
            this.settings.autoStart, true
        );
    }

    private async createInstance(): Promise<Express.Express> {
        const ME = this;

        const APP = Express();

        APP.set('etag', false);

        let realm = deploy_helpers.toStringSafe(
            ME.replaceWithValues( ME.settings.realm )
        ).trim();
        if ('' === realm) {
            realm = 'vscode-deploy-reloaded API';
        }

        const ALLOWED_IPS = 
            Enumerable.from(
                deploy_helpers.asArray(
                    ME.settings.allowed
                ).map(a => a.toLowerCase().trim())
                 .filter(a => '' !== a)
                 .map(a => {
                          if (a.indexOf('/') < 0) {
                              if (ip.isV4Format(a)) {
                                  a += "/32";
                              }
                              else {
                                  a += "/128";
                              }
                          }

                          return a;
                      })
            ).distinct()
             .toArray();

        const USERS: ApiUserWithCredentials[] = [];
        if (ME.settings.users) {
            for (const UN in ME.settings.users) {
                const USER_VALUE = ME.settings.users[ UN ];
                
                let user: ApiUserWithPassword;
                if (deploy_helpers.isObject<ApiUserWithPassword>(USER_VALUE)) {
                    user = USER_VALUE;
                }
                else {
                    user = {
                        password: USER_VALUE,
                    };
                }

                if (!deploy_helpers.toBooleanSafe( user.isActive, true )) {
                    continue;
                }

                USERS.push({
                    isActive: true,
                    name: deploy_helpers.normalizeString(
                        ME.replaceWithValues( UN )
                    ),
                    password: deploy_helpers.toStringSafe( USER_VALUE ),
                });
            }
        }

        // IP check
        APP.use(function (req: Express.Request, resp: Express.Response, next: Function) {
            let canConnect = ALLOWED_IPS.length < 1;
            if (!canConnect) {
                canConnect = ip.isLoopback( req.socket.remoteAddress );
            }
            if (!canConnect) {
                canConnect = Enumerable.from( ALLOWED_IPS )
                                       .any(a => ip.cidrSubnet(a)
                                                   .contains( req.socket.remoteAddress ));
            }

            if (canConnect) {
                next();
                return;
            }

            try {
                req.socket.end();
            }
            catch { }
        });

        // Basic Auth
        APP.use(function (req: Express.Request, resp: Express.Response, next: Function) {
            let isAuthorized = USERS.length < 1;
            if (!isAuthorized) {
                const AUTHORIZATION = deploy_helpers.toStringSafe( req.header('authorization') ).trim();
                if (AUTHORIZATION.toLowerCase().startsWith('basic ')) {
                    try {
                        const USERNAME_AND_PASSWORD = (
                            new Buffer(AUTHORIZATION.substr(6).trim(), 'base64')
                        ).toString('utf8');

                        let username: string;
                        let password: string;
                        
                        const SEP = USERNAME_AND_PASSWORD.indexOf(':');
                        if (SEP > -1) {
                            username = USERNAME_AND_PASSWORD.substr(0, SEP);
                            password = USERNAME_AND_PASSWORD.substr(SEP + 1);
                        }
                        else {
                            username = USERNAME_AND_PASSWORD;
                        }

                        username = deploy_helpers.normalizeString( username );
                        password = deploy_helpers.toStringSafe( password );

                        isAuthorized = Enumerable.from( USERS ).any(u => {
                            return u.name === username &&
                                   u.password === password;
                        });
                    }
                    catch { }
                }
            }

            if (isAuthorized) {
                next();
                return;
            }

            resp.setHeader('WWW-Authenticate', 'Basic realm=' + realm);

            return resp.status(401)
                       .send();
        });

        if (deploy_helpers.toBooleanSafe(this.settings.useBuildIn, true)) {
            await this.setupEndPoints(APP);
        }

        await this.setupCustomEndpoints(APP);

        // error handler
        APP.use(function(err: any, req: Express.Request, resp: Express.Response, next: Function) {
            if (!err) {
                return;
            }

            resp.setHeader('Content-type', 'application/json; charset=utf-8');

            return resp.status(500).send(
                new Buffer(
                    JSON.stringify({
                        success: false,
                        code: -1,
                        host: ME.createHostInfo(),
                        me: ME.createMeInfo(req),
                        message: "UNHANDLED_ERROR",
                        error: toErrorObject(err),
                        vscode: ME.createVSCodeInfo(),
                    }, null, 2),
                    'utf8'
                )
            );
        });          

        return APP;
    }

    private createHostInfo(): HostInfo {
        return {
            os: process.platform,
        };
    }

    private createMeInfo(req: Express.Request): MeInfo {
        return {
            address: req.socket.remoteAddress,
            port: req.socket.remotePort,
        };
    }

    private createVSCodeInfo(): VSCodeInfo {
        return {
            eol: OS.EOL,
            name: vscode.env.appName,
            node: {
                v8: process.versions.v8,
                version: process.versions.node,
            },
            version: vscode.version,
        };
    }

    /**
     * Returns the name and the description of that host.
     * 
     * @return {ApiHostNameAndDescription} The name and description.
     */
    public getNameAndDescription(): ApiHostNameAndDescription {
        let name = deploy_helpers.toStringSafe(
            this.replaceWithValues(
                this.settings.name
            )
        ).trim();
        if ('' === name) {
            if (_.isNil(this.settings.ssl)) {
                name = `http://localhost:${this.port}/api/`;
            }
            else {
                name = `https://localhost:${this.port}/api/`;
            }
        }

        let description = deploy_helpers.toStringSafe(
            this.replaceWithValues(
                this.settings.description
            )
        ).trim();
        if ('' === description) {
            description = undefined;
        }

        return {
            description: description,
            host: this,
            name: name,
        };
    }

    /**
     * Gets if the host is currently running or not.
     */
    public get isRunning(): boolean {
        return !_.isNil(this._server);
    }

    /** @inheritdoc */
    protected onDispose() {
        const OLD_SERVER = this._server;
        if (OLD_SERVER) {
            OLD_SERVER.close();

            this._server = null;
        }

        this._EVENTS.removeAllListeners();
    }

    /**
     * Handles a value as string and replaces placeholders.
     * 
     * @param {any} val The value to parse.
     * 
     * @return {string} The parsed value.
     */
    public replaceWithValues(val: any): string {
        const ME = this;

        const ADDITIONAL_VALUES: deploy_values.Value[] = [
            new deploy_values.FunctionValue(() => {
                return ME.port;
            }, 'apiPort')
        ];

        return ME.workspace
                 .replaceWithValues(val, ADDITIONAL_VALUES);
    }

    private async setupCustomEndpoints(app: Express.Express) {
        const ME = this;        

        const ENDPOINTS = ME.settings.endpoints;
        if (!ENDPOINTS) {
            return;
        }

        const NORMALIZER = (str: string) => str.toUpperCase().trim();        

        _.forIn(ENDPOINTS, (ep, route) => {
            if (_.isNil(ep)) {
                return;
            }

            let endpoint: ApiEndpointSettings;
            if (deploy_helpers.isObject<ApiEndpointSettings>(ep)) {
                endpoint = ep; 
            }
            else {
                endpoint = {
                    script: deploy_helpers.toStringSafe(ep),
                };
            }

            route = deploy_helpers.toStringSafe(route).trim();
            if (!route.startsWith('/')) {
                route = '/' + route;
            }
            route = '/api' + route;

            app.all(route, async function(req, resp) {
                const METHOD = deploy_helpers.normalizeString(req.method, NORMALIZER);
                const ALLOWED_METHODS = deploy_helpers.asArray(endpoint.methods).map(m => {
                    return deploy_helpers.normalizeString(m, NORMALIZER);
                }).filter(m => '' !== m);

                if (ALLOWED_METHODS.length > 0) {
                    if (ALLOWED_METHODS.indexOf(METHOD) < 0) {
                        return resp.status(405)
                                   .send();
                    }
                }

                const SCRIPT_FILE = await ME.workspace.getExistingSettingPath( endpoint.script );
                if (false !== SCRIPT_FILE) {
                    const SCRIPT_MODULE = deploy_helpers.loadModule<ApiEndpointModule>(SCRIPT_FILE);
                    if (SCRIPT_MODULE) {
                        let requestFunc: Function = SCRIPT_MODULE[ METHOD ];
                        if (!_.isFunction(requestFunc)) {
                            requestFunc = SCRIPT_MODULE['request'];
                        }

                        if (_.isFunction(requestFunc)) {
                            const SCRIPT_STATE_KEY = SCRIPT_FILE;
                            const WORKSPACE = ME.workspace;

                            const ARGS: ApiEndpointArguments = {
                                _: require('lodash'),
                                events: ME._EVENTS,
                                extension: WORKSPACE.context.extension,
                                folder: WORKSPACE.folder,
                                globalEvents: deploy_helpers.EVENTS,
                                globals: WORKSPACE.globals,
                                globalState: ME._GLOBAL_STATE,  //TODO
                                homeDir: deploy_helpers.getExtensionDirInHome(),
                                logger: WORKSPACE.createLogger(),
                                options: deploy_helpers.cloneObject(endpoint.options),
                                output: undefined,
                                replaceWithValues: function (val) {
                                    return this.workspace
                                               .replaceWithValues(val);
                                },
                                require: (id) => {
                                    return deploy_helpers.requireFromExtension(id);
                                },
                                sessionState: deploy_helpers.SESSION,
                                settingFolder: undefined,
                                state: undefined,
                                workspace: WORKSPACE,
                                workspaceRoot: undefined,
                            };

                            // ARGS.output
                            Object.defineProperty(ARGS, 'output', {
                                enumerable: true,

                                get: function () {
                                    return this.workspace.output;
                                }
                            });

                            // ARGS.settingFolder
                            Object.defineProperty(ARGS, 'settingFolder', {
                                enumerable: true,

                                get: function () {
                                    return this.workspace.settingFolder;
                                }
                            });

                            // ARGS.state
                            Object.defineProperty(ARGS, 'state', {
                                enumerable: true,

                                get: () => {
                                    return ME._SCRIPT_STATES[ SCRIPT_STATE_KEY ];
                                },

                                set: (newValue) => {
                                    ME._SCRIPT_STATES[ SCRIPT_STATE_KEY ] = newValue;
                                }
                            });

                            // ARGS.workspaceRoot
                            Object.defineProperty(ARGS, 'workspaceRoot', {
                                enumerable: true,

                                get: function () {
                                    return this.workspace.rootPath;
                                }
                            });

                            const FUNC_ARGS = [ ARGS ].concat( deploy_helpers.toArray(arguments) );

                            return Promise.resolve(
                                requestFunc.apply(SCRIPT_MODULE, FUNC_ARGS)
                            );
                        }
                    }
                }

                return resp.status(501)
                           .send();
            });
        });
    }

    private async setupEndPoints(app: Express.Express) {
        const ME = this;

        const KNOWN_LANGUAGES = (await vscode.languages.getLanguages()).map(x => {
            return deploy_helpers.normalizeString(x);
        }).sort();

        // get host info
        app.get('/api', (req, resp) => {
            resp.setHeader('Content-type', 'application/json; charset=utf-8');

            return resp.status(200).send(
                new Buffer(
                    JSON.stringify({
                        success: true,
                        code: 0,
                        host: ME.createHostInfo(),
                        me: ME.createMeInfo(req),
                        message: "OK",
                        vscode: ME.createVSCodeInfo(),
                    }, null, 2),
                    'utf8'
                )
            );
        });

        // [GET]  /api/commands
        app.get('/api/commands', async (req, resp) => {
            resp.setHeader('Content-type', 'application/json; charset=utf-8');

            return resp.status(200).send(
                new Buffer(
                    JSON.stringify({
                        success: true,
                        code: 0,
                        message: "OK",
                        data: (await vscode.commands.getCommands(false)).sort((x, y) => {
                            return deploy_helpers.compareValuesBy(x, y,
                                                                  i => deploy_helpers.normalizeString(i));
                        }),
                    }),
                    'utf8'
                )
            );
        });

        // [POST]  /api/commands/:command
        app.post('/api/commands/:command', async (req, resp) => {
            const CMD = deploy_helpers.toStringSafe( req.params.command ).trim();
            if ('' === CMD) {
                return resp.status(400).send(
                    new Buffer(
                        JSON.stringify({
                            success: false,
                            code: 1,
                            host: ME.createHostInfo(),
                            me: ME.createMeInfo(req),
                            message: "NO_COMMAND",
                            vscode: ME.createVSCodeInfo(),
                        }, null, 2),
                        'utf8'
                    )
                );
            }

            const MATCHING_COMMANDS = (await vscode.commands.getCommands()).filter(c => {
                return c === CMD;
            });

            if (MATCHING_COMMANDS.length < 1) {
                return resp.status(404)
                           .send();
            }

            const BODY = await deploy_helpers.readAll( req );
            const JSON_ARGS = BODY.toString('utf8');

            let args = [];
            try {
                if (!deploy_helpers.isEmptyString(JSON_ARGS)) {
                    args = deploy_helpers.asArray(
                        JSON.parse(JSON_ARGS), false
                    );
                }
            }
            catch (e) {
                return resp.status(400).send(
                    new Buffer(
                        JSON.stringify({
                            success: false,
                            code: 2,
                            host: ME.createHostInfo(),
                            me: ME.createMeInfo(req),
                            message: "INVALID_INPUT",
                            error: toErrorObject(e),
                            vscode: ME.createVSCodeInfo(),
                        }, null, 2),
                        'utf8'
                    )
                );
            }

            const RESULT = await vscode.commands.executeCommand
                                                .apply(null, [ MATCHING_COMMANDS[0] ].concat(args) );
            if (_.isNil(RESULT)) {
                return resp.status(204)
                           .send();
            }

            let jsonResult: any;
            try {
                jsonResult = deploy_helpers.cloneObject( RESULT );
            }
            catch { }

            return resp.status(200).send(
                new Buffer(
                    JSON.stringify({
                        success: false,
                        code: 0,
                        message: "OK",
                        data: jsonResult,
                    }),
                    'utf8'
                )
            );
        });

        // [GET]  /api/editors
        app.get('/api/editors', (req, resp) => {
            const EDITORS = getTextEditors().toArray()
                                            .map((te, i) => textEditorToJsonObject(te, i));

            if (EDITORS.length > 0) {
                resp.setHeader('Content-type', 'application/json; charset=utf-8');

                return resp.status(200).send(
                    new Buffer(
                        JSON.stringify({
                            success: true,
                            code: 0,
                            message: "OK",
                            data: EDITORS,
                        }),
                        'utf8'
                    )
                );
            }

            return resp.status(204);
        });

        // [GET]  /api/editors/:index
        app.get('/api/editors/:index', (req, resp) => {
            const INDEX = parseInt(
                deploy_helpers.toStringSafe( req.params.index ).trim()
            );

            const EDITOR = Enumerable.from(
                getTextEditors().toArray()
                                .map((te, i) => textEditorToJsonObject(te, i))
            ).lastOrDefault(e => e.index === INDEX);

            if (_.isSymbol(EDITOR)) {
                return resp.status(404);
            }

            resp.setHeader('Content-type', 'application/json; charset=utf-8');

            return resp.status(200).send(
                new Buffer(
                    JSON.stringify({
                        success: true,
                        code: 0,
                        message: "OK",
                        data: EDITOR,
                    }),
                    'utf8'
                )
            );
        });

        // [GET]  /api/editors/:index/content
        app.get('/api/editors/:index/content', (req, resp) => {
            const INDEX = parseInt(
                deploy_helpers.toStringSafe( req.params.index ).trim()
            );

            const MATCHING_EDITORS = getTextEditors().toArray()
                                                     .filter((te, i) => i === INDEX);

            if (MATCHING_EDITORS.length < 1) {
                return resp.status(404);
            }

            const EDITOR = Enumerable.from( MATCHING_EDITORS )
                                     .last();

            let content: string;
            let lang: string;
            if (EDITOR.document) {
                content = EDITOR.document.getText();
                lang = EDITOR.document.languageId;
            }
            content = deploy_helpers.toStringSafe(content);

            resp.setHeader('Content-type', 'text/plain; charset=utf-8');

            if (!deploy_helpers.isEmptyString(lang)) {
                resp.setHeader(X_HEADER_EDITOR_LANG, lang.trim());
            }

            if (content.length < 1) {
                return resp.status(204)
                           .send();
            }

            return resp.status(200).send(
                new Buffer(content, 'utf8')
            );
        });

        // [POST]  /api/editors
        app.post('/api/editors', async (req, resp) => {
            let lang = deploy_helpers.normalizeString( req.header(X_HEADER_EDITOR_LANG) );
            if ('' === lang) {
                lang = undefined;
            }
            else {
                if (KNOWN_LANGUAGES.indexOf( lang ) < 0) {
                    lang = undefined;
                }
            }

            const BODY = await deploy_helpers.readAll( req );

            const DOC = await vscode.workspace.openTextDocument({                
                content: BODY.toString('utf8'),
                language: lang,
            });
            const EDITOR = await vscode.window.showTextDocument( DOC );

            const MATCHING_EDITORS = getTextEditors().toArray().map((te, i) => {
                return {
                    editor: te,
                    obj: textEditorToJsonObject(te, i),
                };
            }).filter(x => EDITOR === x.editor)
              .map(x => x.obj);
            if (MATCHING_EDITORS.length > 0) {
                resp.setHeader('Content-type', 'application/json; charset=utf-8');

                return resp.status(200).send(
                    new Buffer(
                        JSON.stringify({
                            success: true,
                            code: 0,
                            message: "OK",
                            data: MATCHING_EDITORS[0],
                        }),
                        'utf8'
                    )
                );
            }

            return resp.status(204)
                       .send();
        });

        // [GET]  /api/extensions
        app.get('/api/extensions', (req, resp) => {
            const EXTENSIONS = getExtensions().toArray()
                                              .map((e, i) => extensionToJsonObject(e, i));

            if (EXTENSIONS.length > 0) {
                resp.setHeader('Content-type', 'application/json; charset=utf-8');

                return resp.status(200).send(
                    new Buffer(
                        JSON.stringify({
                            success: true,
                            code: 0,
                            message: "OK",
                            data: EXTENSIONS,
                        }),
                        'utf8'
                    )
                );
            }

            return resp.status(204)
                       .send();
        });

        // [GET]  /api/languages
        app.get('/api/languages', (req, resp) => {
            if (KNOWN_LANGUAGES.length > 0) {
                resp.setHeader('Content-type', 'application/json; charset=utf-8');

                return resp.status(200).send(
                    new Buffer(
                        JSON.stringify({
                            success: true,
                            code: 0,
                            message: "OK",
                            data: KNOWN_LANGUAGES,
                        }),
                        'utf8'
                    )
                );
            }

            return resp.status(204)
                       .send();
        });

        // [POST]  /api/markdown
        app.post('/api/markdown', async (req, resp) => {
            const CONTENT_TYPE = deploy_helpers.normalizeString(
                req.header('content-type')
            );

            const BODY = await deploy_helpers.readAll( req );

            let doc: MarkdownDocument;
            const FROM_JSON = () => {
                if (BODY.length > 0) {
                    doc = JSON.parse(
                        BODY.toString('utf8')
                    );    
                }
            };
            const FROM_TEXT = () => {
                if (BODY.length > 0) {
                    doc = {
                        content: BODY.toString('utf8')
                    };
                }
            };

            try {
                switch (CONTENT_TYPE) {
                    case 'application/json':
                        FROM_JSON();
                        break;

                    case 'text/markdown':
                    case 'text/plain':
                        FROM_TEXT();
                        break;

                    case '':
                        try {
                            FROM_JSON();
                        }
                        catch {
                            FROM_TEXT();
                        }
                        break;

                    default:
                        return resp.status(406)
                                   .send();
                }
            }
            catch (e) {
                return resp.status(400).send(
                    new Buffer(
                        JSON.stringify({
                            success: false,
                            code: 1,
                            host: ME.createHostInfo(),
                            me: ME.createMeInfo(req),
                            message: "INVALID_INPUT",
                            error: toErrorObject(e),
                            vscode: ME.createVSCodeInfo(),
                        }, null, 2),
                        'utf8'
                    )
                );
            }

            if (!doc || deploy_helpers.isEmptyString(doc.content)) {
                return resp.status(400).send(
                    new Buffer(
                        JSON.stringify({
                            success: false,
                            code: 2,
                            host: ME.createHostInfo(),
                            me: ME.createMeInfo(req),
                            message: "NO_DATA",
                            vscode: ME.createVSCodeInfo(),
                        }, null, 2),
                        'utf8'
                    )
                );
            }

            let title = deploy_helpers.toStringSafe( doc.title ).trim();
            if ('' === title) {
                title = undefined;
            }

            const OPTS: deploy_html.MarkdownDocumentOptions = MergeDeep(doc.options, {
                documentTitle: title,
            }, doc.options);

            await deploy_html.openMarkdownDocument(
                deploy_helpers.toStringSafe( doc.content ),
                OPTS,
            );

            return resp.status(204)
                       .send();
        });

        // [POST]  /api/messages
        app.post('/api/messages', async (req, resp) => {
            const CONTENT_TYPE = deploy_helpers.normalizeString(
                req.header('content-type')
            );

            const BODY = await deploy_helpers.readAll( req );

            let msg: PopupMessage;
            const FROM_JSON = () => {
                if (BODY.length > 0) {
                    msg = JSON.parse(
                        BODY.toString('utf8')
                    );    
                }
            };
            const FROM_TEXT = () => {
                if (BODY.length > 0) {
                    msg = {
                        message: BODY.toString('utf8')
                    };    
                }
            };

            try {
                switch (CONTENT_TYPE) {
                    case 'application/json':
                        FROM_JSON();
                        break;

                    case 'text/plain':
                        FROM_TEXT();
                        break;

                    case '':
                        try {
                            FROM_JSON();
                        }
                        catch {
                            FROM_TEXT();
                        }
                        break;

                    default:
                        return resp.status(406)
                                   .send();
                }
            }
            catch (e) {
                return resp.status(400).send(
                    new Buffer(
                        JSON.stringify({
                            success: false,
                            code: 1,
                            host: ME.createHostInfo(),
                            me: ME.createMeInfo(req),
                            message: "INVALID_INPUT",
                            error: toErrorObject(e),
                            vscode: ME.createVSCodeInfo(),
                        }, null, 2),
                        'utf8'
                    )
                );
            }

            if (!msg) {
                return resp.status(400).send(
                    new Buffer(
                        JSON.stringify({
                            success: false,
                            code: 2,
                            host: ME.createHostInfo(),
                            me: ME.createMeInfo(req),
                            message: "NO_DATA",
                            vscode: ME.createVSCodeInfo(),
                        }, null, 2),
                        'utf8'
                    )
                );
            }

            let showPopup: (message: string) => Thenable<any>;

            switch ( deploy_helpers.normalizeString(msg.type) ) {
                case '':
                case 'i':
                case 'info':
                case 'information':
                    showPopup = vscode.window.showInformationMessage;
                    break;

                case 'e':
                case 'err':
                case 'error':
                    showPopup = vscode.window.showErrorMessage;
                    break;
    
                case 'w':
                case 'warn':
                case 'warning':
                    showPopup = vscode.window.showWarningMessage;
                    break;
            }            

            if (!showPopup) {
                return resp.status(400).send(
                    new Buffer(
                        JSON.stringify({
                            success: false,
                            code: 3,
                            host: ME.createHostInfo(),
                            me: ME.createMeInfo(req),
                            message: "INVALID_TYPE",
                            vscode: ME.createVSCodeInfo(),
                        }, null, 2),
                        'utf8'
                    )
                );
            }

            showPopup( msg.message );

            return resp.status(204)
                       .send();
        });

        // [PUT]  /api/output
        app.put('/api/output', async (req, resp) => {
            const STR = (await deploy_helpers.readAll( req )).toString('utf8');
            if (STR.length > 0) {
                ME.workspace.output
                            .append( STR );
            }

            return resp.status(204)
                       .send();
        });
    }

    /**
     * Starts the host.
     * 
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public start() {
        const ME = this;

        return new Promise<boolean>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            if (ME.isRunning) {
                COMPLETED(null, false);
                return;
            }

            try {
                const APP = await ME.createInstance();

                let serverFactory: () => Promise<HTTP.Server | HTTPs.Server>;

                const SSL = ME.settings.ssl;
                if (_.isNil(SSL)) {
                    serverFactory = async () => {
                        return HTTP.createServer(APP);
                    };
                }
                else {
                    serverFactory = async () => {                        
                        const LOAD_DATA = async (file: string) => {
                            file = ME.replaceWithValues(
                                file,
                            );
                            if (deploy_helpers.isEmptyString(file)) {
                                return;
                            }

                            if (!Path.isAbsolute(file)) {
                                const EXISTNG_FILE = await ME.workspace.getExistingSettingPath(file);
                                if (false === EXISTNG_FILE) {
                                    throw new Error(
                                        ME.workspace
                                          .t('fileNotFound', file)
                                    );
                                }

                                file = EXISTNG_FILE;
                            }
                            file = Path.resolve(file);

                            return deploy_helpers.readFile( file );
                        };

                        let passphrase = deploy_helpers.toStringSafe(SSL.passphrase);
                        if ('' === passphrase) {
                            passphrase = undefined;
                        }

                        return HTTPs.createServer({
                            ca: await LOAD_DATA( SSL.ca ),
                            cert: await LOAD_DATA( SSL.cert ),
                            key: await LOAD_DATA( SSL.key ),
                            passphrase: passphrase,
                            rejectUnauthorized: deploy_helpers.toBooleanSafe(
                                SSL.rejectUnauthorized, true
                            ),                            
                        }, APP);
                    };
                }

                const NEW_SERVER = await serverFactory();

                NEW_SERVER.once('error', (err) => {
                    COMPLETED(err);
                });

                NEW_SERVER.listen(ME.port, () => {
                    ME._server = NEW_SERVER;

                    COMPLETED(null, true);
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /**
     * Stops the host.
     * 
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public stop() {
        const ME = this;

        return new Promise<boolean>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            const OLD_SERVER = ME._server;
            if (!OLD_SERVER) {
                COMPLETED(null, false);
                return;
            }

            try {
                OLD_SERVER.close(() => {
                    ME._server = null;

                    COMPLETED(null, true);
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }
}

/**
 * Disposes all API hosts of the underlying workspace.
 */
export function disposeApiHosts() {
    const WORKSPACE: deploy_workspaces.Workspace = this;

    const API_HOSTS = WORKSPACE.vars[ WS_VAR_APIS ];
    if (!API_HOSTS) {
        return;    
    }

    while (API_HOSTS.length > 0) {
        deploy_helpers.tryDispose(
            API_HOSTS.pop()
        );
    }
}

function extensionToJsonObject(extension: vscode.Extension<any>, index: number) {
    if (!extension) {
        return <any>extension;
    }

    return {
        id: extension.id,
        index: index,
        isActive: extension.isActive,
        path: extension.extensionPath,    
    };
}

function getExtensions() {
    return Enumerable.from(
        vscode.extensions.all
    ).orderBy(e => deploy_helpers.normalizeString(e.id));
}

function getTextEditors() {
    return Enumerable.from( [ vscode.window.activeTextEditor ] ).concat(
        vscode.window.visibleTextEditors
    ).where(te => {
                return !_.isNil(te);
            })
     .where(te => {
                return !te.document || !te.document.isClosed;
            })
     .distinct(true);
}

/**
 * Reloads the API hosts for an underlying workspace.
 */
export async function reloadApiHosts() {
    const WORKSPACE: deploy_workspaces.Workspace = this;

    deploy_helpers.applyFuncFor(
        disposeApiHosts, WORKSPACE
    )();

    const CFG = WORKSPACE.config;
    if (!CFG) {
        return;
    }

    const API_HOSTS = WORKSPACE.vars[ WS_VAR_APIS ];
    if (!API_HOSTS) {
        return;    
    }

    const APIS_FROM_SETTINGS = CFG.apis;
    if (!APIS_FROM_SETTINGS) {
        return;
    }

    for (const P in APIS_FROM_SETTINGS) {
        const PORT = parseInt(
            deploy_helpers.toStringSafe(P).trim()
        );
        const SETTINGS_VALUE = APIS_FROM_SETTINGS[P];

        let settings: ApiSettings;
        if (deploy_helpers.isObject<ApiSettings>(SETTINGS_VALUE)) {
            settings = SETTINGS_VALUE;
        }
        else {
            settings = {
                autoStart: deploy_helpers.toBooleanSafe(SETTINGS_VALUE, true),
            };
        }

        let newHost: ApiHost;
        try {
            newHost = new ApiHost(WORKSPACE,
                                  PORT, settings);

            if (newHost.autoStart) {
                await newHost.start();
            }

            API_HOSTS.push( newHost );
        }
        catch (e) {
            deploy_helpers.tryDispose( newHost );

            await WORKSPACE.showErrorMessage(
                WORKSPACE.t('apis.errors.couldNotRegister',
                            P, e)
            );
        }
    }
}

async function showQuickPickForApiHost(host: ApiHost) {
    const NAME_AND_DESC = host.getNameAndDescription();

    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [];

    if (host.isRunning) {
        QUICK_PICKS.push({
            action: async () => {
                await host.stop();
            },
            label: '$(triangle-right)  ' + host.workspace.t('apis.stopHost'),
            description: "",
            detail: deploy_helpers.toStringSafe(NAME_AND_DESC.name),
        });
    }
    else {
        QUICK_PICKS.push({
            action: async () => {
                await host.start();
            },
            label: '$(primitive-square)  ' + host.workspace.t('apis.startHost'),
            description: "",
            detail: deploy_helpers.toStringSafe(NAME_AND_DESC.name),
        });
    }

    const SELECTED_QUICK_PICK = await vscode.window.showQuickPick(
        QUICK_PICKS,
    );

    if (SELECTED_QUICK_PICK) {
        await Promise.resolve(
            SELECTED_QUICK_PICK.action()
        );
    }
}

/**
 * Shows quick pick for API hosts.
 */
export async function showApiHostQuickPick() {
    const ALL_WORKSPACES = deploy_workspaces.getAllWorkspaces();

    if (ALL_WORKSPACES.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('workspaces.noneFound')
        );

        return;
    }

    const APIS = Enumerable.from( ALL_WORKSPACES ).orderBy(ws => {
        return ws.isActive ? 0 : 1;
    }).thenBy(ws => {
        return deploy_helpers.normalizeString(ws.id);
    }).selectMany(ws => {
        return ws.getApiHosts();
    }).toArray();

    const API_QUICK_PICKS: deploy_contracts.ActionQuickPick[] = APIS.map(h => {
        const NAME_AND_DESC = h.getNameAndDescription();

        return {
            action: async () => {
                await showQuickPickForApiHost( h );
            },
            label: deploy_helpers.toStringSafe(NAME_AND_DESC.name),
            description: deploy_helpers.toStringSafe(NAME_AND_DESC.description),
            detail: h.workspace.rootPath,
        };
    });

    if (API_QUICK_PICKS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('apis.noneFound')
        );

        return;
    }

    const SELECTED_API_QUICK_PICK = await vscode.window.showQuickPick(
        API_QUICK_PICKS,
        {
            placeHolder: i18.t('apis.selectHost'),
        }
    );

    if (SELECTED_API_QUICK_PICK) {
        await Promise.resolve(
            SELECTED_API_QUICK_PICK.action()
        );
    }
}

function textEditorToJsonObject(editor: vscode.TextEditor, index: number) {
    if (!editor) {
        return <any>editor;
    }

    const ACTIVE_EDITOR = vscode.window.activeTextEditor;

    let obj: any = {
        index: index,
        isActive: editor === ACTIVE_EDITOR,
    };

    const DOC = editor.document;
    if (DOC) {
        let fileObj: any;

        if (!deploy_helpers.isEmptyString(DOC.fileName)) {
            fileObj = {
                name: Path.basename(DOC.fileName),
            };

            if (Path.isAbsolute(DOC.fileName)) {
                fileObj.path = Path.dirname(DOC.fileName);
            }
        }

        obj.document = {
            eol: deploy_helpers.toEOL( DOC.eol ),
            file: fileObj,
            isDirty: DOC.isDirty,
            isUntitled: DOC.isUntitled,
            language: DOC.languageId,
            lines: DOC.lineCount,
            resources: {
                '_self': '/api/editors/' + index,
                'content': '/api/editors/' + index + '/content',
            },
            version: DOC.version,
        };        
    }

    return obj;
}

function toErrorObject(err: any) {
    let errorMsg: string;
    let errorName: string;
    let errorStack: string;
    if (err instanceof Error) {
        errorMsg = deploy_helpers.toStringSafe( err.message );
        errorStack = deploy_helpers.toStringSafe( err.stack );
        errorName = deploy_helpers.toStringSafe( err.name );
    }
    else {
        errorMsg = deploy_helpers.toStringSafe( err );
    }

    return {
        message: errorMsg,
        stack: errorStack,
        type: errorName,
    };
}