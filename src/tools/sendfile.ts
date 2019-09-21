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
import * as deploy_log from '../log';
import * as i18 from '../i18';
import * as Path from 'path';
import * as Net from 'net';
const SanitizeFilename = require('sanitize-filename');
import * as SimpleSocket from 'node-simple-socket';
import * as vscode from 'vscode';


interface FileToSend {
    content: string;
    name: string;
}


/**
 * The ID of the command for closing the current server instance.
 */
export const CLOSE_SERVER_COMMAND = "extension.deploy.reloaded.receiveFile.closeServer";

const DEFAULT_PORT = 23979;
const LAST_PORT_KEY = "vscdrLastReceiveFileHostPort";
const LAST_REMOTE_ADDR_KEY = "vscdrLastSendFileRemoteAddress";
let server: Net.Server;
let serverButton: vscode.StatusBarItem;

/**
 * Closes the current server instance.
 */
export function closeServer() {
    const SERVER_TO_CLOSE = server;
    if (SERVER_TO_CLOSE) {
        try {
            SERVER_TO_CLOSE.close();
            deploy_helpers.tryDispose(serverButton);

            serverButton = null;
            server = null;
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'tools.sendFile.closeServer()');
        }
    }
}


/**
 * Starts receiving a file.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export async function receiveFile(context: vscode.ExtensionContext) {
    if (server) {
        return;
    }

    const LAST_PORT = deploy_helpers.toStringSafe(
        context.globalState.get(LAST_PORT_KEY)
    ).trim();
    
    const STR_PORT = await vscode.window.showInputBox({
        prompt: i18.t('tools.sendOrReceiveFile.receive.enterPort',
                      DEFAULT_PORT),
        value: LAST_PORT,
    });
    if (deploy_helpers.isNullOrUndefined(STR_PORT)) {
        return;
    }

    let port = parseInt(
        STR_PORT.trim()
    );
    if (isNaN(port)) {
        port = DEFAULT_PORT;
    }

    let errorShown = false;
    const SHOW_ERROR = (err: any) => {
        if (errorShown) {
            return;
        }
        errorShown = true;

        server = null;

        deploy_helpers.showErrorMessage(
            i18.t('tools.sendOrReceiveFile.receive.errors.startHostFailed', err),
        );
    };

    try {
        context.globalState.update(LAST_PORT_KEY, port).then(() => {
        }, (err) => {
            deploy_log.CONSOLE
                      .trace(err, "tools.sendfile.receiveFile('updateLastPort')");
        });

        serverButton = vscode.window.createStatusBarItem();
        serverButton.command = CLOSE_SERVER_COMMAND;
        serverButton.text = "Deploy Reloaded: " + i18.t('tools.sendOrReceiveFile.receive.button.text',
                                                        port);
        serverButton.tooltip = i18.t('tools.sendOrReceiveFile.receive.button.tooltip');
        serverButton.show();

        server = await SimpleSocket.listen(port, (err, remoteConnection) => {
            if (err) {
                closeServer();

                SHOW_ERROR(err);
                return;
            }

            let receiveErrorShown = false;
            const SHOW_RECEIVE_ERROR = (err: any) => {
                if (receiveErrorShown) {
                    return;
                }
                receiveErrorShown = true;

                deploy_helpers.showErrorMessage(
                    i18.t('tools.sendOrReceiveFile.receive.errors.couldNotReceiveFile',
                          err)
                );
            };

            try {
                remoteConnection.readJSON<FileToSend>().then((file) => {
                    try {
                        let fileName = deploy_helpers.toStringSafe(file.name);

                        let prefix: string;
                        let postfix: string;
                        if (!deploy_helpers.isEmptyString(fileName)) {
                            fileName = SanitizeFilename(fileName);

                            postfix = Path.extname(fileName);
                            prefix = Path.basename(fileName, postfix) + '-';
                        }

                        deploy_helpers.invokeForTempFile(async (tmpFile) => {
                            try {
                                await deploy_helpers.writeFile(
                                    tmpFile,
                                    new Buffer(
                                        deploy_helpers.toStringSafe(file.content),
                                        'utf8'
                                    )
                                );

                                const DOC = await vscode.workspace.openTextDocument(tmpFile);
                                await vscode.window.showTextDocument(DOC);

                                closeServer();
                            }
                            catch (e) {
                                SHOW_RECEIVE_ERROR(e);
                            }
                        }, {
                            keep: true,
                            prefix: prefix,
                            postfix: postfix,
                        }).then(() => {
                        }, (err) => {
                            SHOW_RECEIVE_ERROR(err);
                        });
                    }
                    catch (e) {
                        SHOW_RECEIVE_ERROR(e);
                    }
                }).catch((err) => {
                    closeServer();

                    SHOW_RECEIVE_ERROR(err);
                });
            }
            catch (e) {
                closeServer();

                SHOW_RECEIVE_ERROR(e);
            }
        });
    }
    catch (e) {
        closeServer();

        SHOW_ERROR(e);
    }
}

/**
 * Registers commands for these kind of tools.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export function registerSendFileCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        // receive file
        vscode.commands.registerCommand('extension.deploy.reloaded.receiveFile', async () => {
            try {
                await receiveFile(context);
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.receiveFile');

                deploy_helpers.showErrorMessage(
                    i18.t('tools.errors.operationFailed')
                );
            }
        }),

        // send file
        vscode.commands.registerCommand('extension.deploy.reloaded.sendFile', async () => {
            try {
                await sendFile(context);
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.sendFile');

                deploy_helpers.showErrorMessage(
                    i18.t('tools.errors.operationFailed')
                );
            }
        }),

        // close server instance that waits for a file
        vscode.commands.registerCommand(CLOSE_SERVER_COMMAND, () => {
            closeServer();
        }),
    );
}

/**
 * Sends a file.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export async function sendFile(context: vscode.ExtensionContext) {
    const ACTIVE_EDITOR = vscode.window.activeTextEditor;
    if (ACTIVE_EDITOR) {
        const DOC = ACTIVE_EDITOR.document;
        if (DOC) {
            try {
                const LAST_REMOTE_ADDR = deploy_helpers.normalizeString(
                    context.globalState.get(LAST_REMOTE_ADDR_KEY)
                );
                
                const REMOTE_ADDR = deploy_helpers.normalizeString(
                    await vscode.window.showInputBox({
                        prompt: i18.t('tools.sendOrReceiveFile.send.enterRemoteAddress'),
                        value: LAST_REMOTE_ADDR,
                    }),
                );
                if ('' === REMOTE_ADDR) {
                    return;
                }

                let host: string;
                let port: number;

                const SEP = REMOTE_ADDR.indexOf(':');
                if (SEP > -1) {
                    host = REMOTE_ADDR.substr(0, SEP);
                    port = parseInt(
                        REMOTE_ADDR.substr(SEP + 1).trim()
                    );
                }
                else {
                    host = REMOTE_ADDR;
                }

                host = deploy_helpers.normalizeString(host);
                if ('' === host) {
                    host = deploy_contracts.DEFAULT_HOST;
                }

                if (isNaN(port)) {
                    port = DEFAULT_PORT;
                }

                context.globalState.update(LAST_REMOTE_ADDR_KEY, `${host}:${port}`).then(() => {
                }, (err) => {
                    deploy_log.CONSOLE
                              .trace(err, "tools.sendfile.sendFile('updateLastRemoteAddress')");
                });

                let fileName = DOC.fileName;
                if (deploy_helpers.isEmptyString(fileName)) {
                    fileName = null;
                }
                else {
                    fileName = Path.basename(fileName);
                }

                const SOCKET = await SimpleSocket.connect(port, host);
                try {
                    const FILE: FileToSend = {
                        content: DOC.getText(),
                        name: fileName,
                    };
    
                    await SOCKET.writeJSON(FILE);
                }
                finally {
                    try {
                        SOCKET.end();
                    }
                    catch (e) {
                        deploy_log.CONSOLE
                                  .trace(e, "tools.sendfile.sendFile('closeSocket')");
                    }
                }
            }
            catch (e) {
                deploy_helpers.showErrorMessage(
                    i18.t('tools.sendOrReceiveFile.send.errors.couldNotSendFile',
                          e)
                );
            }
        }
        else {
            deploy_helpers.showWarningMessage(
                i18.t('editors.active.noOpen')
            );
        }
    }
    else {
        deploy_helpers.showWarningMessage(
            i18.t('editors.active.noOpen')
        );
    }
}

/**
 * Sends or receives a file.
 * 
 * @param {vscode.ExtensionContext} context The extension context.
 */
export async function sendOrReceiveFile(context: vscode.ExtensionContext) {
    const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = [
        {
            action: async () => {
                await sendFile(context);
            },
            label: '$(rocket)  ' + i18.t('tools.sendOrReceiveFile.send.label'),
            description: i18.t('tools.sendOrReceiveFile.send.description'),
        },
    ];

    if (!server) {
        // only if not started

        QUICK_PICKS.push(
            {
                action: async () => {
                    await receiveFile(context);
                },
                label: '$(briefcase)  ' + i18.t('tools.sendOrReceiveFile.receive.label'),
                description: i18.t('tools.sendOrReceiveFile.receive.description'),
            }
        );
    }

    const SELECTED_ITEM = await vscode.window.showQuickPick(
        QUICK_PICKS
    );
    if (!SELECTED_ITEM) {
        return;
    }

    await Promise.resolve(
        SELECTED_ITEM.action(),
    );
}
