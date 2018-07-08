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
import * as i18 from './i18';
import * as Moment from 'moment';
import * as vscode from 'vscode';


interface DisplayNotificationOptions {
    note: deploy_helpers.ExtensionNotification;
    onOKClick?: () => any;
    onLinkClick?: () => any;
    onRemindMeLaterClick?: () => any;
}

type ReadNotifications = { [id: string]: boolean };


const KEY_READ_NOTIFICATIONS = 'vscdrReadNotifications';


async function displayNotification(opts?: DisplayNotificationOptions) {
    if (_.isNil(opts)) {
        opts = <any>{};
    }

    const NOTE = opts.note;
    if (_.isNil(NOTE)) {
        return;
    }

    const CONTENT = deploy_helpers.toStringSafe(
        NOTE.content
    ).trim();
    if ('' === CONTENT) {
        return;
    }

    const MESSAGE_ITEMS: deploy_contracts.ActionMessageItem[] = [];

    if (!_.isNil(NOTE.link)) {
        const LINK = deploy_helpers.toStringSafe(NOTE.link.href).trim();
        if ('' !== LINK) {
            let linkText = deploy_helpers.toStringSafe(NOTE.link.text).trim();
            if ('' === linkText) {
                linkText = 'Open link ...';
            }

            MESSAGE_ITEMS.push({
                action: async () => {
                    deploy_helpers.open(LINK);

                    if (opts.onLinkClick) {
                        await Promise.resolve(
                            opts.onLinkClick()
                        );
                    }
                },
                title: linkText,
            });
        }
    }

    MESSAGE_ITEMS.push({
        action: async () => {
            if (opts.onOKClick) {
                await Promise.resolve(
                    opts.onOKClick()
                );
            }
        },
        isCloseAffordance: true,
        title: "OK",
    });

    MESSAGE_ITEMS.push({
        action: async () => {
            if (opts.onRemindMeLaterClick) {
                await Promise.resolve(
                    opts.onRemindMeLaterClick()
                );    
            }
        },
        title: 'Remind me later',
    });
    
    let popupFunc: Function;

    const TYPE = deploy_helpers.normalizeString(NOTE.type);
    switch (TYPE) {
        case 'e':
        case 'emerg':
        case 'emergency':
            popupFunc = vscode.window.showErrorMessage;
            break;

        case 'important':
        case 'w':
        case 'warn':
        case 'warning':
            popupFunc = vscode.window.showWarningMessage;
            break;

        default:
            popupFunc = vscode.window.showInformationMessage;
            break;
    }

    const SELECTED_ITEM: deploy_contracts.ActionMessageItem = await popupFunc.apply(
        null,
        [ <any>CONTENT ].concat( MESSAGE_ITEMS )
    );

    if (SELECTED_ITEM) {
        if (SELECTED_ITEM.action) {
            await Promise.resolve(
                SELECTED_ITEM.action(
                    SELECTED_ITEM
                )
            );
        }
    }
}

async function loadNotifications(packageFile?: deploy_helpers.PackageFile) {
    return deploy_helpers.filterExtensionNotifications(
        deploy_helpers.from(
            await deploy_helpers.getExtensionNotifications('https://mkloubert.github.io/notifications/vscode-deploy-reloaded.json')
        ).orderBy(x => {
            try {
                const NOTE_TIME = deploy_helpers.toStringSafe(x.time).trim();
                if ('' !== NOTE_TIME) {
                    const TIME = Moment.utc(NOTE_TIME);
                    if (TIME.isValid()) {
                        return TIME.unix();
                    }
                }
            } catch { }
    
            return Number.MIN_SAFE_INTEGER;
        }).toArray(),
        {
            version: packageFile ? packageFile.version
                                 : undefined,
        });
}

/**
 * Shows the notifications for that extension.
 *
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {deploy_helpers.PackageFile} [packageFile] The underlying package file.
 * @param {deploy_helpers.ExtensionNotification|deploy_helpers.ExtensionNotification[]} [notifications] Custom list of notifications.
 */
export async function showExtensionNotifications(
    context: vscode.ExtensionContext,
    packageFile?: deploy_helpers.PackageFile,
    notifications?: deploy_helpers.ExtensionNotification | deploy_helpers.ExtensionNotification[],
) {
    if (arguments.length < 3) {
        notifications = await loadNotifications(packageFile);
    } else {
        notifications = deploy_helpers.asArray(notifications);
    }

    await withReadNotificationsStorage(context, async (readNotifications) => {
        const GET_NOTE_ID = (note: deploy_helpers.ExtensionNotification) => {
            if (!_.isNil(note)) {
                return deploy_helpers.normalizeString( note.id );
            }
        };

        // cleanups
        _.forIn(readNotifications, (value, key) => {
            const ID = deploy_helpers.normalizeString( key );

            const EXISTS = deploy_helpers.from(
                <deploy_helpers.ExtensionNotification[]>notifications
            ).any(n => {
                return GET_NOTE_ID(n) === ID;
            });

            if (!EXISTS) {
                delete readNotifications[key];
            }
        });

        for (const NOTE of <deploy_helpers.ExtensionNotification[]>notifications) {
            try {
                const NOTE_ID = GET_NOTE_ID( NOTE );
                if ('' === NOTE_ID) {
                    continue;
                }

                if (true === readNotifications[NOTE_ID]) {
                    continue;
                }

                await displayNotification({
                    note: NOTE,
                    onLinkClick: () => {
                        readNotifications[NOTE_ID] = true; 
                    },
                    onOKClick: () => {
                        readNotifications[NOTE_ID] = true; 
                    },
                    onRemindMeLaterClick: () => {
                        delete readNotifications[NOTE_ID];
                    }
                });
            } catch { }
        }
    });

}

/**
 * Registers notification commands.
 *
 * @param {vscode.ExtensionContext} context The extension's context.
 * @param {deploy_helpers.PackageFile} packageFile The package file meta data.
 */
export function registerNotificationCommands(
    context: vscode.ExtensionContext,
    packageFile: deploy_helpers.PackageFile,
) {
    context.subscriptions.push(
        // show notification
        vscode.commands.registerCommand('extension.deploy.reloaded.showNotifications', async () => {
            try {
                let hasCancelled = false;

                const QUICK_PICKS: deploy_contracts.ActionQuickPick[] = await vscode.window.withProgress({
                    cancellable: true,
                    location: vscode.ProgressLocation.Notification,
                    title: i18.t('notifications.loading'),
                }, async (progress, cancelToken) => {
                    try {
                        let i = 0;

                        return (
                            deploy_helpers.from(
                                await loadNotifications(packageFile)
                            )
                        ).where(n => {
                            return !deploy_helpers.isEmptyString(n.content);
                        }).reverse().select((n) => {
                            let label = deploy_helpers.toStringSafe(n.title).trim();
                            if ('' === label) {
                                label = i18.t('notifications.defaultName',
                                              i + 1);
                            }

                            let detail: string;
                            try {
                                const NOTE_TIME = deploy_helpers.toStringSafe(n.time);
                                if ('' !== NOTE_TIME) {
                                    const TIME = deploy_helpers.asLocalTime(
                                        Moment.utc(NOTE_TIME)
                                    );

                                    if (TIME.isValid()) {
                                        detail = TIME.format( i18.t('time.dateTime') );
                                    }
                                }
                            } catch { }

                            return {
                                action: async () => {
                                    await displayNotification({
                                        note: n,
                                    });
                                },
                                label: label,
                                detail: detail,
                            };
                        }).toArray();
                    } finally {
                        hasCancelled = cancelToken.isCancellationRequested;
                    }
                });

                if (hasCancelled) {
                    return;
                }

                if (QUICK_PICKS.length < 1) {
                    vscode.window.showWarningMessage(
                        i18.t('notifications.noneFound')
                    );

                    return;
                }

                const SELECTED_ITEMS = deploy_helpers.asArray(
                    await vscode.window.showQuickPick(
                        QUICK_PICKS, {
                            canPickMany: true,
                            placeHolder: i18.t('notifications.selectNotifications'),
                        }
                    )
                );

                for (const SI of SELECTED_ITEMS) {
                    await SI.action();
                }
            } catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'extension.deploy.reloaded.showNotification');

                deploy_helpers.showErrorMessage(
                    i18.t('tools.errors.operationFailed')
                );
            }
        }),
    );
}

async function withReadNotificationsStorage<TResult = any>(
    context: vscode.ExtensionContext,
    action: (readNotifications: ReadNotifications) => TResult
) {
    let readNotifications: ReadNotifications | false;
    try {
        readNotifications = context.globalState
                                   .get<ReadNotifications>(KEY_READ_NOTIFICATIONS, null);
    } catch {
        readNotifications = false;
    }

    if (!readNotifications) {
        readNotifications = {};
    }

    try {
        if (action) {
            return await Promise.resolve(
                action(readNotifications)
            );
        }
    } finally {
        await context.globalState
                     .update(KEY_READ_NOTIFICATIONS, readNotifications);
    }
}
