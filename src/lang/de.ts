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
    initializationCanceled: 'Die Initialisierung dieser Erweiterung wurde abgebrochen.',
    no: 'Nein',
    packages: {
        defaultName: '(Paket #{0:trim})',
    },
    targets: {
        defaultName: '(Ziel #{0:trim})',
    },
    'vs-deploy': {
        continueAndInitialize: 'Fortfahren und initialisieren...',
        currentlyActive: "Die 'vs-deploy' Erweiterung ist derzeit aktiv. Es wird empfohlen diese zu DEAKTIVIEREN, bevor Sie forfahren und die neue Erweiterung nutzen!",
    },
    yes: 'Ja',
}
