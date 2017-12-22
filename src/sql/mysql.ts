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
import * as MySQL from 'mysql';


/**
 * Options for a MySQL connection.
 */
export interface MySQLOptions extends deploy_sql.SqlConnectionOptions {
    /**
     * The charset to use.
     */
    readonly charset?: string;
    /**
     * The database to connect to.
     */
    readonly database?: string;
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
     * Reject untrusted SSL connections or not.
     */
    readonly rejectUnauthorized?: boolean;
    /**
     * The username.
     */
    readonly user?: string;
}

/**
 * A result of a MySQL query.
 */
export interface MySQLResult extends deploy_sql.SqlResult {
    /** @inheritdoc */
    readonly connection: MySQLConnection;
}


/**
 * A MySQL connection.
 */
export class MySQLConnection extends deploy_objects.DisposableBase implements deploy_sql.SqlConnection {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {MySQL.Connection} connection The underlying connection instance.
     */
    constructor(public connection: MySQL.Connection) {
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
                OLD_CONNECTION.end((err) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        ME.connection = null;
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
    protected onDispose() {
        this.close();
    }

    /** @inheritdoc */
    public query(sql: string, ...args: any[]): Promise<MySQLResult[]> {
        const ME = this;

        return new Promise<MySQLResult[]>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                ME.connection.query(
                    deploy_helpers.toStringSafe(sql),
                    deploy_helpers.asArray(args),
                    (err, rows) => {
                        if (err) {
                            COMPLETED(err);
                        }
                        else {
                            COMPLETED(null, [
                                {
                                    connection: ME,
                                    rows: rows,
                                }
                            ]);
                        }
                    });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    /** @inheritdoc */
    public readonly type = deploy_sql.SqlConnectionType.MySql;
}


/**
 * Opens a MySQL connection.
 * 
 * @param {MySQLOptions} [opts] The options.
 * 
 * @return {Promise<MySQLConnection>} The promise with the new connection.
 */
export async function openMySQLConnection(opts?: MySQLOptions) {
    if (!opts) {
        opts = <any>{};
    }

    return new Promise<MySQLConnection>(async (resolve, reject) => {
        const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

        try {
            let host = deploy_helpers.normalizeString(opts.host);
            if ('' === host) {
                host = deploy_contracts.DEFAULT_HOST;
            }

            let port = parseInt(
                deploy_helpers.toStringSafe(opts.port).trim()
            );
            if (isNaN(port)) {
                port = 3306;
            }

            let user = deploy_helpers.toStringSafe(opts.user).trim();
            if ('' === user) {
                user = 'root';
            }

            let pwd = deploy_helpers.toStringSafe(opts.password);
            if ('' === pwd) {
                pwd = undefined;
            }

            let db = deploy_helpers.toStringSafe(opts.database).trim();
            if ('' === db) {
                db = undefined;
            }

            let charset = deploy_helpers.normalizeString(opts.charset);
            if ('' === charset) {
                charset = undefined;
            }

            let ssl: any;
            if (!deploy_helpers.isNullOrUndefined(opts.rejectUnauthorized)) {
                ssl = {
                    rejectUnauthorized: deploy_helpers.toBooleanSafe(opts.rejectUnauthorized, true),
                };
            }

            const CONN_OPTS: MySQL.ConnectionConfig = {
                charset: charset,
                database: db,
                host: host,
                port: port,
                user: user,
                password: pwd,
                ssl: ssl,
            };

            const CONN = MySQL.createConnection(CONN_OPTS);

            CONN.connect(function(err) {
                if (err) {
                    COMPLETED(err);
                }
                else {
                    COMPLETED(null,
                              new MySQLConnection(CONN));
                }
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}
