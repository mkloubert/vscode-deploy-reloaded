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

import * as deploy_helpers from './helpers';
import * as deploy_log from './log';


const REGEX_TEMPLATE_VARS = /(\/\*)(\s+)(VSCODE)(\-)(DEPLOY)(\-)(RELOADED)(\s+)(src\=\")([^\"]*)(\")((\s+)(format\=\")([^\"]*)(\"))?(\s+)(\*\/)/ig;


/**
 * Replaces template variables with its linked content.
 * 
 * @param {any} src The content to parse.
 * 
 * @return {string} The parsed content. 
 */
export function replaceTemplateVars(src: any): string {
    if (!src) {
        return src;
    }

    src = deploy_helpers.toStringSafe(src);

    return src.replace(REGEX_TEMPLATE_VARS, function(match) {
        try {
            // src=""
            if (arguments.length > 10) {
                const SRC_ATTR = deploy_helpers.toStringSafe(arguments[10]).trim();
                
                const RES_MODULE = SRC_ATTR.substr(0, SRC_ATTR.indexOf('/'))
                                           .trim();
                const RES_NAME = SRC_ATTR.substr(SRC_ATTR.indexOf('/') + 1)
                                        .trim();

                let strContent = require(`./resources/${RES_MODULE}`).getStringContentSync(RES_NAME);

                // format=""
                if ('undefined' !== typeof arguments[15]) {
                    deploy_helpers.toStringSafe(arguments[15]).split(',').forEach(e => {
                        e = deploy_helpers.normalizeString(e);
                        if ('' !== e) {
                            switch (e) {
                                case 'base64':
                                    strContent = (new Buffer(strContent, 'utf8')).toString('base64');
                                    break;

                                case 'json':
                                    strContent = JSON.stringify( strContent );
                                    break;

                                default:
                                    throw new Error(`'${e}' formatter not supported!`);
                            }
                        } 
                    });
                }

                return strContent;
            }
        }
        catch (e) {
            deploy_log.CONSOLE
                      .trace(e, 'resources.replaceTemplateVars()');
        }

        return match;
    });
}
