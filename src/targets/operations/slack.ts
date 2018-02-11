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

import * as deploy_helpers from '../../helpers';
import * as deploy_targets from '../../targets';
import * as Enumerable from 'node-enumerable';
const Slack = require('@slack/client');


/**
 * An operation that send a message to one or more slack channels.
 */
export interface SlackTargetOperation extends deploy_targets.TargetOperation {
    /**
     * The IDs of one or more channels.
     */
    readonly channels: string | string[];
    /**
     * The minimum number of handled files before a notification is send.
     */
    readonly minimumNumberOfFiles?: number;
    /**
     * The API token.
     */
    readonly token: string;
    /**
     * The optional username that sends the notifications.
     */
    readonly user?: string;
}


/** @inheritdoc */
export async function execute(context: deploy_targets.TargetOperationExecutionContext<SlackTargetOperation>) {
    const OPERATION = context.operation;
    const WORKSPACE = context.target.__workspace;

    const CHANNELS = Enumerable.from( deploy_helpers.asArray(OPERATION.channels) ).select(c => {
        return deploy_helpers.toStringSafe(
            WORKSPACE.replaceWithValues(c)
        ).toUpperCase()
         .trim();
    }).where(c => '' !== c)
      .distinct()
      .toArray();

    const TARGET_NAME = deploy_targets.getTargetName(context.target);

    const TOKEN = deploy_helpers.toStringSafe(
        WORKSPACE.replaceWithValues(OPERATION.token)
    ).trim();

    const USER = deploy_helpers.normalizeString(
        WORKSPACE.replaceWithValues(OPERATION.user)
    );

    let minimumNumberOfFiles = parseInt(
        deploy_helpers.toStringSafe(
            OPERATION.minimumNumberOfFiles
        ).trim()
    );
    if (isNaN(minimumNumberOfFiles)) {
        minimumNumberOfFiles = 1;
    }

    if (context.files.length < minimumNumberOfFiles) {
        return;
    }

    let msg = '';
    switch (context.event) {
        case deploy_targets.TargetOperationEvent.AfterDeleted:
            msg = `The following files have been deleted in '${TARGET_NAME}'`;
            break;
        case deploy_targets.TargetOperationEvent.AfterDeployed:
            msg = `The following files have been deployed to '${TARGET_NAME}'`;
            break;
        
        case deploy_targets.TargetOperationEvent.BeforeDelete:
            msg = `The following files are going to be deleted in '${TARGET_NAME}'`;
            break;

        case deploy_targets.TargetOperationEvent.BeforeDeploy:
            msg = `The following files are going to be deployed to '${TARGET_NAME}'`;
            break;
    }

    if ('' !== USER) {
        msg += ' by @' + USER;
    }

    msg += ":\n" + Enumerable.from(context.files)
                             .select(f => {
                                 return '• ' + f;
                             })
                             .orderBy(f => f.length)
                             .thenBy(f => deploy_helpers.normalizeString(f))
                             .joinToString("\n");

    if (msg.length > 4000) {
        msg = msg.substr(0, 4000);  // too big => cut
    }

    msg = msg.trim();
    if ('' === msg) {
        return;
    }

    for (const C of CHANNELS) {
        const CLIENT = new Slack.WebClient(TOKEN);

        await CLIENT.chat.postMessage(C, msg, {
            link_names: true,
            mrkdwn: true,
            parse: 'full',
        });
    }
}
