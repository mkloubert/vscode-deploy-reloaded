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


// deutsch (german)
// 
// Translated by: Marcel Joachim Kloubert (https://github.com/mkloubert)
export const translation: Translation = {
    cancel: 'Abbrechen',
    commands: {
        executionError: "Das Kommando {0:surround} konnte nicht ausgeführt werden:{1:trim,surround,leading_space}",
        scriptNotFound: "Das Skript {0:surround} wurde nicht gefunden!",
    },
    compare: {
        currentFile: {
            failed: "Die aktuelle Datei konnte nicht verglichen werden:{0:trim,surround,leading_space}",
        },
    },
    editors: {
        active: {
            noOpen: "Es ist derzeit kein aktiver Texteditor geöffnet!",
        },
    },
    ftp: {
        couldNotConnect: "Konnte keine Verbindung aufbauen!",
        couldNotConnectWithJSFTP: "Konnte keine Verbindung mittels 'jsftp' aufbauen!",
    },
    http: {
        errors: {
            client: "HTTP Client Fehler{0:trim,leading_space}:{1:trim,surround,leading_space}",
            server: "HTTP Server Fehler{0:trim,leading_space}:{1:trim,surround,leading_space}",
            unknown: "Unbekannter HTTP Fehler{0:trim,leading_space}:{1:trim,surround,leading_space}",
        },
    },
    initializationCanceled: 'Die Initialisierung dieser Erweiterung wurde abgebrochen.',
    no: 'Nein',
    packages: {
        defaultName: '(Paket #{0:trim})',
    },
    plugins: {
        switch: {
            button: {
                text: "Schalter{0:trim,surround,leading_space}",
                tooltip: "Aktuell ausgewählt:{0:trim,surround,leading_space}\n\nHier klicken, um auf eine andere Option umzuschalten...",
            },
            changeSwitch: {
                description: "Ändert die aktuelle Einstellung eines Schalters",
                label: "Schalter ändern ...",
            },
            defaultOptionName: 'Schalter-Option #{0:trim}',
            noDefined: 'Keine Schalter gefunden!',
            noOptionsDefined: 'Es wurden keine Optionen für den Schalter{0:trim,surround,leading_space} definiert!',
            noOptionSelected: "KEINE OPTION AUSGEWÄHLT",
            noOptionSelected2: "Es ist keine Option für den Schalter{0:trim,surround,leading_space} ausgewählt oder definiert!",
            selectOption: 'Wählen Sie eine Option für den Schalter{0:trim,surround,leading_space}...',
            selectSwitch: "Wählen Sie einen Schalter...",
        },
    },
    s3bucket: {
        credentialTypeNotSupported: "Das Anmeldeverfahren{0:trim,surround,leading_space} wird nicht unterstützt!",
    },
    sftp: {
        privateKeyNotFound: "Der private Schlüssel{0:trim,surround,leading_space} wurde nicht gefunden!",
    },
    targets: {
        defaultName: "(Ziel #{0:trim})",
        noneFound: "Keine Ziele gefunden!",
        noWorkspaceFound: "Keinen passenden Arbeitsbereich gefunden!",
        operations: {
            http: {
                bodyScriptNotFound: "Das Skript{0:trim,surround,leading_space} wurde nicht gefunden!",
                noBodyScriptFunction: "Das Skript{0:trim,surround,leading_space} enthält keine 'getBody' Funktion!",
                noBodyScriptModule: "Das Skript{0:trim,surround,leading_space} enthält kein Modul!",
                protocolNotSupported: "Das Protokoll{0:trim,surround,leading_space} wird nicht unterstützt!",
            },
        },
    },
    'vs-deploy': {
        continueAndInitialize: 'Fortfahren und initialisieren...',
        currentlyActive: "Die 'vs-deploy' Erweiterung ist derzeit aktiv. Es wird empfohlen diese zu DEAKTIVIEREN, bevor Sie forfahren und die neue Erweiterung nutzen!",
    },
    yes: 'Ja',
}
