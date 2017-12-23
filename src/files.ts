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

import * as Moment from 'moment';


/**
 * Information about a directory.
 */
export interface DirectoryInfo extends FileSystemInfo {
    /** @inheritdoc */
    readonly compareTo?: (other: DirectoryInfo) => number;
    /** @inheritdoc */
    readonly type: FileSystemType;
}

/**
 * Information about a file.
 */
export interface FileInfo extends FileSystemInfo {
    /** @inheritdoc */
    readonly compareTo?: (other: FileInfo) => number;
    /**
     * Downloads the file.
     * 
     * @return {Buffer|PromiseLike<Buffer>} The downloaded data.
     */
    readonly download?: () => Buffer | PromiseLike<Buffer>;
    /** @inheritdoc */
    readonly type: FileSystemType;
}

/**
 * Information about an item on a file system.
 */
export interface FileSystemInfo {
    /**
     * An optional method to compare that object with another.
     */
    readonly compareTo?: (other: FileSystemInfo) => number;
    /**
     * A custom icon to use.
     */
    readonly icon?: string;
    /**
     * The internal name of that item.
     */
    readonly internal_name?: string;
    /**
     * The name of the item.
     */
    readonly name: string;
    /**
     * The path.
     */
    readonly path: string;
    /**
     * The size.
     */
    readonly size?: number;
    /**
     * The timestamp.
     */
    readonly time?: Moment.Moment;
    /**
     * The type of the item.
     */
    readonly type?: FileSystemType;
}

/**
 * The type of a file system item.
 */
export enum FileSystemType {
    /**
     * Directory / folder
     */
    Directory = 1,
    /**
     * File
     */
    File = 2,
}
