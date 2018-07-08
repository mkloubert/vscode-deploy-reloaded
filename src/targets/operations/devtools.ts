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
import * as deploy_contracts from '../../contracts';
import * as deploy_helpers from '../../helpers';
import * as deploy_targets from '../../targets';
import * as vscode from 'vscode';

/**
 * An operation that invokes a method for a DevTools compatible browser debugger.
 */
export interface DevToolsTargetOperation extends deploy_targets.TargetOperation {
    /**
     * Always ask for the browser page or not.
     */
    readonly alwaysAskForPage?: boolean;
    /**
     * Debug results or not.
     */
    readonly debug?: boolean;
    /**
     * The hostname, where the debugger runs.
     */
    readonly host?: string;
    /**
     * The name of the method to invoke.
     */
    readonly method?: any;
    /**
     * A regular expression, which filters page by their title.
     */
    readonly pages?: string;
    /**
     * Parameters for the method.
     */
    readonly parameters?: any;
    /**
     * The TCP port, where the debugger runs.
     */
    readonly port?: number;
}

const KEY_DEV_TOOLS_PAGE = 'lastDevToolsPage';

/** @inheritdoc */
export async function execute(context: deploy_targets.TargetOperationExecutionContext<DevToolsTargetOperation>) {
    const OPERATION = context.operation;
    const TARGET = context.target;
    const WORKSPACE = TARGET.__workspace;

    const ALWAYS_ASK_FOR_PAGE = deploy_helpers.toBooleanSafe(OPERATION.alwaysAskForPage);
    const PAGES = deploy_helpers.toStringSafe( OPERATION.pages );

    let sendCallback: deploy_helpers.SendToBrowserItemCallback;
    if (deploy_helpers.toBooleanSafe(OPERATION.debug, true)) {
        sendCallback = async (msg) => {
            if (_.isNil(msg)) {
                return;
            }

            const LOG_TAG = 'targets.operations.devtools.execute(sendCallback)';

            let msgJson: string;
            try {
                msgJson = JSON.stringify(msg, null, 2);
            } catch { }

            if (!deploy_helpers.isEmptyString(msgJson)) {
                WORKSPACE.output.appendLine('');
                WORKSPACE.output.appendLine(
                    msgJson
                );

                if (!_.isNil(msg.error)) {
                    WORKSPACE.logger
                             .err(msgJson, LOG_TAG);
                } else {
                    WORKSPACE.logger
                             .info(msgJson, LOG_TAG);
                }    
            }
        };
    }
    
    let params = deploy_helpers.cloneObject( OPERATION.parameters );

    let method = deploy_helpers.toStringSafe( OPERATION.method ).trim();
    if ('' === method) {
        method = 'Page.reload';

        if (_.isNil(params)) {
            params = {
                ignoreCache: true,
            };
        }
    }

    let pageFilter: false | RegExp = false;
    if ('' !== PAGES.trim()) {
        pageFilter = new RegExp(PAGES, 'i');
    }

    const CLIENT = deploy_helpers.createDevToolsClient({
        host: OPERATION.host,
        port: OPERATION.port,
    });
    try {
        const PAGES = await CLIENT.getPages();

        const LAST_SELECTED_PAGE: string = WORKSPACE.vars[KEY_DEV_TOOLS_PAGE];

        const QUICK_PICKS: deploy_contracts.ActionQuickPick[] =
            deploy_helpers.from(
            PAGES.map((p, i) => {
                let title = deploy_helpers.toStringSafe(p.title).trim();
                if ('' === title) {
                    title = WORKSPACE.t('targets.operations.devTools.pages.defaultTitle',
                                        i + 1);
                }

                let description = deploy_helpers.toStringSafe(p.description).trim();

                return {
                    action: async () => {
                        if (!(await p.connect())) {
                            throw new Error(
                                WORKSPACE.t('targets.operations.devTools.errors.couldNotConnectTo',
                                            p.socketUri)
                            );
                        }

                        try {
                            await p.send(method, params,
                                         sendCallback);

                            WORKSPACE.vars[KEY_DEV_TOOLS_PAGE] = p.id;                        
                        } finally {
                            try {
                                p.close();
                            } catch { }
                        }
                    },
                    description: description,
                    detail: p.socketUri,
                    label: title,
                    state: p,
                };
            })
        ).where(x => {
            if (false !== pageFilter) {
                return pageFilter.test(
                    deploy_helpers.toStringSafe(x.state.title)
                );
            }

            return true;
        }).orderBy(x => {
            return LAST_SELECTED_PAGE === x.state.id ? 0 : 1;
        }).thenBy(x => {
            return deploy_helpers.normalizeString(x.label);
        }).toArray();

        if (QUICK_PICKS.length < 1) {
            return;
        }

        let selectedItem = deploy_helpers.from(QUICK_PICKS)
                                         .firstOrDefault(x => x.state.id === LAST_SELECTED_PAGE, false);
        if (ALWAYS_ASK_FOR_PAGE || (false === selectedItem)) {
            delete WORKSPACE.vars[KEY_DEV_TOOLS_PAGE];

            if (1 === QUICK_PICKS.length) {
                selectedItem = QUICK_PICKS[0];
            } else {
                selectedItem = await vscode.window.showQuickPick(
                    QUICK_PICKS, {
                        canPickMany: false,
                        placeHolder: WORKSPACE.t('targets.operations.devTools.pages.selectPage'),
                    }
                );
            }
        }

        if (selectedItem) {
            await selectedItem.action();
        }
    } finally {
        deploy_helpers.tryDispose( CLIENT );
    }
}
