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
    cancel: "Abbrechen",
    canceled: "Abgebrochen",
    changelog: "Änderungsprotokoll",
    close: "Schliessen",
    commands: {
        executionError: "Das Kommando{0:surround,leading_space} konnte nicht ausgeführt werden:{1:trim,surround,leading_space}",
        scriptNotFound: "Das Skript {0:surround} wurde nicht gefunden!",
    },
    compare: {
        currentFile: {
            description: "Vergleicht die aktuelle Datei mit einer bereitgestellten",
            failed: "Die aktuelle Datei konnte nicht verglichen werden:{0:trim,surround,leading_space}",
            label: "Aktuelle Datei ...",
        },
        errors: {
            operationFailed: "Konnte Vergleich nicht durchführen (s. Debugkonsole 'STRG/CMD + SHIFT + Y')!",
        },
        title: "Vergleich{0:trim,surround,leading_space}",
    },
    compilers: {
        errors: {
            couldNotDeleteSourceFile: "Konnte Quelldatei nicht löschen:{0:trim,surround,leading_space}",
        },
        notSupported: "Compiler{0:trim,surround,leading_space} wird nicht unterstützt!",
    },
    'continue': "Fortfahren",
    currentFileOrFolder: {
        noneSelected: "Es ist weder eine aktive Datei, noch ein aktives Verzeichnis ausgewählt!",
    },
    DELETE: {
        askForCancelOperation: "Sind Sie sicher, dass Sie das Löschen der Datei(en) in{0:trim,surround,leading_space} abbrechen wollen?",
        askIfDeleteLocalFile: "Auch die lokale Datei löschen?",
        askIfDeleteLocalFiles: "Auch die lokale Dateien löschen?",
        buttons: {
            cancel: {
                text: "Lösche Dateien in{0:trim,surround,leading_space} ...",
                tooltip: "Hier klicken, um abzubrechen ...",
            },
        },
        canceledByOperation: "Das Löschen der Dateien in{0:trim,surround,leading_space} wurde durch eine Operation abgebrochen.",
        cancelling: "Breche das Löschen ab ...",
        currentFile: {
            description: "Löscht die aktuelle Datei",
            label: "Aktuelle Datei ...",
        },
        currentFileOrFolder: {
            file: {
                description: "Löscht die aktuell, ausgewählte Datei",
                label: "Ausgewählte Datei löschen",
            },
            folder: {
                description: "Löscht das aktuell ausgewählte Verzeichnis",
                label: "Ausgewähltes Verzeichnis löschen",
            },
            items: {
                description: "Löscht alle Dateien der aktuell ausgewählten Elemente",
                label: "Ausgewählte Dateien und Verzeichnisse löschen",
            }
        },
        deletingFile: "Lösche Datei{0:trim,surround,leading_space} in{1:trim,surround,leading_space} ...",
        errors: {
            invalidWorkspace: "Die Datei{0:trim,surround,leading_space} is nicht Teil des Arbeitsbereiches{1:trim,surround,leading_space}!",
            invalidWorkspaceForPackage: "Das Paket{0:trim,surround,leading_space} ist nicht Teil des Arbeitsbereiches{1:trim,surround,leading_space}!",
            operationFailed: "Konnte das Löschen nicht durchführen (s. Debugkonsole 'STRG/CMD + SHIFT + Y')!",
        },
        finishedOperation: "Das Löschen der Dateien in{0:trim,surround,leading_space} wurde erfolgreich abgeschlossen.",
        finishedOperationWithErrors: "[FEHLER] Konnte Dateien nicht in{0:trim,surround,leading_space} löschen:{1:trim,surround,leading_space}",
        fileList: {
            description: "Löscht Dateien, die als Liste im aktiven Texteditor definiert sind",
            label: "Dateiliste",
        },
        onChange: {
            activated: "Automatisches Löschen wurde für den Arbeitsbereich{0:trim,surround,leading_space} aktiviert.",
            failed: "Das automatische Löschen von{0:trim,surround,leading_space} in{1:trim,surround,leading_space} ist fehlgeschlagen:{2:trim,surround,leading_space}",
            text: "Automatisches Löschen",
            waitingBeforeActivate: "Automatisches Löschen wird für ca.{0:trim,leading_space} Sekunden für den Arbeitsbereich{1:trim,surround,leading_space} deaktiviert.",
        },
        package: {
            description: "Löscht die Dateien eines Paketes",
            label: "Paket ...",
        },
        popups: {
            allFailed: "Keine Datei konnte gelöscht werden!",
            someFailed: "{0:trim,ending_space}Datei(en) konnte(n) nicht gelöscht werden!",
            succeeded: "Alle Dateien wurden erfolgreich gelöscht.",
        },
        selectTarget: "Wählen Sie das Ziel, wo Sie Dateien löschen wollen ...",
        startOperation: "Beginne das Löschen der Dateien in{0:trim,surround,leading_space} ...",
    },
    deploy: {
        allOpenFiles: {
            description: "Stellt die Dateien aller geöffneten Editoren bereit",
            label: "Alle geöffneten Dateien ...",
        },
        askForCancelOperation: "Sind Sie sicher, dass Sie das Bereitstellen der Datei(en) in{0:trim,surround,leading_space} abbrechen wollen?",
        buttons: {
            cancel: {
                text: "Stelle Dateien in{0:trim,surround,leading_space} breit ...",
                tooltip: "Hier klicken, um abzubrechen ...",
            },
        },
        canceledByOperation: "Das Bereitstellen der Dateien in{0:trim,surround,leading_space} wurde durch eine Operation abgebrochen.",
        cancelling: "Breche das Bereitstellen ab ...",
        checkBeforeDeploy: {
            beginOperation: "Suche nach neueren Dateien in{0:trim,surround,leading_space} ...",
            newerFilesFound: "{0:trim,ending_space}Datei(en) wurde(n) gefunden, die neuer sind. Forfahren?",
            notSupported: "Die Funktion 'checkBeforeDeploy' steht für das Ziel{0:trim,surround,leading_space} nicht zur Verfügung! Forfahren?",
            report: {
                lastChange: "Letzte Änderung",
                localFile: "Lokale Datei",
                remoteFile: "Ziel-Datei",
                size: "Grösse",
                title: "Neuere Dateien in{0:trim,surround,leading_space}",
            },
        },
        currentFile: {
            description: "Stellt die aktuelle Datei bereit",
            label: "Aktuelle Datei ...",
        },
        currentFileOrFolder: {
            file: {
                description: "Stellt die aktuell, ausgewählte Datei bereit",
                label: "Ausgewählte Datei bereitstellen",
            },
            folder: {
                description: "Stellt alle Dateien des aktuell ausgewählte Verzeichnis bereit",
                label: "Ausgewähltes Verzeichnis bereitstellen",
            },
            items: {
                description: "Stellt alle Dateien der aktuell ausgewählten Elemente bereit",
                label: "Ausgewählte Dateien und Verzeichnisse bereitstellen",
            }
        },
        deployingFile: "Stelle Datei{0:trim,surround,leading_space} in{1:trim,surround,leading_space} bereit ...",
        errors: {
            invalidWorkspace: "Die Datei{0:trim,surround,leading_space} kann nicht über den Arbeitsbereich{1:trim,surround,leading_space} bereitgestellt werden!",
            invalidWorkspaceForPackage: "Das Paket{0:trim,surround,leading_space} kann nicht über den Arbeitsbereich{1:trim,surround,leading_space} bereitgestellt werden!",
            operationFailed: "Konnte das Bereitstellen nicht durchführen (s. Debugkonsole 'STRG/CMD + SHIFT + Y')!",
            operationToTargetFailed: "Das Bereitstellen der Datei(en) ins Ziel{0:trim,surround,leading_space} schlug fehl:{1:trim,surround,leading_space}",
        },
        fileList: {
            description: "Stellt Dateien bereit, die als Liste im aktiven Texteditor definiert sind",
            label: "Dateiliste",
        },
        finishedOperation: "Das Bereitstellen der Dateien in{0:trim,surround,leading_space} wurde erfolgreich abgeschlossen.",
        finishedOperationWithErrors: "[FEHLER] Konnte Dateien nicht in{0:trim,surround,leading_space} bereitstellen:{1:trim,surround,leading_space}",
        gitCommit: {
            description: "Stellt Änderungen eines git-Commits bereit",
            label: "git-Commit ...",
            patterns: {
                askForFilesToExclude: {
                    placeHolder: "(keine)",
                    prompt: "Geben Sie ggf. Suchmuster von auszuschliessende Dateien an, getrennt durch ;",
                },
                askForFilesToInclude: {
                    placeHolder: "**",
                    prompt: "Geben Sie ggf. Suchmuster von einzuschliessende Dateien an, getrennt durch ;",
                }
            },
        },
        onChange: {
            activated: "Das Bereitstellen nach dem Ändern wurde für den Arbeitsbereich{0:trim,surround,leading_space} aktiviert.",
            failed: "Das Bereitstellen nach dem Ändern von{0:trim,surround,leading_space} nach{1:trim,surround,leading_space} ist fehlgeschlagen:{2:trim,surround,leading_space}",
            text: "Bereitstellen beim Ändern",
            waitingBeforeActivate: "Das Bereitstellen nach dem Ändern wird für ca.{0:trim,leading_space} Sekunden für den Arbeitsbereich{1:trim,surround,leading_space} deaktiviert.",
        },
        onSave: {
            failed: "Das Bereitstellen nach dem Speichern von{0:trim,surround,leading_space} nach{1:trim,surround,leading_space} ist fehlgeschlagen:{2:trim,surround,leading_space}",
            text: "Bereitstellen nach dem Speichern",
        },
        package: {
            description: "Stellt die Dateien eines Paketes bereit",
            label: "Paket ...",
        },
        popups: {
            allFailed: "Keine Datei konnte bereitgestellt werden!",
            someFailed: "{0:trim,ending_space}Datei(en) konnte(n) nicht bereitgestellt werden!",
            succeeded: "Alle Dateien wurden erfolgreich bereitgestellt.",
        },
        selectTarget: "Wählen Sie das Ziel, in das Sie die Dateien bereitstellen wollen ...",
        startOperation: "Beginne das Bereitstellen der Dateien in{0:trim,surround,leading_space} ...",
        uncomittedGitFiles: {
            description: "Stellt Dateien bereit, die noch nicht ins git-Repository übertragen wurden",
            label: "Nicht übertragene git-Dateien",
        },
    },
    disposeNotAllowed: "'dispose()' Methode kann nicht aufgerufen werden!",
    documents: {
        html: {
            defaultName: "HTML Dokument #{0:trim}",
        },
    },
    done: "Fertig",
    editors: {
        active: {
            noOpen: "Es ist derzeit kein aktiver Texteditor geöffnet!",
        },
        noOpen: "Es ist derzeit kein Texteditor geöffnet!",
    },
    error: "FEHLER:{0:trim,surround,leading_space}",
    extension: {
        initialized: "Erweiterung wurde erfolgreich initialisiert.",
        initializing: "Erweiterung wird initialisiert ...",
    },
    file: "Datei",
    fileNotFound: "Datei{0:trim,surround,leading_space} nicht gefunden!",
    files: "Dateien",
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
        copyPathToClipboard: {
            description: "Kopiert den aktuellen Pfad in die Zwischenablage",
            errors: {
                failed: "Konnte Pfad nicht in Zwischenablage speichern (s. Debugkonsole 'STRG/CMD + SHIFT + Y'): {0}",
            },
            label: "Pfad kopieren ...",
        },
        currentDirectory: "Aktuelles Verzeichnis:{0:trim,surround,leading_space} ({1:trim,surround})",
        directoryIsEmpty: "(Verzeichnis ist leer)",
        errors: {
            failed: "Konnte das Auflisten des Verzeichnisses{0:trim,surround,leading_space} ({1:trim,surround,leading_space}) nicht durchführen: {2:trim,surround,leading_space}",
            operationFailed: "Konnte das Auflisten eines Verzeichnisses nicht durchführen (s. Debugkonsole 'STRG/CMD + SHIFT + Y')!",
        },
        lastModified: "Letzte Änderung:{0:trim,leading_space}",
        loading: "Lade Verzeichnis{0:trim,surround,leading_space} ({1:trim} / {2:trim})...",
        noName: "<KEIN NAME>",
        parentDirectory: "(übergeordnetes Verzeichnis)",
        pull: {
            enterLocalFolder: "Geben Sie das lokale Verzeichnis in das die Dateien speichert werden sollen ...",
            errors: {
                maxPathDepthReached: "Maxmimal Tiefe von{0:trim,leading_space} erreicht!",
            },
            folder: {
                description: "Lädt die Dateien dieses Ordners in ein lokales Verzeichnis",
                label: "Dateien laden ...",
            },
            folderWithSubfolders: {
                description: "Lädt die Dateien dieses Ordners (inkl. Unterordnern) in ein lokales Verzeichnis",
                label: "Dateien inkl. Unterverzeichnissen laden ...",
            },
            pullingFile: "Lade Datei{0:trim,surround,leading_space} ...",
            pullingFrom: "Lade Dateien von{0:trim,surround,leading_space} nach{1:trim,surround,leading_space} ...",
        },
        selectSource: "Wählen Sie eine Quelle ...",
        size: "Grösse:{0:trim,leading_space}",
    },
    maxDepthReached: "Maximale Tiefe von{0:trim,leading_space} erreicht!",
    network: {
        hostname: 'Name dieses Computers:{0:trim,surround,leading_space}',
        interfaces: {
            list: 'Netzwerk-Adapter:',
        }
    },
    no: "Nein",
    noFiles: "Keine Dateien gefunden!",
    notFound: {
        dir: "Das Verzeichnis{0:trim,surround,leading_space} wurde nicht gefunden!",
    },
    output: {
        open: "Ausgabe öffnen",
    },
    packages: {
        buttons: {
            defaultText: "Stelle Paket{0:trim,surround,leading_space} bereit",
            defaultTooltip: "Hier klicken, um das Bereitstellen zu beginnen...",
            prompts: {
                askBeforeDelete: "Mit dem Löschen in{0:trim,surround,leading_space} beginnen?",
                askBeforeDeploy: "Mit dem Bereitstellen nach{0:trim,surround,leading_space} beginnen?",
                askBeforePull: "Mit dem Laden aus{0:trim,surround,leading_space} beginnen?",
            },
            unknownOperationType: "Unbekannte Operation{0:trim,surround,leading_space}!",
        },
        defaultName: "(Paket #{0:trim})",
        deploymentFailed: "Konnte das Paket{0:trim,surround,leading_space} nicht bereitstellen:{1:trim,surround,leading_space}",
        noneFound: "Keine Pakete gefunden!",
        selectPackage: "Wählen Sie ein Paket aus ...",
        virtualTarget: "Virtuelles Ziel für Paket{0:trim,surround,leading_space}",
    },
    pagination: {
        previousPage: "Vorherige Seite ({0:trim}) ...",
        nextPage: "Nächste Seite ({0:trim}) ...",
    },
    plugins: {
        __loaded: "{0:trim,ending_space}Plug-Ins wurden geladen:",

        app: {
            invalidDirectory: "{0:trim,surround,ending_space}ist ein ungültiges Verzeichnis!",
        },
        compiler: {
            invalidDirectory: "{0:trim,surround,ending_space}ist ein ungültiges Verzeichnis!",
        },
        errors: {
            initializationFailed: "Die Initialisierung des Plugins{0:trim,surround,leading_space} ist fehlgeschlagen (s. Debugkonsole 'STRG/CMD + SHIFT + Y')!",
            loadingFailed: "Fehler beim Laden von{0:trim,surround,leading_space} (s. Debugkonsole 'STRG/CMD + SHIFT + Y')!",
            noFactoryFunction: "Das Plugin-Modul{0:trim,surround,leading_space} beinhaltet keine Factory-Funktion!",
            noModule: "Das Plugin{0:trim,surround,leading_space} enthält kein Modul!",
            noneFoundIn: "Es wurden keine Plugins in{0:trim,surround,leading_space} gefunden!",
            notInitialized: "Das Plugin{0:trim,surround,leading_space} wurde nicht initialisiert!",
        },
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
    proxies: {
        buttons: {
            defaultText: "Proxy{0:trim,surround,leading_space}",
            defaultTooltip: "Hier klicken, um den Status des Proxies zu ändern ...",
        },
        errors: {
            couldNotRegister: "Konnte TCP Proxy nicht für den Port{0:trim,leading_space} registríeren:{1:trim,surround,leading_space}",
            couldNotToggleRunningState: "Konnte Status des TCP Proxies{0:trim,surround,leading_space} nicht ändern:{1:trim,surround,leading_space}",
            failed: "TCP Proxy Operation fehlgeschlagen:{0:trim,surround,leading_space}",
        },
        noneFound: "Es wurde kein TCP Proxy in den Einstellungen definiert.",
        selectProxy: "Wählen Sie einen TCP Proxy aus ...",
        startProxy: "Starte TCP Proxy ...",
        stopProxy: "Stoppe TCP Proxy ...",
    },
    pull: {
        allOpenFiles: {
            description: "Lädt die Dateien aller geöffneten Editoren",
            label: "Alle geöffneten Dateien ...",
        },
        askForCancelOperation: "Sind Sie sicher, dass Sie das Laden der Datei(en) von{0:trim,surround,leading_space} abbrechen wollen?",
        buttons: {
            cancel: {
                text: "Lade Dateien von{0:trim,surround,leading_space} ...",
                tooltip: "Hier klicken, um abzubrechen ...",
            },
        },
        canceledByOperation: "Das Laden der Dateien von{0:trim,surround,leading_space} wurde durch eine Operation abgebrochen.",
        cancelling: "Breche das Laden ab ...",
        checkBeforePull: {
            beginOperation: "Suche nach älteren Dateien in{0:trim,surround,leading_space} ...",
            notSupported: "Die Funktion 'checkBeforePull' steht für die Quelle{0:trim,surround,leading_space} nicht zur Verfügung! Forfahren?",
            olderFilesFound: "{0:trim,ending_space}Datei(en) wurde(n) gefunden, die älter sind. Forfahren?",
            report: {
                lastChange: "Letzte Änderung",
                localFile: "Lokale Datei",
                remoteFile: "Quell-Datei",
                size: "Grösse",
                title: "Ältere Dateien in{0:trim,surround,leading_space}",
            },
        },
        currentFile: {
            description: "Lädt die aktuelle Datei",
            label: "Aktuelle Datei ...",
        },
        currentFileOrFolder: {
            file: {
                description: "Lädt die aktuell, ausgewählte Datei",
                label: "Ausgewählte Datei laden",
            },
            folder: {
                description: "Lädt alle Dateien des aktuell ausgewählte Verzeichnis",
                label: "Ausgewähltes Verzeichnis laden",
            },
            items: {
                description: "Lädt alle Dateien der aktuell ausgewählte Elemente",
                label: "Ausgewählte Elemente laden",
            }
        },
        errors: {
            invalidWorkspace: "Die Datei{0:trim,surround,leading_space} kann nicht in den Arbeitsbereich{1:trim,surround,leading_space} geladen werden!",
            invalidWorkspaceForPackage: "Das Paket{0:trim,surround,leading_space} kann nicht in den Arbeitsbereich{1:trim,surround,leading_space} geladen werden!",
            operationFailed: "Konnte das Laden nicht durchführen (s. Debugkonsole 'STRG/CMD + SHIFT + Y')!",
            operationForSourceFailed: "Das Laden der Datei(en) aus der Quelle{0:trim,surround,leading_space} schlug fehl:{1:trim,surround,leading_space}",
        },
        finishedOperation: "Das Laden der Dateien von{0:trim,surround,leading_space} wurde erfolgreich abgeschlossen.",
        finishedOperationWithErrors: "[FEHLER] Konnte Dateien nicht von{0:trim,surround,leading_space} laden:{1:trim,surround,leading_space}",
        fileList: {
            description: "Lädt Dateien, die als Liste im aktiven Texteditor definiert sind",
            label: "Dateiliste",
        },
        package: {
            description: "Lädt die Dateien eines Paketes",
            label: "Paket ...",
        },
        popups: {
            allFailed: "Keine Datei konnte geladen werden!",
            someFailed: "{0:trim,ending_space}Datei(en) konnte(n) nicht geladen werden!",
            succeeded: "Alle Dateien wurden erfolgreich geladen.",
        },
        pullingFile: "Lade Datei{0:trim,surround,leading_space} von {1:trim,surround,leading_space} ...",
        selectSource: "Wählen Sie die Quelle von der Sie die Datei(en) laden wollen ...",
        startOperation: "Beginne Ladevorgang von{0:trim,surround,leading_space} ...",
    },
    requirements: {
        conditions: {
            defaultName: "Bedingung #{0:trim}",
            mustMatch: "Die Bedingung{0:trim,surround,leading_space} ist fehlgeschlagen und wird vorausgesetzt!",
            shouldMatch: "Die Bedingung{0:trim,surround,leading_space} ist fehlgeschlagen und wird empfohlen!",
        },
        extensions: {
            mustBeInstalled: "Die Erweiterung{0:trim,surround,leading_space} ist nicht installiert und wird vorausgesetzt!",
            openInMarketplace: "Abbrechen und Visual Studio Marketplace öffnen ...",
            shouldBeInstalled: "Es wird empfohlen die Erweiterung{0:trim,surround,leading_space} zu installieren!",
        },
    },
    s3bucket: {
        credentialTypeNotSupported: "Das Anmeldeverfahren{0:trim,surround,leading_space} wird nicht unterstützt!",
    },
    scm: {
        branches: {
            noneFound: "Es wurden keine Branches gefunden!",
            selectBranch: "Wählen Sie einen Branch ...",
        },
        changes: {
            added: "Hinzugefügt",
            deleted: "Gelöscht",
            modified: "Geändert",
            noneFound: "Es wurden keine Änderungen gefunden.",
        },
        commits: {
            errors: {
                selectingCommitFailed: "Commit konnte nicht ausgewählt werden:{0:trim,surround,leading_space}",
                selectingCommitRangeFailed: "Commits konnten nicht ausgewählt werden:{0:trim,surround,leading_space}",
            },
            noneFound: "Es wurden keine Commits gefunden!",
            selectCommit: "Wählen Sie einen Commit ...",
            selectFirstCommit: "Wählen Sie den ersten Commit ...",
            selectLastCommit: "Wählen Sie den letzten Commit ...",
        },
        loadingCommitChanges: "Lade Änderungen des Commits{0:trim,surround,leading_space} ({1:trim} / {2:trim}) ...",
        loadingCommits: "Lade Commits aus Branch{0:trim,surround,leading_space} ({1:trim}) ...",
    },
    sftp: {
        privateKeyNotFound: "Der private Schlüssel{0:trim,surround,leading_space} wurde nicht gefunden!",
    },
    shell: {
        executing: "Führe{0:trim,surround,leading_space} aus ...",
    },
    sql: {
        notSupported: "Der SQL-Typ{0:trim,surround,leading_space} wird nicht unterstützt!",
    },
    switches: {
        errors: {
            operationFailed: "Schalter-Operation ist fehlgeschlagen (s. Debugkonsole 'STRG/CMD + SHIFT + Y')!",
        },
    },
    sync: {
        whenOpen: {
            errors: {
                allFailed: "Alle Synchronisierungs-Operationen sind feldgeschlagen!",
            },
            text: "Synchronisieren beim Öffnen",
        },
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
            runningAfterDeleted: "Führe Operation{0:trim,surround,leading_space} nach dem Löschen aus... ",
            runningAfterDeployed: "Führe Operation{0:trim,surround,leading_space} nach dem Bereitstellen aus... ",
            runningAfterPulled: "Führe Operation{0:trim,surround,leading_space} nach dem Laden aus... ",
            runningBeforeDelete: "Führe Operation{0:trim,surround,leading_space} vor dem Löschen aus... ",
            runningBeforeDeploy: "Führe Operation{0:trim,surround,leading_space} vor dem Bereitstellen aus... ",
            runningBeforePull: "Führe Operation{0:trim,surround,leading_space} vor dem Laden aus... ",
            runningPrepare: "Führe Operation{0:trim,surround,leading_space} zur Vorbereitung aus... ",
            script: {
                noScriptFunction: "Das Skript{0:trim,surround,leading_space} enthält keine 'execute' Funktion!",
                noScriptModule: "Das Skript{0:trim,surround,leading_space} enthält kein Modul!",
                scriptNotFound: "Das Skript{0:trim,surround,leading_space} wurde nicht gefunden!",
            },
            typeNotSupported: "Eine Operation vom Typ{0:trim,surround,leading_space} wird nicht unterstützt!",
        },
        selectTarget: "Wählen Sie ein Ziel aus ...",
        waitingForOther: "Warte auf{0:trim,surround,leading_space} ...",
    },
    time: {
        dateTimeWithSeconds: "DD.MM.YYYY HH:mm:ss",
    },
    tools: {
        bower: {
            description: "Werkzeuge für das einfache Arbeiten mit 'bower'",
            executing: "Führe{0:trim,surround,leading_space} aus ...",
            label: "Bower Paket Manager (bower)",
            packageExample: "z.B. 'moment'",
            runInstall: {
                description: "Führt den Befehl 'bower install' im aktuellen Arbeitsbereich aus",
                enterPackageName: "Geben Sie den Namen des Bower-Paketes an ...",
                label: "'bower install' ausführen ...",                
            },
            runUninstall: {
                bowerFileContainsNoPackages: "{0:trim,surround,ending_space}beinhaltet keine Pakete!",
                bowerFileNotFound: "Es wurde keine 'bower.json'-Datei in{0:trim,surround,leading_space} gefunden!",
                description: "Führt den Befehl 'bower uninstall' im aktuellen Arbeitsbereich aus",
                errors: {
                    loadingBowerFileFailed: "Das Laden von{0:trim,surround,leading_space} ist fehlgeschlagen:{1:trim,surround,leading_space}",
                },
                label: "'bower uninstall' ausführen ...",                
            },
        },
        composer: {
            description: "Werkzeuge für das einfache Arbeiten mit 'composer'",
            executing: "Führe{0:trim,surround,leading_space} aus ...",
            label: "Composer Paket Manager (composer)",
            packageExample: "z.B. 'psr/log'",
            runRemove: {
                composerFileContainsNoPackages: "{0:trim,surround,ending_space}beinhaltet keine Pakete!",
                composerFileNotFound: "Es wurde keine 'composer.json'-Datei in{0:trim,surround,leading_space} gefunden!",
                description: "Führt den Befehl 'composer remove' im aktuellen Arbeitsbereich aus",
                errors: {
                    loadingComposerFileFailed: "Das Laden von{0:trim,surround,leading_space} ist fehlgeschlagen:{1:trim,surround,leading_space}",
                },
                label: "'composer remove' ausführen ...",
            },
            runRequire: {
                description: "Führt den Befehl 'composer require' im aktuellen Arbeitsbereich aus",
                enterPackageName: "Geben Sie den Namen des Composer-Paketes an ...",
                label: "'composer require' ausführen ...",
            },
        },
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
            label: "Skript für eine Bereitstellungs-Operation erstellen ...",
            scriptCreated: "Das Skript{0:trim,surround,leading_space} wurde erfolgreich erstellt.",
            selectTarget: "Wählen Sie ein Ziel ...",
        },
        errors: {
            operationFailed: "Konnte Funktion nicht ausführen (s. Debugkonsole 'STRG/CMD + SHIFT + Y')!",
        },
        git: {
            listFileChanges: {
                description: "Ermittelt Dateiänderungen in einem git-Repository zwischen 2 Commits",
                label: "git-Änderungen ermitteln",
            },
        },
        npm: {
            description: "Werkzeuge für das einfache Arbeiten mit 'npm'",
            executing: "Führe{0:trim,surround,leading_space} aus ...",
            label: "Node Paket Manager (npm)",
            moduleExample: "z.B. 'node-enumerable'",
            runInstall: {
                description: "Führt den Befehl 'npm install' im aktuellen Arbeitsbereich aus",
                enterModuleName: "Geben Sie den Namen des NPM-Moduls an ...",
                label: "'npm install' ausführen ...",
            },
            runLink: {
                description: "Führt den Befehl 'npm link' im aktuellen Arbeitsbereich aus",
                enterModuleName: "Geben Sie den Namen des NPM-Moduls an ...",
                label: "'npm link' ausführen ...",
            },
            runUninstall: {
                description: "Führt den Befehl 'npm uninstall' im aktuellen Arbeitsbereich aus",
                errors: {
                    loadingPackageFileFailed: "Das Laden von{0:trim,surround,leading_space} ist fehlgeschlagen:{1:trim,surround,leading_space}",
                },
                packageFileContainsNoModules: "{0:trim,surround,ending_space}beinhaltet keine Module!",
                packageFileNotFound: "Es wurde keine 'package.json'-Datei in{0:trim,surround,leading_space} gefunden!",
                label: "'npm uninstall' ausführen ...",
            },
        },
        quickExecution: {
            description: "Führt JavaScript-Code aus",
            errors: {
                failed: "Das Ausführen des Codes ist fehlgeschlagen:{0:trim,surround,leading_space}",
            },
            help: {
                title: "Hilfe zu 'Code ausführen'",
            },
            inputCode: "Code, der ausgeführt werden soll (z.B. $help) ...",
            label: "Code ausführen ...",
            result: {
                title: "Resultat der Ausführung",
            },
            uuid: {
                notSupported: "UUID Version{0:trim,surround,leading_space} wird nicht unterstützt!",
            },
        },
        sendOrReceiveFile: {
            description: "Sendet oder empfängt eine Dateien an/von einen/einem entfernten Editor",
            label: "Datei senden / empfangen",
            receive: {
                button: {
                    text: "Warte auf Datei (Port{0:trim,leading_space}) ...",
                    tooltip: "Hier klicken, um abzubrechen ...",
                },
                description: "Empfängt eine Datei von einem entfernten Editor",
                enterPort: "Geben Sie den TCP-Port an (Standard:{0:trim,leading_space}) ...",
                errors: {
                    couldNotReceiveFile: "Konnte Datei nicht empfangen:{0:trim,surround,leading_space}",
                    startHostFailed: "Konnte den Dienst zum Empfangen einer Datei nicht starten:{0:trim,surround,leading_space}",
                },
                label: "Datei empfangen ...",
            },
            send: {
                description: "Sendet eine Datei an einen entfernten Editor",
                enterRemoteAddress: "Geben Sie die Zieladresse an ...",
                errors: {
                    couldNotSendFile: "Das Senden der Datei ist fehlgeschlagen:{0:trim,surround,leading_space}",
                },
                label: "Datei senden ...",
            },
        },
        showPackageFiles: {
            description: "Zeigt die Dateien eines Paketes an",
            label: "Paket-Dateien anzeigen",
            title: "Dateien des Paketes{0:trim,surround,leading_space}",
        },
        yarn: {
            description: "Werkzeuge für das einfache Arbeiten mit 'Yarn'",
            executing: "Führe{0:trim,surround,leading_space} aus ...",
            label: "Yarn",
            moduleExample: "z.B. 'lodash'",
            runAdd: {
                description: "Führt den Befehl 'yarn add' im aktuellen Arbeitsbereich aus",
                enterModuleName: "Geben Sie den Namen des Yarn-Moduls an ...",
                label: "'yarn add' ausführen ...",
            },
            runRemove: {
                description: "Führt den Befehl 'yarn remove' im aktuellen Arbeitsbereich aus",
                errors: {
                    loadingPackageFileFailed: "Das Laden von{0:trim,surround,leading_space} ist fehlgeschlagen:{1:trim,surround,leading_space}",
                },
                label: "'yarn remove' ausführen ...",
                packageFileContainsNoModules: "{0:trim,surround,ending_space}beinhaltet keine Module!",
                packageFileNotFound: "Es wurde keine 'package.json'-Datei in{0:trim,surround,leading_space} gefunden!",
            },
        },
    },
    values: {
        errors: {
            targetFormatNotSupported: "Das Zielformat{0:trim,surround,leading_space} wird nicht unterstützt!",
        },
        typeNotSupported: "Der Wertetyp{0:trim,surround,leading_space} wird nicht unterstützt!",
    },
    'vs-deploy': {
        continueAndInitialize: 'Fortfahren und initialisieren...',
        currentlyActive: "Die 'vs-deploy' Erweiterung ist derzeit aktiv. Es wird empfohlen diese zu DEAKTIVIEREN, bevor Sie forfahren und die neue Erweiterung nutzen!",
    },
    warning: "WARNUNG",
    waiting: "Warte ...",
    workspace: "Arbeitsbereich",
    workspaces: {
        active: {
            errors: {
                selectWorkspaceFailed: "Das Selektieren des aktiven Arbeitsbereiches ist fehlgeschlagen (s. Debugkonsole 'STRG/CMD + SHIFT + Y')!",
            },
            noneFound: "Keine aktiven Arbeitsbereiche gefunden!",
            selectWorkspace: "Wählen Sie den aktiven Arbeitsbereich aus ...",
        },
        bower: {
            install: {
                errors: {
                    failed: "'bower install' konnte nicht ausgeführt werden:{0:trim,surround,leading_space}",
                },
                running: "Führe 'bower install' in{0:trim,surround,leading_space} aus ...",
            }
        },
        composer: {
            install: {
                errors: {
                    failed: "'composer install' konnte nicht ausgeführt werden:{0:trim,surround,leading_space}",
                },
                running: "Führe 'composer install' in{0:trim,surround,leading_space} aus ...",
            }
        },
        errors: {
            cannotDetectGitClient: "git-Client konnte nicht für{0:trim,surround,leading_space} gefunden werden!",
            cannotDetectGitFolder: "'.git'-Verzeichnis für{0:trim,surround,leading_space} wurde nicht gefunden!",
            cannotDetectMappedPathInfoForFile: "Gemappte Pfad-Informationen konnten für die Datei{0:trim,surround,leading_space} nicht ermittelt werden!",
            cannotDetectPathInfoForFile: "Pfad-Informationen konnten für die Datei{0:trim,surround,leading_space} nicht ermittelt werden!",
            cannotFindBranch: "Konnte Branch{0:trim,surround,leading_space} in{1:trim,surround,leading_space} nicht finden!",
            cannotFindScmHash: "Konnte Hash{0:trim,surround,leading_space} in{1:trim,surround,leading_space} nicht finden!",
            cannotUseTargetForFile: "Kann das Ziel{0:trim,surround,leading_space} nicht für die Datei{1:trim,surround,leading_space} verwenden!",
            initNodeModulesFailed: "Der Aufruf von 'npm install' ist fehlgeschlagen:{0:trim,surround,leading_space}",
            notInitialized: "Der Arbeitsbereich{0:trim,surround,leading_space} wurde nicht initialisiert!",
        },
        initializing: "Initialisiere Arbeitsbereich{0:trim,surround,leading_space} ...",
        noneFound: "Keine Arbeitsbereiche gefunden!",
        noSelected: "kein Arbeitsbereich ausgewählt",
        npm: {
            install: {
                errors: {
                    failed: "'npm install' konnte nicht ausgeführt werden:{0:trim,surround,leading_space}",
                },
                running: "Führe 'npm install' in{0:trim,surround,leading_space} aus ..."
            }
        },
        removing: "Schliesse Arbeitsbereich{0:trim,surround,leading_space} ...",
        selectButton: {
            tooltip: "Hier klicken, um einen anderen Arbeitsbereich als aktiv auszuwählen ...",
        },
        selectSource: "Wählen Sie eine Quelle für den Arbeitsbereich{0:trim,surround,leading_space} ...",
        selectTarget: "Wählen Sie ein Ziel für den Arbeitsbereich{0:trim,surround,leading_space} ...",
        selectWorkspace: "Wählen Sie einen Arbeitsbereich ...",
        yarn: {
            install: {
                errors: {
                    failed: "'yarn install' konnte nicht ausgeführt werden:{0:trim,surround,leading_space}",
                },
                running: "Führe 'yarn install' in{0:trim,surround,leading_space} aus ..."
            }
        },
    },
    yes: 'Ja',
};
