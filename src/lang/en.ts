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

import { Translation } from '../i18';


// english
// 
// Translated by: Marcel Joachim Kloubert (https://github.com/mkloubert)
export const translation: Translation = {
    cancel: 'Cancel',
    commands: {
        executionError: "Could not execute command {0:surround}:{1:trim,surround,leading_space}",
        scriptNotFound: "{0:surround} script not found!",
    },
    compare: {
        currentFile: {
            failed: "Could not compare current file:{0:trim,surround,leading_space}",
        },
    },
    editors: {
        active: {
            noOpen: "No active text editor found!",
        },
    },
    ftp: {
        couldNotConnect: "Could not start connection!",
        couldNotConnectWithJSFTP: "Could not start connection via 'jsftp'!",
    },
    http: {
        errors: {
            client: "HTTP client error{0:trim,leading_space}:{1:trim,surround,leading_space}",
            protocolNotSupported: "The protocol{0:trim,surround,leading_space} is not supported!",
            maxRedirections: "Maximum number of redirections ({0:trim}) reached!",
            noRedirectLocation: "No location defined to redirect to!",
            server: "HTTP server error{0:trim,leading_space}:{1:trim,surround,leading_space}",
            unknown: "Unknown HTTP error{0:trim,leading_space}:{1:trim,surround,leading_space}",
        },
    },
    initializationCanceled: 'The initialization of the extension has been stopped.',
    no: 'No',
    packages: {
        defaultName: "(Package #{0:trim})",
        virtualTarget: "Virtual target for package{0:trim,surround,leading_space}",
    },
    plugins: {
        list: {
            defaultEntryName: "(Entry #{0:trim})",
            selectEntry: "Select the entry with settings to use for deployment...",
        },
        switch: {
            button: {
                text: "Switch{0:trim,surround,leading_space}",
                tooltip: "Current option:{0:trim,surround,leading_space}\n\nClick here to change the current option...",
            },
            changeSwitch: {
                description: "Changes the current option of a switch",
                label: "Change switch ...",
            },
            defaultOptionName: "Switch option #{0:trim}",
            noDefined: 'No swicthes available!',
            noOptionsDefined: 'No options were defined for the switch{0:trim,surround,leading_space}!',
            noOptionSelected2: "No option has been selected or defined for switch{0:trim,surround,leading_space}!",
            noOptionSelected: "NO OPTION SELECTED",
            selectOption: "Select an option for the switch{0:trim,surround,leading_space}...",
            selectSwitch: "Select a switch...",
        },
        test: {
            invalidDirectory: "{0:trim,surround,ending_space}is an invalid directory!",
        },
    },
    s3bucket: {
        credentialTypeNotSupported: "Credental type{0:trim,surround,leading_space} is not supported!",
    },
    sftp: {
        privateKeyNotFound: "Private key file{0:trim,surround,leading_space} not found!",
    },
    sql: {
        notSupported: "SQL type{0:trim,surround,leading_space} is not supported!",
    },
    targets: {
        defaultName: "(Target #{0:trim})",
        noneFound: "No targets found!",
        noWorkspaceFound: "No matching workspace found!",
        operations: {
            http: {
                bodyScriptNotFound: "Script{0:trim,surround,leading_space} not found!",
                noBodyScriptFunction: "Script{0:trim,surround,leading_space} does not contain a 'getBody' function!",
                noBodyScriptModule: "Script{0:trim,surround,leading_space} does not contain a module!",
            },
            script: {
                noScriptFunction: "Script{0:trim,surround,leading_space} does not contain an 'execute' function!",
                noScriptModule: "Script{0:trim,surround,leading_space} does not contain a module!",
                scriptNotFound: "Script{0:trim,surround,leading_space} not found!",
            },
            typeNotSupported: "Operation type{0:trim,surround,leading_space} is not supported!",
        },
    },
    'vs-deploy': {
        continueAndInitialize: 'Continue and initialize me...',
        currentlyActive: "'vs-deploy' extension is currently active. It is recommended to DEACTIVATE IT, before you continue and use the new extension!",
    },
    yes: 'Yes',
}
