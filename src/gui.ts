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


import * as deploy_contracts from './contracts';
import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as Enumerable from 'node-enumerable';
import * as vscode from 'vscode';


interface LastExecutedActions {
    executionCount: { [ id: string ]: any };
    lastExecuted: string | false;
}


/**
 * Sorts quick pick items by usage by using the 'state' property as ID value.
 * 
 * @param {IItem|TItem[]} items The item(s) to sort. 
 * @param {vscode.vscode.Memento} state The memento where to store the states and counters.
 * @param {string} key The key inside the memento.
 * @param {Function} [labelResolver] The custom function that resolves the label value  of an item.
 * 
 * @return {TItem[]} The sorted items.
 */
export function sortQuickPicksByUsage<TItem extends deploy_contracts.ActionQuickPick = deploy_contracts.ActionQuickPick> (
    items: TItem | TItem[],
    state: vscode.Memento,
    key: string,
    labelResolver?: (item: TItem) => string
) : deploy_contracts.ActionQuickPick[]
{
    items = deploy_helpers.asArray(items);
    key = deploy_helpers.toStringSafe(key);

    if (!labelResolver) {
        labelResolver = (item) => {
            return deploy_helpers.toStringSafe(item.label)
                                 .trim();
        };
    }

    let le: LastExecutedActions;
    const UPDATE_ITEM = (id: any) => {
        try {
            id = deploy_helpers.toStringSafe(id);

            le.lastExecuted = id;
            le.executionCount[id] = isNaN(le.executionCount[id]) ? 1
                                                                 : (le.executionCount[id] + 1);

            state.update(key, le).then(() => {
            }, (err) => {
                deploy_log.CONSOLE
                          .trace(err, 'gui.sortQuickPicksByUsage().UPDATE_LAST_EXECUTED_QP(3)');
            });
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'gui.sortQuickPicksByUsage().UPDATE_LAST_EXECUTED_QP(2)');
        }
    };

    try {
        le = state.get<LastExecutedActions>(key);
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'gui.sortQuickPicksByUsage(1)');
    }

    if (!deploy_helpers.isObject<LastExecutedActions>(le)) {
        le = {
            executionCount: {},
            lastExecuted: false,
        };
    }

    try {
        return Enumerable.from( items ).select(i => {
            return deploy_helpers.cloneObjectFlat(i);
        }).pipe(i => {
            const BASE_ACTION = i.action;

            (<any>i).action = async function() {
                UPDATE_ITEM(i.state);
                
                if (BASE_ACTION) {
                    return await Promise.resolve(
                        BASE_ACTION.apply(i, arguments),
                    );
                }
            };
        }).orderBy(i => {
            // first if item has been executed last
            const ID = deploy_helpers.toStringSafe(i.state);
            
            return le.lastExecuted === ID ? 0 : 1;
        }).thenByDescending(i => {
            const ID = deploy_helpers.toStringSafe(i.state);

            return isNaN(le.executionCount[ID]) ? 0
                                                : le.executionCount[ID];
        }).thenBy(i => {
            return deploy_helpers.normalizeString(
                labelResolver(i)
            );
        }).toArray();
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'gui.sortQuickPicksByUsage(2)');

        return items;
    }
}
