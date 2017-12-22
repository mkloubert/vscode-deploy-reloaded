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
    canceled: 'Abgebrochen',
    commands: {
        executionError: "Das Kommando {0:surround} konnte nicht ausgeführt werden:{1:trim,surround,leading_space}",
        scriptNotFound: "Das Skript {0:surround} wurde nicht gefunden!",
    },
    compare: {
        currentFile: {
            failed: "Die aktuelle Datei konnte nicht verglichen werden:{0:trim,surround,leading_space}",
        },
    },
    disposeNotAllowed: "'dispose()' Methode kann nicht aufgerufen werden!",
    editors: {
        active: {
            noOpen: "Es ist derzeit kein aktiver Texteditor geöffnet!",
        },
    },
    error: "FEHLER:{0:trim,surround,leading_space}",
    ftp: {
        couldNotConnect: "Konnte keine Verbindung aufbauen!",
        couldNotConnectWithJSFTP: "Konnte keine Verbindung mittels 'jsftp' aufbauen!",
    },
    http: {
        errors: {
            client: "HTTP Client Fehler{0:trim,leading_space}:{1:trim,surround,leading_space}",
            maxRedirections: "Maximale Anzahl von {0:trim} Weiterleitungen erreicht!",
            noRedirectLocation: "Kein Ziel für eine Weiterleitung angegeben!",
            protocolNotSupported: "Das Protokoll{0:trim,surround,leading_space} wird nicht unterstützt!",
            server: "HTTP Server Fehler{0:trim,leading_space}:{1:trim,surround,leading_space}",
            unknown: "Unbekannter HTTP Fehler{0:trim,leading_space}:{1:trim,surround,leading_space}",
        },
    },
    initializationCanceled: 'Die Initialisierung dieser Erweiterung wurde abgebrochen.',
    isNo: {
        directory: "{0:trim,surround,ending_space}ist kein Verzeichnis!",
        file: "{0:trim,surround,ending_space}ist keine Datei!",
    },
    listDirectory: {
        currentDirectory: "Aktuelles Verzeichnis:{0:trim,surround,leading_space} ({1:trim,surround})",
        directoryIsEmpty: "(Verzeichnis ist leer)",
        lastModified: "Letzte Änderung:{0:trim,leading_space}",
        loading: "Lade Verzeichnis{0:trim,surround,leading_space} ({1:trim} / {2:trim})...",
        noName: "<KEIN NAME>",
        parentDirectory: "(übergeordnetes Verzeichnis)",
        size: "Grösse:{0:trim,leading_space}",
    },
    no: "Nein",
    noFiles: "Keine Dateien gefunden!",
    packages: {
        buttons: {
            defaultText: "Stelle Paket{0:trim,surround,leading_space} bereit",
            defaultTooltip: "Hier klicken, um das Bereitstellen zu beginnen...",
        },
        defaultName: "(Paket #{0:trim})",
        deploymentFailed: "Konnte das Paket{0:trim,surround,leading_space} nicht bereitstellen:{1:trim,surround,leading_space}",
        virtualTarget: "Virtuelles Ziel für Paket{0:trim,surround,leading_space}",
    },
    plugins: {
        list: {
            defaultEntryName: "(Eintrag #{0:trim})",
            selectEntry: "Wählen Sie einen Eintrag mit Einstellungen für das Bereitstellen aus...",
        },
        local: {
            invalidDirectory: "{0:trim,surround,ending_space}ist ein ungültiges Verzeichnis!",
        },
        mail: {
            subject: "Bereitgestellte Dateien",
            text: "Die Dateien befinden sich im Anhang.\n\n" + 
                  "Gesendet mit der Visual Studio Code Erweiterung 'Deploy Reloaded' (vscode-deploy-reloaded):\n" + 
                  "https://github.com/mkloubert/vscode-deploy-reloaded",
        },
        prompt: {
            validation: {
                noBool: "Geben Sie bitte einen gültigen, booleschen Wert an!",
                noFloat: "Geben Sie bitte eine gültige Zahl an (englisches Format)!",
                noInt: "Geben Sie bitte eine gültige Ganzzahl an!",
                noJSON: "Geben Sie bitte einen gültigen, JavaScript-kompatiblen, JSON-Ausdruck an!",
            },
        },
        script: {
            noScriptFunction: "Das Skript{0:trim,surround,leading_space} enthält keine 'execute' Funktion!",
            noScriptModule: "Das Skript{0:trim,surround,leading_space} enthält kein Modul!",
            scriptNotFound: "Das Skript{0:trim,surround,leading_space} wurde nicht gefunden!",
        },
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
        test: {
            invalidDirectory: "{0:trim,surround,ending_space}ist ein ungültiges Verzeichnis!",
        },
        zip: {
            errors: {
                fileAlreadyExists: "Die Datei{0:trim,surround,leading_space} existiert bereits!",
                fileNotFound: "Datei{0:trim,surround,leading_space} wurde nicht gefunden!",
                noFilesFound: "Keine ZIP-Datei gefunden!",
            },
            invalidDirectory: "{0:trim,surround,ending_space}ist ein ungültiges Verzeichnis!",
        },
    },
    pull: {
        askForCancelOperation: "Sind Sie sicher, dass Sie das Laden der Datei(en) von{0:trim,surround,leading_space} abbrechen wollen?",
        buttons: {
            cancel: {
                text: "Lade Dateien von{0:trim,surround,leading_space} ...",
                tooltip: "Hier klicken, um abzubrechen ...",
            },
        },
        cancelling: "Breche das Laden ab ...",
        errors: {
            invalidWorkspace: "Die Datei{0:trim,surround,leading_space} kann nicht in den Arbeitsbereich{1:trim,surround,leading_space} geladen werden!",
            invalidWorkspaceForPackage: "Das Paket{0:trim,surround,leading_space} kann nicht in den Arbeitsbereich{1:trim,surround,leading_space} geladen werden!",
        },
        selectSource: "Wählen Sie die Quelle von der Sie die Datei(en) laden wollen ...",
    },
    s3bucket: {
        credentialTypeNotSupported: "Das Anmeldeverfahren{0:trim,surround,leading_space} wird nicht unterstützt!",
    },
    sftp: {
        privateKeyNotFound: "Der private Schlüssel{0:trim,surround,leading_space} wurde nicht gefunden!",
    },
    sql: {
        notSupported: "Der SQL-Typ{0:trim,surround,leading_space} wird nicht unterstützt!",
    },
    targets: {
        atLeastOneNotFound: "Mindestens ein Ziel konnte nicht gefunden werden!",
        cannotDefineOtherAsSource: "Das Ziel{0:trim,surround,leading_space} kann nicht verwendet werden!",
        defaultName: "(Ziel #{0:trim})",
        doesNotExist: "Das Ziel{0:trim,surround,leading_space} existiert nicht!",
        errors: {
            couldNotLoadDataTransformer: "Konnte das Datenkonvertierung-Skript für{0:trim,surround,leading_space} nicht laden!",
        },
        noneFound: "Keine Ziele gefunden!",
        noPluginsFound: "Es wurden keine passenden Plug-Ins gefunden!",
        noWorkspaceFound: "Keinen passenden Arbeitsbereich gefunden!",
        operations: {
            http: {
                bodyScriptNotFound: "Das Skript{0:trim,surround,leading_space} wurde nicht gefunden!",
                noBodyScriptFunction: "Das Skript{0:trim,surround,leading_space} enthält keine 'getBody' Funktion!",
                noBodyScriptModule: "Das Skript{0:trim,surround,leading_space} enthält kein Modul!",
            },
            script: {
                noScriptFunction: "Das Skript{0:trim,surround,leading_space} enthält keine 'execute' Funktion!",
                noScriptModule: "Das Skript{0:trim,surround,leading_space} enthält kein Modul!",
                scriptNotFound: "Das Skript{0:trim,surround,leading_space} wurde nicht gefunden!",
            },
            typeNotSupported: "Eine Operation vom Typ{0:trim,surround,leading_space} wird nicht unterstützt!",
        },
    },
    time: {
        dateTimeWithSeconds: "DD.MM.YYYY HH:mm:ss",
    },
    tools: {
        createDeployScript: {
            askForNewTargetName: "Geben Sie bitte den Namen des neuen Ziels ein ...",
            askForScriptPath: "Wo soll das Skript gespeichert werden?",
            askForUpdatingSettings: "Soll das neue Skript als neues Ziel in den Einstellungen gespeichert werden?",
            description: "Erstellt ein Basis-Skript zum Bereitstellen von Dateien",
            errors: {
                targetAlreadyDefined: "Ein Ziel mit dem Namen{0:trim,surround,leading_space} ist bereits in den Einstellungen vorhanden!",
                updateTargetSettingsFailed: "Konnte das Skript nicht in den Einstellungen speichern:{0:trim,surround,leading_space}",
            },
            label: "Bereitstellungs-Skript erstellen ...",
            scriptCreated: "Das Skript{0:trim,surround,leading_space} wurde erfolgreich erstellt.",
        },
        createDeployOperationScript: {
            askForNewOperationName: "Geben Sie (optional) einen Anzeigenamen für die Operation an ...",
            askForOperationType: {
                afterDeployment: "Nach dem Bereitstellen",
                beforeDeploy: "Vor dem Bereitstellen",
                placeHolder: "Wann soll das Skript aufgerufen werden?",
            },
            askForScriptPath: "Wo soll das Skript gespeichert werden?",
            askForUpdatingSettings: "Soll das neue Skript in den Einstellungen gespeichert werden?",
            description: "Erstellt ein Basis-Skript für eine Bereitstellungs-Operation",
            errors: {
                updateSettingsFailed: "Konnte das Skript nicht in den Einstellungen speichern:{0:trim,surround,leading_space}",
            },
            scriptCreated: "Das Skript{0:trim,surround,leading_space} wurde erfolgreich erstellt.",
            selectTarget: "Wählen Sie ein Ziel ...",
        },
        errors: {
            operationFailed: "Konnte Funktion nicht ausführen (s. Debugkonsole 'STRG + SHIFT + Y')!",
        },
        quickExecution: {
            description: "Führt JavaScript-Code aus",
            errors: {
                failed: "Das Ausführen des Codes ist fehlgeschlagen:{0:trim,surround,leading_space}",
            },
            inputCode: "Code, der ausgeführt werden soll ...",
            label: "Code ausführen ...",
        },
    },
    'vs-deploy': {
        continueAndInitialize: 'Fortfahren und initialisieren...',
        currentlyActive: "Die 'vs-deploy' Erweiterung ist derzeit aktiv. Es wird empfohlen diese zu DEAKTIVIEREN, bevor Sie forfahren und die neue Erweiterung nutzen!",
    },
    workspaces: {
        errors: {
            cannotDetectMappedPathInfoForFile: "Gemappte Pfad-Informationen konnten für die Datei{0:trim,surround,leading_space} nicht ermittelt werden!",
            cannotDetectPathInfoForFile: "Pfad-Informationen konnten für die Datei{0:trim,surround,leading_space} nicht ermittelt werden!",
            cannotUseTargetForFile: "Kann das Ziel{0:trim,surround,leading_space} nicht für die Datei{1:trim,surround,leading_space} verwenden!",
        },
        noneFound: "Keine Arbeitsbereiche gefunden!",
        selectWorkspace: "Wählen Sie einen Arbeitsbereich ...",
    },
    yes: 'Ja',
}
