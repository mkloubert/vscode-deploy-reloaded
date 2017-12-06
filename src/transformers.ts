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

import * as Crypto from 'crypto';
import * as deploy_contracts from './contracts';
import * as deploy_helpers from './helpers';


/**
 * An object that can transform data.
 */
export interface CanTransformData {
    /**
     * The path (or URI) to the transformer script.
     */
    readonly transformer?: string;
    /**
     * The options for the transformer script.
     */
    readonly transformerOptions?: any;
}

/**
 * A data transformer.
 * 
 * @param {Buffer} input The untransformed data.
 * 
 * @return {DataTransformerResult} The transformed data.
 */
export type DataTransformer = (input: Buffer, context: DataTransformerContext) => DataTransformerResult;

/**
 * A data transformer context.
 */
export interface DataTransformerContext extends deploy_contracts.ScriptArguments {
    /**
     * The sub context.
     */
    readonly context?: any;
    /**
     * The mode.
     */
    readonly mode: DataTransformerMode;
}

/**
 * A possible result of a data transformer.
 */
export type DataTransformerResult = Buffer | PromiseLike<Buffer>;

/**
 * The transformer mode.
 */
export enum DataTransformerMode {
    /**
     * Restore transformed data.
     */
    Restore = 0,
    /**
     * Transform UNtransformed data.
     */
    Transform = 1,
}

/**
 * A data transformer module.
 */
export interface DataTransformerModule {
    /**
     * The transformer.
     */
    readonly transform: DataTransformer;
}


/**
 * Creates wrapper for a data transformer for encrypting data by password.
 * 
 * @param {DataTransformer} baseTransformer The transformer to wrap.
 * @param {deploy_contracts.Encryptable} opts The options.
 * 
 * @return {DataTransformer} The wrapper.
 */
export function toPasswordTransformer(baseTransformer: DataTransformer, opts: deploy_contracts.Encryptable): DataTransformer {
    if (!opts) {
        opts = <any>{};
    }

    let pwd = deploy_helpers.toStringSafe(opts.encryptWith);

    let algo = deploy_helpers.normalizeString(opts.encryptBy);
    if ('' === algo) {
        algo = 'aes-256-ctr';
    }

    return async function(input: Buffer, context: DataTransformerContext) {
        if (!input) {
            return input;
        }

        let result = input;

        const INVOKE_TRANSFORMER_FOR = async (buff: Buffer) => {
            if (baseTransformer) {
                buff = await Promise.resolve(
                    baseTransformer(buff, context)
                );
            }

            return buff;
        };

        let invokeTransformer = true;

        if (result) {
            if ('' !== pwd) {
                invokeTransformer = false;

                switch (context.mode) {
                    case DataTransformerMode.Restore:
                        {
                            const DECIPHER = Crypto.createDecipher(algo, pwd);

                            // 1. UNcrypt
                            result = Buffer.concat([
                                DECIPHER.update(result),
                                DECIPHER.final()
                            ]);

                            // 2. UNtransform
                            result = await INVOKE_TRANSFORMER_FOR(result);
                        }
                        break;

                    case DataTransformerMode.Transform:
                        {
                            const CIPHER = Crypto.createCipher(algo, pwd);

                            // 1. transform
                            result = await INVOKE_TRANSFORMER_FOR(result);

                            // 2. crypt
                            result = Buffer.concat([
                                CIPHER.update(result),
                                CIPHER.final()
                            ]);
                        }
                        break;
                }
            }
        }

        if (invokeTransformer) {
            result = await INVOKE_TRANSFORMER_FOR(result);
        }

        return result;
    };
}
