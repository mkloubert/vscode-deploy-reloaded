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
 * A workflow builder.
 */
export interface IWorkflowBuilder<TPrev = any> {
    /**
     * Adds the next action to invoke.
     * 
     * @param {WorkflowAction<TPrev,TNext>} action The next action.
     * 
     * @chainable
     */
    next<TNext = any>(action: WorkflowAction<TPrev, TNext>): IWorkflowBuilder<TNext>;

    /**
     * Starts the workflow.
     * 
     * @param {any} [initialPrevValue] The initial 'previous value'.
     * 
     * @return {PromiseLike<TResult>} The promise with the result.
     */
    start<TResult = TPrev>(initialPrevValue?: any): PromiseLike<TResult>;
}

/**
 * The context of a workflow action.
 */
export interface IWorkflowActionContext {
    /**
     * The zero-based index of the current action.
     */
    readonly index: number;
    /**
     * Gets or sets the value for the custom result for 'IWorkflowBuilder.start()'.
     */
    result: any;
    /**
     * Gets or sets the value for the execution chain.
     */
    value: any;
}

/**
 * A workflow action.
 * 
 * @param {TPrev} prevValue The previous value.
 * @param {IWorkflowActionContext} context The current context.
 */
export type WorkflowAction<TPrev, TNext> = (prevValue: TPrev, context: IWorkflowActionContext) => TNext | PromiseLike<TNext>;


/**
 * A symbol that indicates that 'IWorkflowActionContext.result' will NOT be used
 * as result value of 'IWorkflowBuilder.start()'.
 */
export const NO_CUSTOM_RESULT = Symbol('NO_CUSTOM_RESULT');

class WorkflowBuilder implements IWorkflowBuilder {
    private readonly _ACTIONS: WorkflowAction<any, any>[] = [];
    private readonly _INITIAL_VALUE: any;

    constructor(initialValue?: any) {
        this._INITIAL_VALUE = initialValue;
    }

    public next(action: WorkflowAction<any, any>) {
        this._ACTIONS.push(action);

        return this;
    }
    
    public async start(initialPrevValue?: any): Promise<any> {
        let index = 0;
        let prevValue = initialPrevValue;
        let result: any = NO_CUSTOM_RESULT;
        let value = this._INITIAL_VALUE;
        while (index < this._ACTIONS.length) {
            const ACTION = this._ACTIONS[index];

            const CTX: IWorkflowActionContext = {
                index: index,
                result: result,
                value: value,
            };

            try {
                if (ACTION) {
                    prevValue = await Promise.resolve(
                        ACTION(prevValue, CTX)
                    );
                }
            }
            finally {
                value = CTX.value;
                result = CTX.result;

                ++index;
            }
        }

        return NO_CUSTOM_RESULT === result ? prevValue
                                           : result;
    }
}


/**
 * Starts building a workflows.
 * 
 * @param {any} initialValue The initial value for 'IWorkflowActionContext.value'.
 */
export function build(initialValue?: any): IWorkflowBuilder<any> {
    return new WorkflowBuilder(initialValue);
}
