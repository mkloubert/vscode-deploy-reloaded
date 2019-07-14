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
    "hl.railscasts.css": new Buffer("H4sIAAAAAAAACq1UwY6bMBC9R8o/WKoq7a6WLCSBAr320msP7bEa2wNxY+wUD5tEVf+9JttAbG3bS4WENI/33ozHMzw9LBfLxSdQ2glw5BKt9sgcnTWyO3HPPitnG3pkH41YsbsP0Ck07MtOEd6Pwoen8b3a6W+O/VguGJPKHTSca8a1Ffv3I2SfsW+0PSanmsFA9gIeQEpl2pqlqxy7C8RB7NveDkbW7M16Mz4XXFhtew9hgZkUHvo55UyE7To09HiNvw+W8KWSq4yLapuXF6fGGkouZ6uZItAqctvj+Wh7Obk51CjI9glBG5qKdbHepKHaUe9PNInN0HHsp7DHFk+HKXyGXgHXOAGEnW8c4fQlTAi5T5lFCQfuKKTlWdXkUV2++Lko6CJjLHlTQKQ4HyKWhG21qa6sqYBzx62ezPmgNdJNqDR9VSYElLkUMYFANDdJK7MPExeyEhzD8g7QQ+eiAlOZNk3IG60VH+KBEBLKogqpHRKErIqXeSWjvii6uTHnZ0NZE8qaRhRFJBtHfWbOY55cRdl2u87Wrw/7zUop4/uDybxZRyVpV7MsTd+GGaUf3L9mLNL0P6ab9kRocC7u47t00/yBr2RILnlVAg/Jfi924NRv23+tsF9Ca9ob7hFVuyP/P7I6upZ52AhP5HsmbA9j12rmW4X9ePoXxS/I9ITHJQUAAA==", 'base64'),
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
