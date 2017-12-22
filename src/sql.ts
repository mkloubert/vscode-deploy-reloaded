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

import * as deploy_sql_mssql from './sql/mssql';
import * as deploy_sql_mysql from './sql/mysql';
import * as i18 from './i18';
import * as vscode from 'vscode';


/**
 * A SQL connection.
 */
export interface SqlConnection extends vscode.Disposable {
    /**
     * The underlying connection object.
     */
    readonly connection: any;
    /**
     * Closes the connection.
     * 
     * @returns {PromiseLike<any>} The promise that indicates if operation was successful or not.
     */
    readonly close: () => PromiseLike<boolean>;
    /**
     * Starts a query.
     * 
     * @param {string} sql The SQL command.
     * @param {any[]} [args] One or more arguments for the command.
     * 
     * @return {SqlResult[]} The promise with the result(s).
     */
    readonly query: (sql: string, ...args: any[]) => PromiseLike<SqlResult[]>;
    /**
     * The type.
     */
    readonly type: SqlConnectionType;
}

type SqlConnectionFactory = (opts?: SqlConnectionOptions) => SqlConnection | PromiseLike<SqlConnection>;


/**
 * Options for a SQL connection.
 */
export interface SqlConnectionOptions {
}

/**
 * A result of a SQL query.
 */
export interface SqlResult {
    /**
     * The underlying connection.
     */
    readonly connection: SqlConnection;
    /**
     * Gets the rows that have been returned by the query.
     */
    readonly rows?: ArrayLike<{ [name: string]: any }>;
}


/**
 * List of known SQL connection types.
 */
export enum SqlConnectionType {
    /**
     * MySQL
     */
    MySql = 0,
    /**
     * Microsoft SQL
     */
    MSSql = 1,
}


/**
 * Opens a SQL connection.
 * 
 * @param {SqlConnectionType} type The type / engine.
 * @param {SqlConnectionOptions} [opts] The options.
 * 
 * @returns {Promise<SqlConnection>} The promise with the new, open connection.
 */
export async function openSqlConnection(type: SqlConnectionType, opts?: SqlConnectionOptions): Promise<SqlConnection> {
    let factory: SqlConnectionFactory;
    switch (type) {
        case SqlConnectionType.MSSql:
            // Microsoft SQL
            factory = deploy_sql_mssql.openMSSQLConnection;
            break;

        case SqlConnectionType.MySql:
            // MySQL
            factory = deploy_sql_mysql.openMySQLConnection;
            break;
    }

    if (!factory) {
        throw new Error(i18.t('sql.notSupported', type));
    }

    return await Promise.resolve(
        factory(opts)
    );
}
