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
    /**
     * The options.
     */
    readonly options?: any;
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
