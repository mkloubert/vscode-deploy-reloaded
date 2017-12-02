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
import * as Events from 'events';
import * as vscode from 'vscode';


/**
 * A disposable object.
 */
export abstract class DisposableBase extends Events.EventEmitter implements vscode.Disposable {
    /**
     * Stores disposable sub objects.
     */
    protected readonly _DISPOSABLES: vscode.Disposable[] = [];
    private _isDisposed = false;
    private _isDisposing = false;
    /**
     * Stores timers.
     */
    protected readonly _TIMERS: NodeJS.Timer[] = [];

    /**
     * Cleansup all timers.
     */
    protected cleanupTimers() {
        while (this._TIMERS.length > 0) {
            deploy_helpers.tryClearTimeout(
                this._TIMERS.shift()
            );
        }
    }

    /** @inheritdoc */
    public dispose() {
        if (this.isInFinalizeState) {
            return;
        }

        this._isDisposing = true;
        
        try {
            this.cleanupTimers();
            this.removeAllListeners();

            while (this._DISPOSABLES.length > 0) {
                deploy_helpers.tryDispose(
                    this._DISPOSABLES.shift()
                );
            }

            this.onDispose();

            this._isDisposed = true;
        }
        finally {
            this._isDisposing = false;
        }
    }

    /**
     * Gets if object has been disposed or not.
     */
    public get isDisposed() {
        return this._isDisposed;
    }

    /**
     * Gets if the 'dispose()' method is currently executed or not.
     */
    public get isDisposing() {
        return this._isDisposing;
    }

    /**
     * Gets if the object is disposed or currently disposing.
     */
    public get isInFinalizeState() {
        return this.isDisposed || this.isDisposing;
    }

    /**
     * Additional logic for the 'dispose()' method.
     */
    protected onDispose(): void {
    }
}