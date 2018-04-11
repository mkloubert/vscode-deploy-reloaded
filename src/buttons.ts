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
import * as deploy_workspaces from './workspaces';
import * as vscode from 'vscode';


/**
 * Describes a button, which can (de-)activate an auto deploy operation.
 */
export interface AutoDeployButton extends deploy_contracts.Button {    
}

/**
 * Description for a global button.
 */
export interface Button extends deploy_contracts.ButtonWithCustomCommand {
    /**
     * One or more arguments for the underlying command of that button.
     */
    readonly arguments?: any[];
}

/**
 * Describes a button that should be shown to actiovate or deactivate "deploy on change" feature.
 */
export interface DeployOnChangeButton extends AutoDeployButton {    
}

/**
 * A value for a "deploy on change" button.
 */
export type DeployOnChangeButtonValue = boolean | DeployOnChangeButton;

/**
 * Describes a button that should be shown to actiovate or deactivate "deploy on save" feature.
 */
export interface DeployOnSaveButton extends AutoDeployButton {    
}

/**
 * A value for a "deploy on save" button.
 */
export type DeployOnSaveButtonValue = boolean | DeployOnSaveButton;

interface FinishedButton extends vscode.Disposable {
    readonly button: vscode.StatusBarItem;
    readonly command: vscode.Disposable;
}

interface GlobalButton extends vscode.Disposable {
    readonly button: vscode.StatusBarItem;    
    readonly command: vscode.Disposable;
}

/**
 * Describes a button that should be shown to actiovate or deactivate "remove on change" feature.
 */
export interface RemoveOnChangeButton extends AutoDeployButton {    
}

/**
 * A value for a "remove on change" button.
 */
export type RemoveOnChangeButtonValue = boolean | RemoveOnChangeButton;


const KEY_FINISHED_BTNS = 'finished_buttons';
const KEY_FINISHED_BTN_DELETE = 'finish_delete';
const KEY_FINISHED_BTN_DEPLOY = 'finish_deploy';
const KEY_FINISHED_BTN_PULL = 'finish_pull';
let nextFinishedBtnIds = Number.MIN_SAFE_INTEGER;
let nextGlobalBtnId = Number.MIN_SAFE_INTEGER;

function createFinishedButton(state: deploy_contracts.KeyValuePairs, key: string, id: number): FinishedButton {
    const WORKSPACE: deploy_workspaces.Workspace = this;

    let btn: vscode.StatusBarItem;
    let cmd: vscode.Disposable;
    try {
        btn = vscode.window.createStatusBarItem();
        btn.hide();

        const CMD_ID = `extension.deploy.reloaded.buttons.finishedButtons.${key}${id}`;
        cmd = vscode.commands.registerCommand(CMD_ID, () => {
            WORKSPACE.output.show();

            btn.hide();
        });

        btn.command = CMD_ID;
    }
    catch (e) {
        deploy_helpers.tryDispose(btn);
        deploy_helpers.tryDispose(cmd);

        throw e;
    }

    return {
        button: btn,
        command: cmd,
        dispose: function() {
            const BUTTONS = state['buttons'];

            let timeouts: deploy_contracts.KeyValuePairs;
            if (state['timeouts']) {
                timeouts = state['timeouts'][ KEY_FINISHED_BTNS ];
            }

            deploy_helpers.tryDispose( this.button );
            deploy_helpers.tryDispose( this.command );

            if (BUTTONS) {
                delete BUTTONS[key];
            }

            deploy_helpers.tryDisposeAndDelete(timeouts, key);
        }
    };
}

/**
 * Disposes all global buttons of the underlying workspace.
 */
export function disposeButtons() {
    const WORKSPACE: deploy_workspaces.Workspace = this;

    const STATE = WORKSPACE.workspaceSessionState;
    if (!STATE) {
        return;
    }

    const BUTTONS: deploy_contracts.KeyValuePairs = STATE['buttons'];
    if (!BUTTONS) {
        return;
    }

    const GLOBAL_BUTTONS: GlobalButton[] = deploy_helpers.asArray( BUTTONS['global'] );
    for (const GB of GLOBAL_BUTTONS) {
        deploy_helpers.tryDispose(GB);
    }

    delete BUTTONS['global'];
}

/**
 * Disposes the "finished buttons" of the underlying workspace.
 */
export function disposeFinishedButtons() {
    const WORKSPACE: deploy_workspaces.Workspace = this;

    const STATE = WORKSPACE.workspaceSessionState;
    if (!STATE) {
        return;
    }

    const BUTTONS = STATE['buttons'];
    if (!BUTTONS) {
        return;
    }        

    const KEYS = [
        KEY_FINISHED_BTN_DEPLOY,
        KEY_FINISHED_BTN_PULL,
        KEY_FINISHED_BTN_DELETE,
    ];

    for (const K of KEYS) {
        deploy_helpers.tryDispose(BUTTONS[ K ]);
    }
}

/**
 * Returns a status bar button of the underlying workspace, that shows if a deploy operation has been finished.
 * 
 * @param {deploy_contracts.DeployOperation} operation The operation type.
 * 
 * @return {vscode.StatusBarItem} The button.
 */
export function getFinishedButton(operation: deploy_contracts.DeployOperation): vscode.StatusBarItem {
    const WORKSPACE: deploy_workspaces.Workspace = this;

    const STATE = WORKSPACE.workspaceSessionState;
    if (STATE) {
        const BUTTONS = STATE['buttons'];
        if (BUTTONS) {
            let btn: FinishedButton;

            switch (operation) {
                case deploy_contracts.DeployOperation.Deploy:
                    btn = BUTTONS[ KEY_FINISHED_BTN_DEPLOY ];
                    break;

                case deploy_contracts.DeployOperation.Pull:
                    btn = BUTTONS[ KEY_FINISHED_BTN_PULL ];
                    break;

                case deploy_contracts.DeployOperation.Delete:
                    btn = BUTTONS[ KEY_FINISHED_BTN_DELETE ];
                    break;
            }

            if (btn) {
                return btn.button;
            }
        }
    }
}

/**
 * Initializes the "finished button" for the underlying workspace.
 * 
 * @param {deploy_contracts.KeyValuePairs} state The new session state object of the workspace.
 */
export function initFinishedButtons(state: deploy_contracts.KeyValuePairs) {
    const WORKSPACE: deploy_workspaces.Workspace = this;

    const ID = nextFinishedBtnIds++;

    // dispose old
    deploy_helpers.applyFuncFor(
        disposeFinishedButtons, WORKSPACE
    )();

    state['timeouts'][ KEY_FINISHED_BTNS ] = {};

    // deploy
    state['buttons'][KEY_FINISHED_BTN_DEPLOY] = deploy_helpers.applyFuncFor(
        createFinishedButton, WORKSPACE,
    )(state, KEY_FINISHED_BTN_DEPLOY, ID);

    // delete
    state['buttons'][KEY_FINISHED_BTN_DELETE] = deploy_helpers.applyFuncFor(
        createFinishedButton, WORKSPACE,
    )(state, KEY_FINISHED_BTN_DELETE, ID);

    // pull
    state['buttons'][KEY_FINISHED_BTN_PULL] = deploy_helpers.applyFuncFor(
        createFinishedButton, WORKSPACE,
    )(state, KEY_FINISHED_BTN_PULL, ID);
}

/**
 * Reloads global buttons for the underlying workspace.
 */
export async function reloadButtons() {
    const WORKSPACE: deploy_workspaces.Workspace = this;

    const CFG = WORKSPACE.config;
    if (!CFG) {
        return;
    }

    const STATE = WORKSPACE.workspaceSessionState;
    if (!STATE) {
        return;
    }

    let buttons = STATE['buttons'];
    if (!buttons) {
        STATE['buttons'] = buttons = {};
    }

    const NEW_BUTTONS: GlobalButton[] = [];

    await deploy_helpers.forEachAsync(deploy_helpers.asArray(CFG.buttons), async (b, i) => {
        if (!deploy_helpers.toBooleanSafe(b.enabled, true)) {
            return;
        }

        const ID = nextGlobalBtnId++;

        let btn: vscode.StatusBarItem;
        let cmd: vscode.Disposable;
        try {
            btn = await deploy_helpers.createButton(b, async (nb, btnDesc) => {
                const REAL_CMD = deploy_helpers.toStringSafe(btnDesc.command).trim();

                nb.text = WORKSPACE.replaceWithValues(btnDesc.text);
                if (deploy_helpers.isEmptyString(nb.text)) {
                    nb.text = REAL_CMD;
                }

                nb.tooltip = WORKSPACE.replaceWithValues(btnDesc.tooltip);
                if (deploy_helpers.isEmptyString(nb.tooltip)) {
                    nb.tooltip = undefined;
                }

                const GET_ARGUMENTS = async () => {
                    return deploy_helpers.asArray( btnDesc.arguments, false );
                };

                const BTN_CMD_ID = `extension.deploy.reloaded.buttons.globalButtons${ID}`;
                cmd = vscode.commands.registerCommand(BTN_CMD_ID, async function() {
                    try {
                        return await Promise.resolve(
                            vscode.commands.executeCommand
                                           .apply(null, [ <any>REAL_CMD ].concat( await GET_ARGUMENTS() )),
                        );
                    }
                    catch (e) {
                        deploy_log.CONSOLE
                                  .trace(e, `${BTN_CMD_ID}(${i}.'${REAL_CMD}')`);

                        WORKSPACE.showErrorMessage(
                            WORKSPACE.t('error', e)
                        );
                    }
                });

                nb.command = BTN_CMD_ID;
            });

            NEW_BUTTONS.push({
                button: btn,
                command: cmd,
                dispose: function() {
                    deploy_helpers.tryDispose( this.button );
                    deploy_helpers.tryDispose( this.command );
                }
            });

            btn.show();
        }
        catch (e) {
            deploy_helpers.tryDispose( btn );
            deploy_helpers.tryDispose( cmd );

            deploy_log.CONSOLE
                      .trace(e, 'buttons.reloadButtons(1)');
        }
    });

    buttons['global'] = NEW_BUTTONS;
}

/**
 * Sets a timeout for a "finished button" of the underlying workspace.
 * 
 * @param {deploy_contracts.DeployOperation} operation The type of deploy operation.
 * @param {Function} callback The callback.
 * @param {number} [ms] The custom number of milliseconds.
 * 
 * @return {boolean} Operation was successful or not.
 */
export function setTimeoutForFinishedButton(
    operation: deploy_contracts.DeployOperation,
    callback: (btn: vscode.StatusBarItem) => any,
    ms = 60000,
) {
    const WORKSPACE: deploy_workspaces.Workspace = this;

    const STATE = WORKSPACE.workspaceSessionState;
    if (STATE) {
        let timeouts: deploy_contracts.KeyValuePairs;
        if (STATE['timeouts']) {
            timeouts = STATE['timeouts'][ KEY_FINISHED_BTNS ];
        }

        if (timeouts) {
            let key: string | false = false;

            switch (operation) {
                case deploy_contracts.DeployOperation.Deploy:
                    key = KEY_FINISHED_BTN_DEPLOY;
                    break;

                case deploy_contracts.DeployOperation.Pull:
                    key = KEY_FINISHED_BTN_PULL;
                    break;

                case deploy_contracts.DeployOperation.Delete:
                    key = KEY_FINISHED_BTN_DELETE;
                    break;
            }

            if (false !== key) {
                deploy_helpers.tryDisposeAndDelete(timeouts, key);

                const BTN = deploy_helpers.applyFuncFor(
                    getFinishedButton, WORKSPACE
                )(operation);

                if (BTN) {
                    timeouts[key] = deploy_helpers.createTimeout(() => {
                        try {
                            if (callback) {
                                Promise.resolve( callback(BTN) ).then(() => {                                    
                                }, (err) => {
                                    WORKSPACE.logger
                                             .trace(err, 'buttons.setTimeoutForFinishedButton(2)');
                                });
                            }
                        }
                        catch (e) {
                            WORKSPACE.logger
                                     .trace(e, 'buttons.setTimeoutForFinishedButton(1)');
                        }
                    }, ms);

                    return true;
                }
            }
        }
    }

    return false;
}
