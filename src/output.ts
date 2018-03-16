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
import * as vscode from 'vscode';


/**
 * A channel writer.
 * 
 * @param {string} text The text to write.
 * @param {boolean} addNewLine Add new line or not.
 */
export type ChannelWriter = (context: ChannelWriterContext) => void;

/**
 * A context for a channel writer.
 */
export interface ChannelWriterContext {
    /**
     * Add new line or not.
     */
    readonly addNewLine: boolean;
    /**
     * The base channel.
     */
    readonly baseChannel: vscode.OutputChannel;
    /**
     * The text to write.
     */
    readonly text: string;
}


/**
 * A wrapper for an output channel.
 */
export class OutputChannelWrapper extends deploy_helpers.DisposableBase implements vscode.OutputChannel {
    private readonly _OWNS_CHANNEL: boolean;
    private readonly _WRITERS: ChannelWriter[] = [];

    /**
     * Initializes a new instance of that class.
     * 
     * @param {vscode.OutputChannel} baseChannel The base channel.
     * @param {boolean} [ownsChannel] Also dispose base channel or not.
     */
    public constructor(public readonly baseChannel: vscode.OutputChannel, ownsChannel?: boolean) {
        super();

        this._OWNS_CHANNEL = deploy_helpers.toBooleanSafe(ownsChannel);
    }

    /**
     * Adds a writer.
     * 
     * @param {ChannelWriter} writer The writer to add.
     * 
     * @chainable
     */
    public addWriter(writer: ChannelWriter): this {
        if (writer) {
            this._WRITERS.push(writer);
        }

        return this;
    }

    /** @inheritdoc */
    public append(value: any) {
        value = deploy_helpers.toStringSafe(value);

        this.invokeForBaseChannel(this.baseChannel.append,
                                  [ value ]);

        this.sendToWriters(value, false);
    }

    /** @inheritdoc */
    public appendLine(value: any) {
        value = deploy_helpers.toStringSafe(value);

        this.invokeForBaseChannel(this.baseChannel.appendLine,
                                  [ value ]);

        this.sendToWriters(value, true);
    }

    /** @inheritdoc */
    public clear() {
        this.invokeForBaseChannel(this.baseChannel.clear, arguments);
    }

    /** @inheritdoc */
    public hide() {
        this.invokeForBaseChannel(this.baseChannel.hide, arguments);
    }

    private invokeForBaseChannel<TResult = any>(method: (...args: any[]) => TResult, args?: IArguments | any[]): TResult {
        if (method) {
            return method.apply(
                this.baseChannel,
                args || []
            );
        }
    }

    /** @inheritdoc */
    public get name() {
        return this.baseChannel.name;
    }

    /** @inheritdoc */
    protected onDispose() {
        while (this._WRITERS.length > 0) {
            this._WRITERS.pop();
        }

        if (this._OWNS_CHANNEL) {
            this.invokeForBaseChannel(this.baseChannel.dispose, []);
        }
    }

    private sendToWriters(text: string, addNewLine: boolean) {
        if ('' === text) {
            return;
        }

        for (const WRITER of this._WRITERS) {
            try {
                WRITER({
                    addNewLine: addNewLine,
                    baseChannel: this.baseChannel,
                    text: text,
                });
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'output.OutputChannelWrapper.sendToWriters(1)');
            }
        }
    }

    /** @inheritdoc */
    public show() {
        this.invokeForBaseChannel(this.baseChannel.show, arguments);
    }
}
