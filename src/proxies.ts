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
import * as deploy_log from './log';
import * as deploy_workspaces from './workspaces';
import * as Enumerable from 'node-enumerable';
import * as i18 from './i18';
import * as Net from 'net';
import * as vscode from 'vscode';


/**
 * A storage of proxy settings.
 */
export type Proxies = { [port: string]: ProxySettings };

/**
 * A proxy button.
 */
export interface ProxyButton extends deploy_contracts.Button {
    /**
     * The (text) color for the button when proxy is stopped.
     */
    readonly stopColor?: string;
}

/**
 * A value for a proxy button.
 */
export type ProxyButtonValue = ProxyButton | string | boolean;

/**
 * A proxy destination.
 */
export interface ProxyDestination extends deploy_contracts.ConditionalItem,
                                          deploy_contracts.PlatformItem,
                                          deploy_contracts.WithOptionalName
{
    /**
     * The destination address / hostname.
     */
    readonly address?: string;
    /**
     * The destination port.
     */
    readonly port?: number;
}

/**
 * A proxy destination value.
 */
export type ProxyDestinationValue = ProxyDestination | number | string;

/**
 * Settings for a proxy.
 */
export interface ProxySettings extends deploy_contracts.ConditionalItem,
                                       deploy_contracts.PlatformItem,
                                       deploy_contracts.WithOptionalName
{
    /**
     * A list of one or more allowed IP addresses in CIDR format.
     */
    readonly allowed?: string[];
    /**
     * Run proxy on startup or not.
     */
    readonly autoStart?: boolean;
    /**
     * Settings for a proxy button.
     */
    readonly button?: ProxyButtonValue;
    /**
     * Activate logging for proxy or not.
     */
    readonly debug?: boolean;
    /**
     * A description for the proxy.
     */
    readonly description?: string;
    /**
     * The destination to send data to and from.
     */
    readonly destination: ProxyDestinationValue;
}

interface TcpProxyDestination {
    readonly addr?: string;
    readonly port?: number;
}

/**
 * A context of a TCP proxy destination.
 */
export interface TcpProxyDestinationContext extends vscode.Disposable {
    /**
     * The underlying proxy.
     */
    readonly proxy: TcpProxy;
}

/**
 * A context for TCP proxy logging.
 */
export interface TcpProxyLoggingContext extends vscode.Disposable {
    /**
     * The underlying proxy.
     */
    readonly proxy: TcpProxy;
}

/**
 * A name and description resolver for a TCP proxy.
 * 
 * @return {TcpProxyNameAndDescription} The name and description.
 */
export type TcpProxyNameAndDescriptionResolver = () => TcpProxyNameAndDescription;

/**
 * Stores the name and description for a TCP proxy.
 */
export interface TcpProxyNameAndDescription {
    /**
     * The description.
     */
    readonly description?: string;
    /**
     * The (display) name.
     */
    readonly name?: string;
}

/**
 * The context of a name and description resolver for a TCP proxy.
 */
export interface TcpProxyNameAndDescriptionResolverContext extends vscode.Disposable {
    /**
     * The underlying proxy.
     */
    readonly proxy: TcpProxy;
    /**
     * The underlying workspace.
     */
    readonly workspace: deploy_workspaces.Workspace;
}

/**
 * Options for a TCP proxy.
 */
export interface TcpProxyOptions {
    /**
     * The custom TCP port.
     */
    readonly port?: number;
}

/**
 * A function for a TCP proxy, that checks if the address of a remote client is allowed or not.
 * 
 * @param {string} addr The IP address of the remote client.
 * @param {number} port The TCP port of the remote client.
 * 
 * @return {boolean} Is allowed or not.
 */
export type TcpProxyRemoteFilter = (addr: string, port: number) => boolean;

/**
 * A context of a remote client filter for a TCP proxy.
 */
export interface TcpProxyRemoteFilterContext extends vscode.Disposable {
    /**
     * The underlying TCP proxy.
     */
    readonly proxy: TcpProxy;
}


/**
 * The default port for a TCP proxy.
 */
export const DEFAULT_TCP_PORT = 30904;
/**
 * Name of an event that is raised, when a connection with a remote has been rejected.
 */
export const EVENT_REJECTED = 'rejected';
/**
 * Name of an event that is raised, when a proxy has been started.
 */
export const EVENT_STARTED = 'started';
/**
 * Name of an event that is raised, when a proxy is going to be started.
 */
export const EVENT_STARTING = 'starting';
/**
 * Name of an event that is raised, when a proxy has been stopped.
 */
export const EVENT_STOPPED = 'stopped';
/**
 * Name of an event that is raised, when a proxy is going to be stopped.
 */
export const EVENT_STOPPING = 'stopping';
/**
 * Name of an event that is raised, when a tunnel has been closed.
 */
export const EVENT_TUNNEL_CLOSED = 'tunnel.closed';
/**
 * Name of an event that is raised, when a tunnel is going to be closed.
 */
export const EVENT_TUNNEL_CLOSING = 'tunnel.closing';
/**
 * Name of an event that is raised, when a socket of a target has been closed.
 */
export const EVENT_TUNNEL_TARGET_CLOSED = 'tunnel.target.closed';
/**
 * Name of an event that is raised, when a socket of a target is going to be closed.
 */
export const EVENT_TUNNEL_TARGET_CLOSING = 'tunnel.target.closing';
/**
 * Name of an event that is raised, when a target socket has raised an error.
 */
export const EVENT_TUNNEL_TARGET_ERROR = 'tunnel.target.error';
/**
 * Name of an event that is raised, when a target socket has ben opened.
 */
export const EVENT_TUNNEL_TARGET_OPENED = 'tunnel.target.opened';
/**
 * Name of an event that is raised, when a target socket is going to be opened.
 */
export const EVENT_TUNNEL_TARGET_OPENING = 'tunnel.target.opening';
let nextTcpProxyId = Number.MIN_SAFE_INTEGER;
const TCP_PROXIES: { [port: number]: TcpProxy } = {};

/**
 * A TCP propxy.
 */
export class TcpProxy extends deploy_helpers.DisposableBase {
    private _destinations: TcpProxyDestination[] = [];
    private _filters: TcpProxyRemoteFilter[] = [];
    private readonly _NAME_AND_DESC_RESOLVERS: deploy_contracts.KeyValuePairs<TcpProxyNameAndDescriptionResolver> = {};
    private _server: Net.Server;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {TcpProxyOptions} [opts] Custom, additional options.
     */
    public constructor(public readonly opts?: TcpProxyOptions) {
        super();

        this.id = nextTcpProxyId++;

        this.options = opts;
        if (!this.options) {
            this.options = <any>{};
        }
    }

    /**
     * Adds a destination.
     * 
     * @param {string} addr The address / hostname of the destination.
     * @param {number} port The TCP port of the destination.
     * 
     * @return {TcpProxyTargetContext} The context of the added destination.
     */
    public addDestination(addr: string, port: number): TcpProxyDestinationContext {
        const ME = this;

        const NEW_ITEM: TcpProxyDestination = {
            addr: addr,
            port: port,
        };
        ME._destinations.push( NEW_ITEM );

        let isDisposed = false;
        return {
            dispose: () => {
                if (ME.isInFinalizeState || isDisposed) {
                    return;
                }

                ME._destinations = ME._destinations.filter(t => {
                    return t !== NEW_ITEM;
                });

                isDisposed = true;
            },
            proxy: ME,
        };
    }

    /**
     * Adds a filter.
     * 
     * @param {TcpProxyRemoteFilter} filter The filter.
     * 
     * @return {TcpProxyRemoteFilterContext} The filter context.
     */
    public addFilter(filter: TcpProxyRemoteFilter): TcpProxyRemoteFilterContext {
        const ME = this;

        ME._filters
          .push(filter);

        return {
            dispose: () => {
                ME._filters = ME._filters.filter(f => {
                    return f !== filter;
                });
            },
            proxy: ME,
        };
    }

    /**
     * Returns the name and description of that proxy for a workspace.
     * 
     * @param {deploy_workspaces.Workspace} workspace The workspace.
     * 
     * @return {TcpProxyNameAndDescription} The name and description.
     */
    public getNameAndDescriptionFor(workspace: deploy_workspaces.Workspace): TcpProxyNameAndDescription {
        let nameAndDesc: TcpProxyNameAndDescription;

        const KEY = getNameAndDescriptionKey( workspace );

        const RESOLVER = this._NAME_AND_DESC_RESOLVERS[ KEY ];
        if (RESOLVER) {
            nameAndDesc = RESOLVER();
        }

        nameAndDesc = nameAndDesc || {};

        return {
            name: deploy_helpers.isEmptyString(nameAndDesc.name) ? getTcpProxyName(this): nameAndDesc.name,
            description: nameAndDesc.description,
        };
    }

    private async cleanupServer() {
        const ME = this;

        return new Promise<boolean>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const OLD_SERVER = ME._server;
                if (OLD_SERVER) {
                    OLD_SERVER.close(() => {
                        ME._server = null;

                        COMPLETED(null, true);    
                    });
                }
                else {
                    COMPLETED(null, false);
                }                
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /**
     * Gets the ID of the proxy.
     */
    public readonly id: number;

    private isRemoteAllowed(addr: string, port: number): boolean {
        const FILTERS = this._filters.map(f => f);
        if (FILTERS.length > 0) {
            return Enumerable.from(FILTERS)
                             .any(f => f(addr, port));
        }

        return true;
    }

    /**
     * Returns if the proxy is currently running or not.
     */
    public get isRunning() {
        return !_.isNil( this._server );
    }

    /** @inheritdoc */
    protected onDispose() {
        const ME = this;

        ME.cleanupServer().then(() => {
            ME._destinations = null;
        }, (err) => {
            deploy_log.CONSOLE
                      .trace(err, 'proxies.TcpProxy.onDispose(1)');
        });
    }

    /**
     * Gets the options for that proxy.
     */
    public readonly options: TcpProxyOptions;

    /**
     * Gets the port the proxy listens on.
     */
    public get port(): number {
        let p = parseInt(
            deploy_helpers.toStringSafe( this.options.port ).trim()
        );
        if (isNaN(p)) {
            p = DEFAULT_TCP_PORT;
        }

        return p;
    }

    /**
     * Set the name and description resolver for a workspace.
     * 
     * @param {deploy_workspaces.Workspace} workspace The workspace.
     * @param {TcpProxyNameAndDescriptionResolver} resolver The resolver.
     * 
     * @return {TcpProxyNameAndDescriptionContext} The resolver context.
     */
    public setNameAndDescriptionResolver(workspace: deploy_workspaces.Workspace, resolver: TcpProxyNameAndDescriptionResolver): TcpProxyNameAndDescriptionResolverContext {
        const ME = this;

        const KEY = getNameAndDescriptionKey( workspace );
        
        ME._NAME_AND_DESC_RESOLVERS[ KEY ] = resolver;

        return {
            dispose: () => {
                delete this._NAME_AND_DESC_RESOLVERS[ KEY ];
            },
            proxy: ME,
            workspace: workspace,
        };
    }

    /**
     * Starts the proxy.
     * 
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public async start(): Promise<boolean> {
        const ME = this;

        return new Promise<boolean>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            if (ME._server) {
                COMPLETED(null, false);
                return;
            }

            try {
                ME.emit(EVENT_STARTING);

                const PORT = ME.port;

                const NEW_SERVER = Net.createServer(function(ls) {
                    ME.startTunnel(ls, PORT).then(() => {
                        ME.emit('tunnel.opened',
                                ls, PORT);
                    }, (err) => {
                        ME.emit('tunnel.error',
                                err, ls, PORT);
                    });
                });

                NEW_SERVER.once('close', function() {
                    ME._server = null;
                });

                NEW_SERVER.once('error', function(err) {
                    COMPLETED(err);
                });         
                
                NEW_SERVER.listen(PORT, function(err) {
                    if (!err) {
                        ME._server = NEW_SERVER;

                        ME.emit(EVENT_STARTED);
                    }

                    COMPLETED(err);
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    private startTunnel(localSocket: Net.Socket, port: number) {
        const ME = this;

        return new Promise<void>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            let allTargetSockets: Net.Socket[] = [];
            let tunnelAlreadyClosed = false;

            let closeTargetSocket: (err: any, targetSocket: Net.Socket) => void;
            let closeTunnel: (err: any) => void;
            let closeTunnelIfNeeded: (err: any) => void;
            let closeAllTargetSockets: (err: any) => void;

            closeTargetSocket = (err: any, targetSocket: Net.Socket) => {
                if (!targetSocket) {
                    return;
                }

                ME.emit(EVENT_TUNNEL_TARGET_CLOSING,
                        err, targetSocket, allTargetSockets, localSocket);

                try {
                    targetSocket.removeAllListeners();
                }
                catch (e) {}
                try {
                    targetSocket.destroy();
                }
                catch (e) {}

                allTargetSockets = allTargetSockets.filter(ts => {
                    return ts !== targetSocket;
                });

                ME.emit(EVENT_TUNNEL_TARGET_CLOSED,
                        err, targetSocket, allTargetSockets, localSocket);

                closeTunnelIfNeeded(err);
            };

            closeTunnel = (err: any) => {
                if (tunnelAlreadyClosed) {
                    return;
                }
                tunnelAlreadyClosed = true;

                ME.emit(EVENT_TUNNEL_CLOSING,
                        err, localSocket, port, allTargetSockets);

                try {
                    localSocket.removeAllListeners();
                }
                catch (e) {}
                try {
                    localSocket.destroy();
                }
                catch (e) {}

                closeAllTargetSockets(err);

                ME.emit(EVENT_TUNNEL_CLOSED,
                        err, localSocket, port);
            };

            closeTunnelIfNeeded = (err: any) => {
                if (allTargetSockets.length < 1 || ME.isInFinalizeState) {
                    closeTunnel(err);
                }
            };

            closeAllTargetSockets = (err: any) => {
                try {
                    Enumerable.shiftFrom(allTargetSockets).forAll(ts => {
                        closeTargetSocket(err, ts);    
                    });
                }
                catch (e) { }
            };

            localSocket.once('error', function (err) {
                closeTunnel(err);
            });

            localSocket.once('close', function () {
                closeAllTargetSockets(null);
            });

            if (!ME.isRemoteAllowed(localSocket.remoteAddress, localSocket.remotePort)) {
                closeTunnel(null);

                ME.emit(EVENT_REJECTED,
                        localSocket, port);

                return;
            }
    
            try {
                const TARGETS = ME._destinations.map(t => t);
                if (TARGETS.length > 0) {
                    deploy_helpers.asArray( ME._destinations ).forEach(d => {
                        let ts: Net.Socket;
                        try {
                            let targetAddr = deploy_helpers.normalizeString(d.addr);
                            if ('' === targetAddr) {
                                targetAddr = deploy_contracts.DEFAULT_HOST;
                            }

                            let targetPort = parseInt(
                                deploy_helpers.toStringSafe(d.port).trim()
                            );
                            if (isNaN(targetPort)) {
                                targetPort = port;
                            }

                            ts = new Net.Socket();

                            const EMIT_SOCKET_ERROR = (err: any) => {
                                ME.emit(EVENT_TUNNEL_TARGET_ERROR,
                                        err, targetAddr, targetPort, localSocket, port, ts);

                                closeTargetSocket(err, ts);
                            };                            

                            ts.once('error', function (err) {
                                EMIT_SOCKET_ERROR(err);
                            });

                            ts.once('close', function () {
                                closeTargetSocket(null, ts);
                            });
            
                            ME.emit(EVENT_TUNNEL_TARGET_OPENING,
                                    ts, localSocket, targetAddr, targetPort, port);

                            ts.connect(targetPort, targetAddr, function() {
                                try {
                                    // duplex pipe
                                    localSocket.pipe(ts)
                                               .pipe(localSocket);

                                    allTargetSockets.push(ts);
                                    
                                    ME.emit(EVENT_TUNNEL_TARGET_OPENED,
                                            ts, localSocket, targetAddr, targetPort, port);
                                }
                                catch (e) {
                                    EMIT_SOCKET_ERROR(e);
                                }
                            });
                        }
                        catch (e) {
                            closeTargetSocket(e, ts);
                        }
                    });
                }
                else {
                    closeTunnel(null);
                }

                COMPLETED(null);
            }
            catch (e) {
                closeTunnel(e);

                COMPLETED(e);
            }
        });
    }

    /**
     * Stops the proxy.
     * 
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public async stop(): Promise<boolean> {
        const ME = this;

        return new Promise<boolean>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.emit(EVENT_STOPPING);

                COMPLETED(null,
                          await ME.cleanupServer());

                ME.emit(EVENT_STOPPED);
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /**
     * Toggles the "running state" of that proxy.
     * 
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public async toggle() {
        if (this.isRunning) {
            return await this.stop();
        }
        
        return await this.start();
    }
}

function getNameAndDescriptionKey(workspace: deploy_workspaces.Workspace) {
    return deploy_helpers.toStringSafe( workspace.id );
}

/**
 * Returns a global TCP proxy by port.
 * 
 * @param {number} port The port.
 * 
 * @return {TcpProxy} The proxy.
 */
export function getTcpProxy(port: number): TcpProxy {
    if (port < 0 || port > 65535) {
        throw new Error(`Invalid port '${port}'!`);
    }

    let proxy: TcpProxy = TCP_PROXIES[ port ];
    if (_.isNil(proxy)) {
        TCP_PROXIES[ port ] = proxy = new TcpProxy({
            port: port,
        });

        proxy.on('error', function(err) {
            // prevent unhandled exceptions
        });
    }

    return proxy;
}

/**
 * Returns the (display) name of a TCP proxy.
 * 
 * @param {TcpProxy} proxy The proxy.
 * 
 * @return {string} The name.
 */
export function getTcpProxyName(proxy: TcpProxy): string {
    if (_.isNil(proxy)) {
        return <any>proxy;
    }

    return `Proxy @ ${proxy.port}`;
}

/**
 * Registers a TCP proxy for logging.
 * 
 * @param {TcpProxy} proxy The proxy.
 * @param {Function} loggerProvider The function that provides the base logger.
 * 
 * @return {TcpProxyLoggingContext} The logging context.
 */
export function registerLoggingForTcpProxy(proxy: TcpProxy, loggerProvider: () => deploy_log.Logger): TcpProxyLoggingContext {
    if (!proxy) {
        return <any>proxy;
    }

    const LOGGER = new deploy_log.ActionLogger();
    LOGGER.addAction((ctx) => {
        let baseLogger: deploy_log.Logger;
        if (loggerProvider) {
            baseLogger = loggerProvider();
        }

        if (baseLogger) {
            baseLogger.log(ctx.type,
                           ctx.message, `[tcp.proxy(${ deploy_helpers.toStringSafe(proxy.id) })]::[${ deploy_helpers.toStringSafe(ctx.tag) }]`);
        }
    });

    const EXEC_SAFE = (action: Function, ...params: any[]): any => {
        try {
            return action.apply(null, params);
        }
        catch (e) { }
    };

    const LISTENERS_TO_REMOVE: {
        ev: string | symbol,
        listener: Function,
    }[] = [];
    const ADD_EVENT_LISTENER = (ev: string | symbol, listener: Function) => {
        if (listener) {
            LISTENERS_TO_REMOVE.push({
                ev: ev,
                listener: listener,
            });

            proxy.on(ev, <any>listener);
        }

        return listener;
    };

    const CTX: TcpProxyLoggingContext = {
        dispose: () => {
            Enumerable.popFrom(LISTENERS_TO_REMOVE).forAll(l => {
                proxy.removeListener(l.ev, <any>l.listener);
            });
        },
        proxy: proxy,
    };

    try {
        ADD_EVENT_LISTENER('error', function(err: any) {
            EXEC_SAFE(() => {
                LOGGER.trace(`Proxy error: '${ deploy_helpers.toStringSafe(err) }'`,
                             'general');
            });
        });

        ADD_EVENT_LISTENER(EVENT_REJECTED, function(localSocket: Net.Socket, port: number) {
            EXEC_SAFE(() => {
                LOGGER.debug(`Connection '${ deploy_helpers.toStringSafe(localSocket.localAddress) }:${ deploy_helpers.toStringSafe(localSocket.localPort) }' <==> '${ deploy_helpers.toStringSafe(localSocket.remoteAddress) }:${ deploy_helpers.toStringSafe(localSocket.remotePort) }' rejected'`,
                             'remote');
            });
        });
        ADD_EVENT_LISTENER(EVENT_TUNNEL_CLOSED, function(err: any, localSocket: Net.Socket, port: number) {
            EXEC_SAFE(() => {
                LOGGER.debug(`Tunnel '${ deploy_helpers.toStringSafe(localSocket.localAddress) }:${ deploy_helpers.toStringSafe(localSocket.localPort) }' <==> '${ deploy_helpers.toStringSafe(localSocket.remoteAddress) }:${ deploy_helpers.toStringSafe(localSocket.remotePort) }' closed: '${ deploy_helpers.toStringSafe(err) }'`,
                             'tunnel');
            });
        });
        ADD_EVENT_LISTENER(EVENT_TUNNEL_CLOSING, function(err: any, localSocket: Net.Socket, port: number, allTargetSockets: Net.Socket[]) {
            EXEC_SAFE(() => {
                LOGGER.debug(`Tunnel '${ deploy_helpers.toStringSafe(localSocket.localAddress) }:${ deploy_helpers.toStringSafe(localSocket.localPort) }' <==> '${ deploy_helpers.toStringSafe(localSocket.remoteAddress) }:${ deploy_helpers.toStringSafe(localSocket.remotePort) }' is closing: '${ deploy_helpers.toStringSafe(err) }'`,
                             'tunnel');
            });
        });
        ADD_EVENT_LISTENER(EVENT_TUNNEL_TARGET_CLOSED, function(err: any, targetSocket: Net.Socket, allTargetSockets: Net.Socket[], localSocket: Net.Socket) {
            EXEC_SAFE(() => {
                LOGGER.debug(`Tunnel target '${ deploy_helpers.toStringSafe(targetSocket.localAddress) }:${ deploy_helpers.toStringSafe(targetSocket.localPort) }' <==> '${ deploy_helpers.toStringSafe(targetSocket.remoteAddress) }:${ deploy_helpers.toStringSafe(targetSocket.remotePort) }' closed: '${ deploy_helpers.toStringSafe(err) }'`,
                             'tunnel.target');
            });
        });
        ADD_EVENT_LISTENER(EVENT_TUNNEL_TARGET_CLOSING, function(err: any, targetSocket: Net.Socket, allTargetSockets: Net.Socket[], localSocket: Net.Socket) {
            EXEC_SAFE(() => {
                LOGGER.debug(`Tunnel target '${ deploy_helpers.toStringSafe(targetSocket.localAddress) }:${ deploy_helpers.toStringSafe(targetSocket.localPort) }' <==> '${ deploy_helpers.toStringSafe(targetSocket.remoteAddress) }:${ deploy_helpers.toStringSafe(targetSocket.remotePort) }' is closing: '${ deploy_helpers.toStringSafe(err) }'`,
                             'tunnel.target');
            });
        });
        ADD_EVENT_LISTENER(EVENT_TUNNEL_TARGET_ERROR, function(err: any, targetAddr: string, targetPort: number, localSocket: Net.Socket, port: number, ts: Net.Socket) {
            EXEC_SAFE(() => {
                LOGGER.debug(`Tunnel target '${ deploy_helpers.toStringSafe(localSocket.localAddress) }:${ deploy_helpers.toStringSafe(localSocket.localPort) }' <==> '${ deploy_helpers.toStringSafe(targetAddr) }:${ deploy_helpers.toStringSafe(targetPort) }' error: '${ deploy_helpers.toStringSafe(err) }'`,
                             'tunnel.target');
            });
        });
        ADD_EVENT_LISTENER(EVENT_TUNNEL_TARGET_OPENED, function(ts: Net.Socket, localSocket: Net.Socket, targetAddr: string, targetPort: number, port: number) {
            EXEC_SAFE(() => {
                LOGGER.debug(`Tunnel target '${ deploy_helpers.toStringSafe(localSocket.localAddress) }:${ deploy_helpers.toStringSafe(localSocket.localPort) }' <==> '${ deploy_helpers.toStringSafe(targetAddr) }:${ deploy_helpers.toStringSafe(targetPort) }' opened`,
                             'tunnel.target');
            });
        });
        ADD_EVENT_LISTENER(EVENT_TUNNEL_TARGET_OPENING, function(ts: Net.Socket, localSocket: Net.Socket, targetAddr: string, targetPort: number, port: number) {
            EXEC_SAFE(() => {
                LOGGER.debug(`Tunnel target '${ deploy_helpers.toStringSafe(localSocket.localAddress) }:${ deploy_helpers.toStringSafe(localSocket.localPort) }' <==> '${ deploy_helpers.toStringSafe(targetAddr) }:${ deploy_helpers.toStringSafe(targetPort) }' is opening ...`,
                             'tunnel.target');
            });
        });
    }
    catch (e) {
        deploy_helpers.tryDispose(CTX);

        throw e;
    }

    return CTX;
}

/**
 * Shows quick pick for TCP proxies.
 */
export async function showTcpProxyQuickPick() {
    const ALL_WORKSPACES = deploy_workspaces.getAllWorkspaces();

    if (ALL_WORKSPACES.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('workspaces.noneFound')
        );

        return;
    }

    const PROXIES = Enumerable.from( ALL_WORKSPACES ).orderBy(ws => {
        return ws.isActive ? 0 : 1;
    }).thenBy(ws => {
        return deploy_helpers.normalizeString(ws.id);
    }).selectMany(ws => {
        return ws.getTcpProxies().map(p => {
            return {
                proxy: p,
                workspace: ws,
            };
        });
    }).toArray();

    const PROXY_QUICK_PICKS: deploy_contracts.ActionQuickPick[] = PROXIES.map(x => {
        const NAME_AND_DESC = x.proxy.getNameAndDescriptionFor(x.workspace);

        return {
            action: async () => {
                await showQuickPickForTcpProxy(
                    x.proxy, x.workspace,
                );
            },
            label: deploy_helpers.toStringSafe(NAME_AND_DESC.name),
            description: deploy_helpers.toStringSafe(NAME_AND_DESC.description),
            detail: x.workspace.rootPath,
        };
    });

    if (PROXY_QUICK_PICKS.length < 1) {
        deploy_helpers.showWarningMessage(
            i18.t('proxies.noneFound')
        );

        return;
    }

    const SELECTED_PROXY_QUICK_PICK = await vscode.window.showQuickPick(
        PROXY_QUICK_PICKS,
        {
            placeHolder: i18.t('proxies.selectProxy'),
        }
    );

    if (SELECTED_PROXY_QUICK_PICK) {
        await Promise.resolve(
            SELECTED_PROXY_QUICK_PICK.action()
        );
    }
}

async function showQuickPickForTcpProxy(proxy: TcpProxy, workspace: deploy_workspaces.Workspace) {
    const NAME_AND_DESC = proxy.getNameAndDescriptionFor(workspace);

    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [];

    if (proxy.isRunning) {
        QUICK_PICKS.push({
            action: async () => {
                await proxy.stop();
            },
            label: '$(triangle-right)  ' + workspace.t('proxies.stopProxy'),
            description: "",
            detail: deploy_helpers.toStringSafe(NAME_AND_DESC.name),
        });
    }
    else {
        QUICK_PICKS.push({
            action: async () => {
                await proxy.start();
            },
            label: '$(primitive-square)  ' + workspace.t('proxies.startProxy'),
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
 * Disposes all global proxies.
 */
export const PROXY_DISPOSER: vscode.Disposable = {
    /** @inheritdoc */
    dispose: () => {
        for (const PORT of Object.keys(TCP_PROXIES)) {
            if (deploy_helpers.tryDispose(TCP_PROXIES[ PORT ])) {
                delete TCP_PROXIES[ PORT ];
            }
        }
    }
};
