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

import * as _ from 'lodash';
import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as deploy_res_html from './resources/html';
import * as Marked from 'marked';
const MergeDeep = require('merge-deep');
import * as vscode from 'vscode';


/**
 * Options for openting a Markdown document.
 */
export interface MarkdownDocumentOptions extends Marked.MarkedOptions {
    /**
     * Custom CSS.
     */
    readonly css?: string;
    /**
     * Custom document ID.
     */
    readonly documentId?: any;
    /**
     * Custom document title.
     */
    readonly documentTitle?: string;
}

/**
 * Object for handling a WebView.
 */
export interface WebView extends vscode.Disposable {
    /**
     * The panel.
     */
    readonly panel: vscode.WebviewPanel;
    /**
     * Posts a message to the view.
     * 
     * @param {any} msg The message to post.
     * 
     * @return {PromiseLike<boolean>} Operation was successful or not.
     */
    readonly postMessage: (msg: any) => PromiseLike<boolean>;
    /**
     * The view.
     */
    readonly view: vscode.Webview;
}

/**
 * Result of a WebView callback.
 */
export type WebViewCallbackResult = void | PromiseLike<void>;

/**
 * Options for showing a WebView.
 */
export type WebviewOptions = vscode.WebviewPanelOptions & vscode.WebviewOptions & {
    /**
     * The callback to invoke when view state changed.
     * 
     * @param {vscode.WebviewPanelOnDidChangeViewStateEvent} e The event arguments.
     */
    readonly onDidChangeViewState?: (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => WebViewCallbackResult;
    /**
     * The callback to invoke when view has been disposed.
     */
    readonly onDidDispose?: () => WebViewCallbackResult;
    /**
     * The callback to invoke when data has been received from script inside a WebView.
     * 
     * @param {any} e The received data.
     */
    readonly onDidReceiveMessage?: (e: any) => WebViewCallbackResult;
};


/**
 * Opens a HTML document in a new tab.
 * 
 * @param {string} html The HTML document (source code).
 * @param {string} [title] The custom title for the tab.
 * @param {WebviewOptions} [opts] Custom options.
 * @param {vscode.ViewColumn} [position] Custom view column.
 * 
 * @returns {WebView} The new view.
 */
export function openHtmlDocument(html: string, title?: string, opts?: WebviewOptions, position?: vscode.ViewColumn): WebView {
    const DEFAULT_OPTS: WebviewOptions = {
        enableScripts: true,
        enableCommandUris: true,
        retainContextWhenHidden: true,
    };

    opts = MergeDeep(DEFAULT_OPTS, opts);

    if (_.isNil(position)) {
        position = vscode.ViewColumn.One;
    }

    title = deploy_helpers.toStringSafe(title);
    if (deploy_helpers.isEmptyString(title)) {
        title = '';
    }

    const PANEL = vscode.window.createWebviewPanel('vscodeDeployReloaded', title, position, opts);

    PANEL.onDidChangeViewState(function(e) {
        tryInvokeWebViewCallback(
            'onDidChangeViewState', PANEL,
            opts.onDidChangeViewState, e
        );
    });
    PANEL.onDidDispose(function() {
        tryInvokeWebViewCallback(
            'onDidDispose', PANEL,
            opts.onDidDispose
        );
    });
    PANEL.webview.onDidReceiveMessage(function(e: any) {
        tryInvokeWebViewCallback(
            'onDidReceiveMessage', PANEL,
            opts.onDidReceiveMessage, e
        );
    });

    PANEL.webview.html = deploy_helpers.toStringSafe(html);

    const VIEW: WebView = {
        dispose: function() {
            return this.panel.dispose();
        },
        panel: PANEL,
        postMessage: function(msg) {
            return this.view.postMessage(msg);
        },
        view: undefined,
    };

    // VIEW.view
    Object.defineProperty(VIEW, 'view', {
        get: function() {
            return this.panel.webview;
        }
    });

    return VIEW;
}

/**
 * Opens a Markdown document in a new tab.
 * 
 * @param {string} md The Markdown document (source code).
 * @param {MarkdownDocumentOptions|string} [optsOrTitle] Custom options or title.
 * @param {vscode.ViewColumn} [position] Custom view column.
 * 
 * @returns {WebView} The new view.
 */
export function openMarkdownDocument(md: string, optsOrTitle?: MarkdownDocumentOptions | string, position?: vscode.ViewColumn) {
    if (_.isNil(optsOrTitle)) {
        optsOrTitle = {};
    }

    if (!deploy_helpers.isObject<MarkdownDocumentOptions>(optsOrTitle)) {
        optsOrTitle = {
            documentTitle: deploy_helpers.toStringSafe(optsOrTitle),
        };
    }

    const DEFAULT_OPTS: MarkdownDocumentOptions = {
        breaks: true,
        gfm: true,
        langPrefix: '',
        tables: true,
    };

    const CSS = deploy_helpers.toStringSafe(optsOrTitle.css);

    let html = deploy_res_html.getStringContentSync("header.html");

    if (!deploy_helpers.isEmptyString(CSS)) {
        html += `
<style text="text/css">

${CSS}

</style>
`;
    }

    html += Marked(
        deploy_helpers.toStringSafe(md),
        MergeDeep(DEFAULT_OPTS, optsOrTitle),
    );
    
    html += deploy_res_html.getStringContentSync("footer.html");

    return openHtmlDocument(html, optsOrTitle.documentTitle, {
        enableCommandUris: false,
        enableScripts: false,
        enableFindWidget: false,
    }, position);
}

function tryInvokeWebViewCallback<TFunc extends Function = Function>(
    name: string,
    panel: vscode.WebviewPanel,
    func: TFunc, ...args: any[]
) {
    if (!func) {
        return;
    }

    try {
        Promise.resolve(
            func.apply(panel, args)
        ).then(() => {
        }, (err) => {
            deploy_log.CONSOLE
                  .trace(err, `html.tryInvokeWebViewCallback(${name}::2)`);
        });
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, `html.tryInvokeWebViewCallback(${name}::1)`);
    }
}
