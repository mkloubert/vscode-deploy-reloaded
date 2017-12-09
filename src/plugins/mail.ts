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

import * as deploy_helpers from '../helpers';
import * as deploy_plugins from '../plugins';
import * as deploy_targets from '../targets';
import * as Enumerable from 'node-enumerable';
import * as Mailer from 'nodemailer';
import * as Moment from 'moment';
import * as SanitizeFilename from 'sanitize-filename';
const Zip = require('node-zip');


/**
 * A 'mail' target.
 */
export interface MailTarget extends deploy_targets.Target {
    /**
     * The address that sends the mail.
     */
    readonly from: string;
    /**
     * The address of the SMTP host.
     */
    readonly host?: string;
    /**
     * Ignore TLS or not.
     */
    readonly ignoreTLS?: boolean;
    /**
     * The password for the authentication.
     */
    readonly password?: string;
    /**
     * The custom TCP port of the SMTP host.
     */
    readonly port?: number;
    /**
     * Reject unauthorized TLS or not.
     */
    readonly rejectUnauthorized?: boolean;
    /**
     * SMTP requires TLS or not.
     */
    readonly requireTLS?: boolean;
    /**
     * Use secure connection or not.
     */
    readonly secure?: boolean;
    /**
     * The list of email addresses to send the file(s) to.
     */
    readonly to: string | string[];
    /**
     * The user for the authentication.
     */
    readonly user?: string;
}


class MailPlugin extends deploy_plugins.PluginBase<MailTarget> {
    private sendMail(transporter: Mailer.Transporter, opts: Mailer.SendMailOptions): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const COMPLETED = deploy_helpers.createCompletedAction(resolve, reject);

            try {
                transporter.sendMail(opts, (err, info) => {
                    if (err) {
                        COMPLETED(err);
                    }
                    else {
                        COMPLETED(null, info);
                    }
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }

    public async uploadFiles(context: deploy_plugins.UploadContext<MailTarget>) {
        const TARGET = context.target;

        const NOW_UTC = Moment.utc();

        let workspaceName = deploy_helpers.normalizeString(TARGET.__workspace.name);
        if (workspaceName.length > 32) {
            workspaceName = workspaceName.substr(0, 32).trim();
        }

        if (deploy_helpers.isEmptyString(workspaceName)) {
            workspaceName = '';
        }
        else {
            workspaceName = `_${workspaceName}`;
        }

        const ZIPFile = new Zip();
        const ZIPFilename = SanitizeFilename(
            `vscode-ws${workspaceName}_${NOW_UTC.format('YYYYMMDD-HHmmss')}.zip`
        );

        let from = deploy_helpers.normalizeString(
            this.replaceWithValues(TARGET, TARGET.from)
        );
        if ('' === from) {
            from = undefined;
        }

        const TO = Enumerable.from( deploy_helpers.asArray(TARGET.to) ).selectMany(t => {
            return deploy_helpers.toStringSafe(t)
                                 .split(',');
        }).select(t => deploy_helpers.normalizeString(t))
          .where(t => '' !== t)
          .toArray();

        const IS_SECURE = deploy_helpers.toBooleanSafe(TARGET.secure, true);

        const IGNORE_TLS = deploy_helpers.toBooleanSafe(TARGET.ignoreTLS);
        const REQUIRE_TOLS = deploy_helpers.toBooleanSafe(TARGET.requireTLS);

        const REJECT_UNAUTHORIZED = deploy_helpers.toBooleanSafe(TARGET.rejectUnauthorized);

        let host = deploy_helpers.normalizeString(
            this.replaceWithValues(TARGET, TARGET.host)
        );
        if ('' === host) {
            host = '127.0.0.1';
        }

        let port = parseInt(
            deploy_helpers.toStringSafe(
                this.replaceWithValues(TARGET, TARGET.port)
            ).trim()
        );
        if (isNaN(port)) {
            if (IS_SECURE) {
                port = REQUIRE_TOLS ? 587 : 465;
            }
            else {
                port = 25;
            }
        }

        let auth: any;
        let user = deploy_helpers.toStringSafe(
            this.replaceWithValues(TARGET, TARGET.user)
        );
        if (!deploy_helpers.isEmptyString(user)) {
            let password = deploy_helpers.toStringSafe(TARGET.password);
            if ('' === password) {
                password = undefined;
            }

            auth = {
                user: user,
                pass: password,
            };
        }

        const ZIPPED_DATA = new Buffer(ZIPFile.generate({
            base64: false,
            compression: 'DEFLATE',
        }), 'binary');

        //TODO: translate
        const MAIL_OPTS: Mailer.SendMailOptions = {
            from: from,
            to: TO,
            subject: 'Deployed files',
            text: `Your deployed files (s. attachment).


Send by 'Deploy Reloaded' (vscode-deploy-reloaded) Visual Studio Code extension:
https://github.com/mkloubert/vscode-deploy-reloaded`,
            attachments: [
                {
                    filename: ZIPFilename,
                    content: ZIPPED_DATA,
                }
            ]
        };

        const TRANSPORTER = Mailer.createTransport({
            host: host,
            port: port,
            auth: auth,
            secure: IS_SECURE,
            ignoreTLS: IGNORE_TLS,
            requireTLS: REQUIRE_TOLS,
            tls: {
                rejectUnauthorized: REJECT_UNAUTHORIZED,
            },
        });

        for (const F of context.files) {
            if (context.isCancelling) {
                return;
            }

            try {
                await F.onBeforeUpload(TO.join(', '));

                ZIPFile.file(deploy_helpers.normalizePath(F.path + '/' + F.name),
                             await F.read());

                await F.onUploadCompleted();
            }
            catch (e) {
                await F.onUploadCompleted(e);
            }
        }

        await this.sendMail(TRANSPORTER, MAIL_OPTS);
    }
}

/**
 * Creates a new instance of that plugin.
 * 
 * @param {deploy_plugins.PluginContext} context The context for the plugin.
 * 
 * @return {deploy_plugins.Plugin} The new plugin.
 */
export function createPlugins(context: deploy_plugins.PluginContext) {
    return new MailPlugin(context);
}
