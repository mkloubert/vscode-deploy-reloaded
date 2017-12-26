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
    // START: footer.html
    "footer.html": new Buffer("H4sIAAAAAAAAClNQUFDg5VKAApvi5KLMghKFksqCVFulktSKEv2sxLJEiKiSHS8XL5e+lkJYsLO/i6uui2uAj3+kbpCrj7+ji6uLQnFRsq0SQrk+hNLLKlZS0NIHaYXbApWygwjZ6Cflp1QCOTb6GSW5OXYAfyZrJ5MAAAA=", 'base64'),
    // END: footer.html

    // START: header.html
    "header.html": new Buffer("H4sIAAAAAAAACsVTbWvbMBD+Pth/UA3DchrJaQih0KQQYg8GgXR9g34qiqzW8mTJky5hZuS/T7bTNR0dy6BQgznf+e557rmTJkfJcn59d5GiHEp1/vHDZGeRfya5YNnuu/VLAQzxnFknYBrcXH8mp4H/v5fhoFYCQV2JaQDiB8TcuS4l7qHbq/kySUmSXiyWd+QyXSxnSZogZ/k08HlxrqhlUjnOHDjaVKJe/AI+bvHfkLItPpyKW1nBPlfBNqyLdpQPa81BGo02jmf2fjUeJYKbTNxo2RjswEboZwdpBaytRlmXcPllbsrKaKEBz6xlNa2sAdNw0ZJVlDOlMAOzajH66IkJ89+Ae6DhpxAdIxwOBo3ltFna3NPMAA8iCuYKrNSP+GQcRdQpyQUmw6hD2Ua0MFLjMIx8ZPvHUFqtL6dyRAjK5WOu/Au0cIiQ8/8amtgwhbuKv4ztH5t8BoyfG6kY/+a7CdCDsSXz53XFnBiP+oUzutm2FxedHaau+LoWtn5XXcX3pgUypEM6oqXUByhreF9V17m7y71zVyarvfcLA0j+EBAEAAA=", 'base64'),
    // END: header.html

};


/**
 * A possible value for a repository key.
 */
export type RepositoryKey = "footer.html" | "header.html";


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
