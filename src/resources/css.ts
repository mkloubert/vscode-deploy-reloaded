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


/**
 * AUTO GENERATED CODE
 */

import * as deploy_helpers from '../helpers';
import * as deploy_resources from '../resources';
import * as ZLib from 'zlib';


const REPOSITORY = {
    // START: style.css
    "style.css": new Buffer("H4sIAAAAAAAACo1Q3crCMAy9H+wdAuKdg82/Qfc02RpssTal7fc5Ed/doJswvLFwoJyfnJCyMM0GzFawE+wFB8ER7mUB8gZHGBX0nE33ZrRNweFNOMfDeSIvGE/WV2LLfFHQbMM4KVersxGmrtfCPMqiLPAznB3L8Eh6Mmcac6Vp4IjZslfg2VMnwpxUhv8pzvkv+5/XFJ1dZDL2juZEz1Ecsk4YYdW2LSR2dm5/i1UKOFh/UlAvednWYUikIFFAqaRuUZH1Bqaf+akvoNavoqOoTf06mcx7AlJvfWSTAQAA", 'base64'),
    // END: style.css

    // START: hl.railscasts.css
    "hl.railscasts.css": new Buffer("H4sIAAAAAAAACq1UwW7bMAy9+ysEDAXaok7tJHZt97rLrjtsx4GSaEeLLGUS3SQY9u+Ts9qRi6KnISfSj++RT2Qe75PkKyjtBXjyqVZ7ZJ7OGtmtuGPflLctPbAvRqzY7WfoFRr2facI75Lk/jFJVjv907PfCWNS+YOGc8O4tmL/HDL2BV2r7TE9NQwGsmPuAFIq0zUsWxXYjxkOYt85OxjZsE/rzfgb08Jq60IGS8yleE7+vGqlwvY9Gnp4DX8NlvDSwFTBRb0tqpGjtYbSyzANUwRaxTx7PB+tkxOPR42CrEsJugWdWJfrTRYVenJhgqnODD1HN0UOOzwdpugFnAKucYoJ+2AR4fxhIQRFkMpjoYF7WkCKvG6LuJfQ7NwI9Es+rHhbQgw+H5YICdt6U18Qk+S551ZPlHzQGukaKU0/lFnEylyEpxwQzV5oZfYLuVLWgmPU0AEc9H7ZUiazto0wI6Piw5s3FhKqso5gPRIsEDWvilrG0yu6voQPb62sWVS0rSjLuGJc1Rl1XdN0Ksi323W+fm9Zo2tQJviA6XwURyVp17A8y24iKRm27yOpMsv+i8685UKD928Me8o27XtYJRfAitcV8AgYtnoHXv2j+/DmwulY011xR1TdjsJfhtWx8fPmEJ4oeCOsg9GdhgVP0I2Djui/3qezQLsEAAA=", 'base64'),
    // END: hl.railscasts.css

};


/**
 * A possible value for a repository key.
 */
export type RepositoryKey = "style.css" | "hl.railscasts.css";


/**
 * Tries to return content from 'REPOSITORY' constant.
 * 
 * @param {RepositoryKey} key The key inside the constant.
 * 
 * @return {Promise<Buffer>} The promise with the data (if available).
 */
export function getContent(key: RepositoryKey): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        let data: Buffer;

        for (const P in REPOSITORY) {
            if (P === key) {
                data = REPOSITORY[P];
                break;
            }
        }

        if (data) {
            ZLib.gunzip(data, (err, uncompressedData) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(uncompressedData);
                }
            });
        }
        else {
            resolve(data);
        }
    });
}

/**
 * Tries to return content from 'REPOSITORY' constant.
 * 
 * @param {RepositoryKey} key The key inside the constant.
 * 
 * @return Buffer The data (if available).
 */
export function getContentSync(key: RepositoryKey): Buffer {
    let data: Buffer;

    for (const P in REPOSITORY) {
        if (P === key) {
            data = REPOSITORY[P];
            break;
        }
    }

    if (data) {
        return ZLib.gunzipSync(data);
    }

    return data;
}

/**
 * Tries to return content from 'REPOSITORY' constant as string.
 * 
 * @param {RepositoryKey} key The key inside the constant.
 * @param {string} [enc] The encoding to use. Default: 'utf8'.
 * 
 * @return {Promise<string>} The promise with the data (if available).
 */
export async function getStringContent(key: RepositoryKey, enc?: string): Promise<string> {
    enc = deploy_helpers.normalizeString(enc);
    if ('' === enc) {
        enc = 'utf8';
    }

    const DATA = await getContent(key);
    if (DATA) {
        return deploy_resources.replaceTemplateVars(
            DATA.toString(enc)
        );
    }
}

/**
 * Tries to return content from 'REPOSITORY' constant as string.
 * 
 * @param {RepositoryKey} key The key inside the constant.
 * @param {string} [enc] The encoding to use. Default: 'utf8'.
 * 
 * @return {string} The data (if available).
 */
export function getStringContentSync(key: RepositoryKey, enc?: string): string {
    enc = deploy_helpers.normalizeString(enc);
    if ('' === enc) {
        enc = 'utf8';
    }

    const DATA = getContentSync(key);
    if (DATA) {
        return deploy_resources.replaceTemplateVars(
            DATA.toString(enc)
        );
    }
}
