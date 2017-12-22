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

import * as deploy_contracts from '../contracts';
import * as deploy_helpers from '../helpers';
import * as deploy_objects from '../objects';
import * as deploy_sql from '../sql';
import * as Moment from 'moment';
import * as MSSQL from 'mssql';


/**
 * Options for a MSSQL connection.
 */
export interface MSSQLOptions extends deploy_sql.SqlConnectionOptions {
    /**
     * The database to connect to.
     */
    readonly database?: string;
    /**
     * The driver to use.
     */
    readonly driver?: string;
    /**
     * Encrypt the connection or not.
     */
    readonly encrypt?: boolean;
    /**
     * The host.
     */
    readonly host?: string;
    /**
     * The TCP port.
     */
    readonly port?: number;
    /**
     * The password.
     */
    readonly password?: string;
    /**
     * The username.
     */
    readonly user?: string;
}

/**
 * A result of a MSSQL query.
 */
export interface MSSQLResult extends deploy_sql.SqlResult {
    /** @inheritdoc */
    readonly connection: MSSQLConnection;
}


/**
 * A Microsoft SQL connection.
 */
export class MSSQLConnection extends deploy_objects.DisposableBase implements deploy_sql.SqlConnection {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {MSSQL.ConnectionPool} connection The underlying connection instance.
     */
    constructor(public connection: MSSQL.ConnectionPool) {
        super();
    }

    /** @inheritdoc */
    public close() {
        const ME = this;

        return new Promise<boolean>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            const OLD_CONNECTION = ME.connection;
            if (!OLD_CONNECTION) {
                COMPLETED(null, false);
                return;
            }

            try {
                OLD_CONNECTION.close();
                ME.connection = null;

                COMPLETED(null, true);
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /** @inheritdoc */
    protected onDispose() {
        this.close();
    }

    /** @inheritdoc */
    public query(sql: string, ...args: any[]): Promise<MSSQLResult[]> {
        const ME = this;

        return new Promise<MSSQLResult[]>(async (resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                const REQUEST = new MSSQL.Request(ME.connection);
                deploy_helpers.asArray(args).forEach((a, i) => {
                    const PARAM_NAME = `Param_${i + 1}`;
                    let type: any;
                    let value = a;
        
                    if (!deploy_helpers.isNullOrUndefined(a)) {
                        switch (typeof a) {
                            case 'boolean':
                                type = MSSQL.Bit;
                                value = deploy_helpers.toBooleanSafe(a) ? 1 : 0;
                                break;
        
                            case 'number':
                                type = MSSQL.Numeric;
                                break;
        
                            case 'object':
                                if (Moment.isDate(a) || Moment.isMoment(a)) {
                                    const M = Moment.isMoment(a) ? a : Moment(a);
        
                                    type = MSSQL.DateTimeOffset;
                                    value = deploy_helpers.asUTC(M)
                                                          .format('YYYY-MM-DD HH:mm:ss 00:00');
                                }
                                else {
                                    type = MSSQL.Text;
                                    value = JSON.stringify(a);
                                }
                                break;
        
                            default:
                                type = MSSQL.Text;
                                value = deploy_helpers.toStringSafe(a);
                                break;
                        }
                    }
        
                    REQUEST.input(PARAM_NAME, type, value);
                });

                const QUERY_RESULT = await REQUEST.query( deploy_helpers.toStringSafe(sql) );

                const RESULTS: MSSQLResult[] = [];
                if (QUERY_RESULT.recordsets) {
                    QUERY_RESULT.recordsets.forEach(rs => {
                        const NEW_RESULT: MSSQLResult = {
                            connection: ME,
                            rows: rs,
                        };

                        RESULTS.push(NEW_RESULT);
                    });
                }

                COMPLETED(null, RESULTS);
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /** @inheritdoc */
    public readonly type = deploy_sql.SqlConnectionType.MSSql;
}


/**
 * Opens a MSSQL connection.
 * 
 * @param {MSSQLOptions} [opts] The options.
 * 
 * @return {Promise<MSSQLConnection>} The promise with the new connection.
 */
export async function openMSSQLConnection(opts?: MSSQLOptions) {
    if (!opts) {
        opts = <any>{};
    }

    return new Promise<MSSQLConnection>(async (resolve, reject) => {
        const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

        try {
            let driver = deploy_helpers.normalizeString(opts.driver);
            if ('' === driver) {
                driver = 'tedious';
            }

            let host = deploy_helpers.normalizeString(opts.host);
            if ('' === host) {
                host = deploy_contracts.DEFAULT_HOST;
            }

            let port = parseInt(
                deploy_helpers.toStringSafe(opts.port).trim()
            );
            if (isNaN(port)) {
                port = 1433;
            }

            let user = deploy_helpers.toStringSafe(opts.user).trim();
            if ('' === user) {
                user = 'sa';
            }

            let pwd = deploy_helpers.toStringSafe(opts.password);
            if ('' === pwd) {
                pwd = undefined;
            }

            let db = deploy_helpers.toStringSafe(opts.database).trim();
            if ('' === db) {
                db = undefined;
            }

            const CONN_OPTS: MSSQL.config = {
                database: db,
                driver: driver,
                server: host,
                port: port,
                user: user,
                password: pwd,

                options: {
                    encrypt: deploy_helpers.toBooleanSafe(opts.encrypt),
                },
            };

            const POOL = new MSSQL.ConnectionPool(CONN_OPTS);

            COMPLETED(null,
                      new MSSQLConnection( await POOL.connect() ));
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}
