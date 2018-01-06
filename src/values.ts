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

import * as deploy_code from './code';
import * as deploy_contracts from './contracts';
import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as Enumerable from 'node-enumerable';
import * as FS from 'fs';
import * as i18 from './i18';
import * as OS from 'os';
import * as Path from 'path';
import * as SanitizeFilename from 'sanitize-filename';

/**
 * An object that can apply to (its) properties by using
 * generated values by placeholders.
 */
export interface Applyable {
    /**
     * A list of property names and their values
     * that should be applied to that object.
     */
    readonly applyValuesTo?: { [prop: string]: any };
}

/**
 * An item of a static value.
 */
export interface CodeValueItem extends ValueItem {
    /**
     * The code to execute.
     */
    readonly code: string;
}

/**
 * A function that provides one or more scope directories
 * to map from relative paths.
 */
export type DirectoryScopeProvider = () => string | string[];

/**
 * An item for an value based on an environment variable.
 */
export interface EnvVarValueItem extends ValueItem {
    /**
     * The optional alias to use.
     */
    readonly alias?: string;
}

/**
 * An item of a file value.
 */
export interface FileValueItem extends ValueItem {
    /**
     * The encoding to use for converting from binary data to string.
     */
    readonly encoding?: string;
    /**
     * The path to the file where the data is stored.
     */
    readonly file: string;
    /**
     * The target format to use.
     */
    readonly format?: string;
}

/**
 * Options for 'loadFromItems()' function.
 */
export interface LoadFromItemsOptions {
    /**
     * A custom filter for the items.
     */
    readonly conditialFilter?: (item: ValueItem, others: Value[]) => boolean;
    /**
     * The optional scope directory provider.
     */
    readonly directoryScopeProvider?: DirectoryScopeProvider;
    /**
     * An optional function with provides "more" values
     * which are added at the beginning.
     */
    readonly prefixValuesProvider?: ValuesProvider;
}

/**
 * An item of a static value.
 */
export interface StaticValueItem extends ValueItem {
    /**
     * The value.
     */
    readonly value: any;
}

/**
 * A value.
 */
export interface Value {
    /**
     * The name of the value (if available).
     */
    readonly name?: string;
    /**
     * The value.
     */
    readonly value: any;
}

/**
 * A value item.
 */
export interface ValueItem extends deploy_contracts.ConditionalItem,
                                   deploy_contracts.PlatformItem {
    /**
     * Cache value or not.
     */
    readonly cache?: boolean;
    /**
     * The type of the item.
     */
    readonly type?: string;
}

/**
 * A storage of value items.
 */
export type ValueItemStorage = { [ name: string ]: any };

/**
 * A function that provides values.
 */
export type ValuesProvider = () => Value | Value[];

/**
 * A value storage.
 */
export type ValueStorage = { [ name: string ]: Value };

/**
 * An object that contains value items.
 */
export interface WithValueItems {
    /**
     * The items.
     */
    readonly values?: ValueItemStorage;
}


const NOT_CACHED_YET = Symbol('NOT_CACHED_YET');

/**
 * A basic value.
 */
export abstract class ValueBase<TItem extends ValueItem = ValueItem> implements Value {
    private readonly _NAME: string;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {TItem} item The underlying item.
     * @param {string} [name] The additional name of the value.
     */
    constructor(public readonly item: TItem,
                name?: string) {
        this._NAME = normalizeValueName(name);
    }

    /** @inheritdoc */
    public get name() {
        return this._NAME;
    }

    /**
     * Gets the list of "other" values.
     */
    public get others(): Value[] {
        let provider = this.othersProvider;
        if (!provider) {
            provider = () => [];
        }

        return deploy_helpers.asArray(
            provider(),
        );
    }

    /**
     * Gets or sets the function that returns the "other" values.
     */
    public othersProvider: ValuesProvider;

    /** @inheritdoc */
    public abstract get value(): any;
}

/**
 * A code based value.
 */
export class CodeValue extends ValueBase<CodeValueItem> {
    /** @inheritdoc */
    public get value() {
        const CTX: deploy_code.CodeExecutionContext = {
            code: this.item.code,
            context: {
                v: this,
            },
            values: this.others,
        };

        return deploy_code.exec(CTX);
    }
}

/**
 * A value of an environment variable.
 */
export class EnvVarValue extends ValueBase<EnvVarValueItem> {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {string} name The name of the environment variable.
     * @param {EnvVarValueItem} item The underlying item.
     */
    constructor(name: string, item?: EnvVarValueItem) {
        super(item || <any>{},
              name);
    }

    /** @inheritdoc */
    public get name() {
        if (!deploy_helpers.isEmptyString(this.item.alias)) {
            return deploy_helpers.toStringSafe(this.item.alias);
        }

        return super.name;
    }

    /** @inheritdoc */
    public get value() {
        const ENV = process.env;
        if (ENV) {
            return process.env[ super.name ];
        }
    }
} 

/**
 * A value based on a local file.
 */
export class FileValue extends ValueBase<FileValueItem> {

    /**
     * Initializes a new instance of that class.
     * 
     * @param {FileValueItem} item The underlying item.
     * @param {string} [name] The additional name of the value.
     * @param {DirectoryScopeProvider} [scopes] A optional function that provides one or more directories for mapping relative paths.
     */
    constructor(item: FileValueItem,
                name?: string,
                private _SCOPE_PROVIDER?: DirectoryScopeProvider) {
        super(item, name);

        if (!this._SCOPE_PROVIDER) {
            this._SCOPE_PROVIDER = () => [];
        }
    }

    /**
     * Gets the full path of the underlying or (false) if it does not exist.
     */
    public get file(): string | false {
        let filePath = deploy_helpers.toStringSafe(this.item.file);
        if (deploy_helpers.isEmptyString(filePath)) {
            let fn = deploy_helpers.toStringSafe(this.name).trim();
            if ('' === fn) {
                fn = 'value';
            }
            fn = SanitizeFilename(fn);

            filePath = `./${fn}`;
        }

        if (Path.isAbsolute(filePath)) {
            if (FS.existsSync(filePath)) {
                if (FS.lstatSync(filePath).isFile()) {
                    return Path.resolve(filePath);  // exists         
                }
            }
        }
        else {
            // try to find existing full path
            for (const S of this.scopes) {
                const FULL_PATH = Path.join(
                    S, filePath
                );

                if (FS.existsSync(FULL_PATH)) {
                    if (FS.lstatSync(FULL_PATH).isFile()) {
                        return Path.resolve(FULL_PATH);  // found              
                    }
                }
            }
        }

        return false;
    }

    /**
     * Gets the list of directory scopes.
     */
    public get scopes(): string[] {
        let listOfScopes = deploy_helpers.asArray(
            this._SCOPE_PROVIDER()
        );

        listOfScopes = Enumerable.from(listOfScopes).select(s => {
            return deploy_helpers.toStringSafe(s);
        }).where(s => {
            return !deploy_helpers.isEmptyString(s);
        }).select(s => {
            if (!Path.isAbsolute(s)) {
                s = Path.join(process.cwd(), s);
            }

            return s;
        }).toArray();

        if (listOfScopes.length < 1) {
            listOfScopes.push(
                deploy_helpers.getExtensionDirInHome()
            );

            listOfScopes.push( process.cwd() );
        }

        return listOfScopes.map(s => {
            return Path.resolve(s);
        });
    }

    /** @inheritdoc */
    public get value() {
        const FILE = this.file;
        if (false === FILE) {
            throw new Error(i18.t('fileNotFound',
                                  this.item.file));
        }

        let val = fromBuffer(
            FS.readFileSync(FILE),
            this.item.format,
            this.item.encoding,
            this.others,
        );

        return val;
    }
}

/**
 * A value based on a function.
 */
export class FunctionValue implements Value {
    private readonly _NAME: string;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {Function} func The function that provides the value.
     * @param {string} [name] The optional name.
     * @param {any} [thisArgs] The underlying object / value for the function.
     */
    constructor(public readonly func: Function,
                name?: string,
                thisArgs?: any) {
        this._NAME = normalizeValueName(name);

        this.thisArgs = arguments.length < 3 ? this : thisArgs;
    }

    /** @inheritdoc */
    public get name() {
        return this._NAME;
    }

    /**
     * The underlying object / value for the function.
     */
    public thisArgs: any;

    /** @inheritdoc */
    public get value() {
        if (this.func) {
            return this.func
                       .apply(this.thisArgs, []);
        }
    }
}

/**
 * A static value.
 */
export class StaticValue extends ValueBase<StaticValueItem> {
    /** @inheritdoc */
    public get value() {
        return this.item.value;
    }
}

class WrappedBaseValue implements Value {
    private _cachedValue?: any = NOT_CACHED_YET;

    constructor(public readonly baseValue: ValueBase) {
    }

    public get cache(): boolean {
        return deploy_helpers.toBooleanSafe(
            this.item.cache, true
        );
    }
    
    public get isCached() {
        return this._cachedValue !== NOT_CACHED_YET;
    }

    public get item() {
        return this.baseValue.item;
    }

    public get name() {
        return this.baseValue.name;
    }

    public reset(): this {
        this._cachedValue = NOT_CACHED_YET;
        
        return this;
    }

    public get value() {
        if (this.cache) {
            if (this.isCached) {
                return this._cachedValue;
            }
        }

        let valueToReturn = this.baseValue.value;

        if (this.cache) {
            this._cachedValue = valueToReturn;
        }

        return valueToReturn;
    }
}


/**
 * Applies values to an object.
 * 
 * @param {TObj} obj The object to apply the values to.
 * @param {Function} valueProvider The function that provides the values to apply to string based propertis.
 * 
 * @return {TObj} The new object.
 */
export function applyValuesTo<TObj extends Applyable = Applyable>(obj: TObj, 
                                                                  valueProvider: () => Value | Value[]): TObj {
    if (!valueProvider) {
        valueProvider = () => [];
    }

    const DO_NOT_APPLY_SELF = Symbol('DO_NOT_APPLY_SELF');
    const SELF_PROP = 'applyValuesTo';

    if (obj) {
        const NEW_OBJ: any = {};
        for (const P in obj) {
            NEW_OBJ[P] = obj[P];
        }

        const APPLY_TO = obj[SELF_PROP];
        let selfValue: any = DO_NOT_APPLY_SELF;

        const MAKE_PLACEHOLDER_PROPERTY = (prop: string, val: any) => {
            delete NEW_OBJ[prop];

            Object.defineProperty(NEW_OBJ, prop, {
                enumerable: true,

                get: () => {
                    let resultValue = val;
                    if (deploy_helpers.isString(resultValue)) {
                        // handle as template
                        // with placeholders
                        resultValue = replaceWithValues(valueProvider(),
                                                        resultValue);
                    }

                    return resultValue;
                },

                set: (newValue) => {
                    val = newValue;
                }
            });
        };

        if (APPLY_TO) {
            for (const P in APPLY_TO) {
                const VALUE = APPLY_TO[P];
                
                if (SELF_PROP === P) {
                    selfValue = VALUE;
                }
                else {
                    MAKE_PLACEHOLDER_PROPERTY(P, VALUE);
                }
            }
        }

        if (selfValue !== DO_NOT_APPLY_SELF) {
            MAKE_PLACEHOLDER_PROPERTY(SELF_PROP, selfValue);
        }

        obj = NEW_OBJ;
    }
    
    return obj;
}

function fromBuffer(buff: Buffer, format?: string, enc?: string,
                    values?: Value | Value[]): any {
    format = deploy_helpers.normalizeString(format);

    enc = deploy_helpers.normalizeString(enc);
    if ('' === enc) {
        enc = 'utf8';
    }

    if (!buff) {
        return <any>buff;
    }
    
    switch (format) {
        case '':
        case 'str':
        case 'string':
            return buff.toString(enc);

        case 'bin':
        case 'binary':
        case 'blob':
        case 'buffer':
            return buff;

        case 'b64':
        case 'base64':
            return buff.toString('base64');

        case 'json':
            return JSON.parse(
                buff.toString(enc)
            );

        case 'template':
        case 'tpl':
            return replaceWithValues(
                values,
                buff.toString(enc),
            );

        default:
            throw new Error(i18.t('values.errors.targetFormatNotSupported',
                                  format));
    }
}

/**
 * Returns a list of predefined values.
 * 
 * @return {Value[]} The list of values.
 */
export function getPredefinedValues(): Value[] {
    const PREDEFINED_VALUES: Value[] = [];

    // ${cwd}
    PREDEFINED_VALUES.push(new FunctionValue(() => {
        return process.cwd();
    }, 'cwd'));

    // ${EOL}
    PREDEFINED_VALUES.push(new FunctionValue(() => {
        return OS.EOL;
    }, 'EOL'));

    // ${extensionDir}
    PREDEFINED_VALUES.push(new FunctionValue(() => {
        return deploy_helpers.getExtensionDirInHome();
    }, 'extensionDir'));

    // ${homeDir}
    PREDEFINED_VALUES.push(new FunctionValue(() => {
        return OS.homedir();
    }, 'homeDir'));

    // ${hostName}
    PREDEFINED_VALUES.push(new FunctionValue(() => {
        return OS.hostname();
    }, 'hostName'));

    // ${tempDir}
    PREDEFINED_VALUES.push(new FunctionValue(() => {
        return OS.tmpdir();
    }, 'tempDir'));

    // ${userName}
    PREDEFINED_VALUES.push(new FunctionValue(() => {
        return OS.userInfo().username;
    }, 'userName'));

    return PREDEFINED_VALUES;
}

/**
 * Returns value instances of the current list of environment variables.
 * 
 * @return {Value[]} Placeholders of process's environment variables.
 */
export function getEnvVars(): Value[] {
    const ENV_VARS: Value[] = [];

    const ENV = process.env;
    if (ENV) {
        for (const N in ENV) {
            ENV_VARS.push(
                new EnvVarValue(N),
            );
        }
    }

    return ENV_VARS;
}

/**
 * Loads values from value item settings.
 * 
 * @param {WithValueItems} items The item settings.
 * @param {Function} [conditialFilter] 
 * 
 * @return {Value[]} The loaded values.
 */
export function loadFromItems(items: WithValueItems, opts?: LoadFromItemsOptions) {
    if (!opts) {
        opts = <any>{};
    }

    let conditialFilter = opts.conditialFilter;
    let directoryScopeProvider = opts.directoryScopeProvider;
    
    let prefixValuesProvider = opts.prefixValuesProvider;
    if (!prefixValuesProvider) {
        prefixValuesProvider = () => [];
    }

    const VALUES: Value[] = [];

    const CREATE_OTHERS_PROVIDER = (thisValue: Value): ValuesProvider => {
        return () => deploy_helpers.asArray( prefixValuesProvider() ).concat(
            VALUES
        ).filter(v => v !== thisValue);
    };

    const APPEND_VALUE = (newValue: ValueBase) => {
        if (!newValue) {
            return;
        }

        newValue.othersProvider = CREATE_OTHERS_PROVIDER(newValue);

        VALUES.push(
            new WrappedBaseValue(newValue)
        );
    };

    if (!conditialFilter) {
        conditialFilter = (i, o) => {
            let doesMatch: any;

            try {
                doesMatch = Enumerable.from( deploy_helpers.asArray(i.if) ).all((c) => {
                    let res: any;

                    const IF_CODE = deploy_helpers.toStringSafe(c);
                    if (!deploy_helpers.isEmptyString(IF_CODE)) {
                        res = deploy_code.exec({
                            code: IF_CODE,
                            context: {
                                i: i,
                            },
                            values: [].concat( getPredefinedValues() )
                                      .concat( getEnvVars() )
                                      .concat( o ),
                        });
                    }

                    return deploy_helpers.toBooleanSafe(res, true);
                });
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace('values.loadFromItems().conditialFilter()');

                doesMatch = false;
            }

            return doesMatch;
        };
    }

    if (!directoryScopeProvider) {
        directoryScopeProvider = () => [];
    }

    if (items && items.values) {
        for (const NAME in items.values) {
            const VI = items.values[NAME];

            let newValue: ValueBase;

            if (deploy_helpers.isObject<ValueItem>(VI)) {
                if (deploy_helpers.filterPlatformItems(VI).length < 1) {
                    continue;  // not for platform
                }

                if (!deploy_helpers.toBooleanSafe( conditialFilter(VI, VALUES), true )) {
                    continue;  // condition failed
                }

                const TYPE = deploy_helpers.normalizeString(VI.type);
                switch (TYPE) {
                    case '':
                    case 'static':
                        newValue = new StaticValue(<StaticValueItem>VI, NAME);
                        break;

                    case 'code':
                    case 'ecmascript':
                    case 'javascript':
                    case 'js':
                        newValue = new CodeValue(<CodeValueItem>VI, NAME);
                        break;

                    case 'env':
                    case 'environment':
                        newValue = new EnvVarValue(NAME, <EnvVarValueItem>VI);
                        break;

                    case 'file':
                        newValue = new FileValue(
                            <FileValueItem>VI,
                            NAME,
                            directoryScopeProvider,
                        );
                        break;

                    default:
                        deploy_log.CONSOLE
                                  .warn(i18.t('values.typeNotSupported',
                                              TYPE),
                                        'values.loadFromItems().ValueItem');
                        break;
                }
            }
            else {
                const STATIC_VALUE_ITEM: StaticValueItem = {
                    type: 'static',
                    value: VI
                };

                newValue = new StaticValue(STATIC_VALUE_ITEM, NAME);
            }
    
            APPEND_VALUE(newValue);
        }
    }

    return VALUES;
}

function normalizeValueList(values: Value | Value[]): ValueStorage {
    const STORAGE: ValueItemStorage = {};

    // last wins
    for (const V of deploy_helpers.asArray(values)) {
        const VALUE_NAME = deploy_helpers.normalizeString(V.name);

        STORAGE[VALUE_NAME] = V;
    }

    return STORAGE;
}

function normalizeValueName(name: any): string {
    name = deploy_helpers.toStringSafe(name).trim();
    if ('' === name) {
        name = undefined;
    }

    return name;
}

/**
 * Handles a value as string and replaces placeholders.
 * 
 * @param {Value|Value[]} values The "placeholders".
 * @param {any} val The value to parse.
 * @param {boolean} [throwOnError] Throw on error or not.
 * 
 * @return {string} The parsed value.
 */
export function replaceWithValues(values: Value | Value[], val: any,
                                  throwOnError = false) {
    throwOnError = deploy_helpers.toBooleanSafe(throwOnError);

    if (!deploy_helpers.isNullOrUndefined(val)) {
        let str = deploy_helpers.toStringSafe(val);

        const STORAGE = normalizeValueList(values);
        for (const VALUE_NAME in STORAGE) {
            try {
                const V = STORAGE[VALUE_NAME];
                
                // ${VALUE_NAME}
                str = str.replace(/(\$)(\{)([^\}]*)(\})/gm, (match, varIdentifier, openBracket, varName: string, closedBracked) => {
                    let newValue: string = match;

                    if (VALUE_NAME === deploy_helpers.normalizeString(varName)) {
                        try {
                            newValue = deploy_helpers.toStringSafe(V.value);
                        }
                        catch (e) {
                            deploy_log.CONSOLE
                                      .trace(e, 'values.replaceWithValues(2)');
                        }
                    }

                    return newValue;
                });
            }
            catch (e) {
                deploy_log.CONSOLE
                          .trace(e, 'values.replaceWithValues(1)');

                if (throwOnError) {
                    throw e;
                }
            }
        }

        return str;
    }
}

/**
 * Converts a list of values to a storage.
 * 
 * @param {Value|Value[]} values One or more values.
 * 
 * @return {ValueStorage} The new storage.
 */
export function toValueStorage(values: Value | Value[]): ValueStorage {
    const STORAGE: ValueStorage = {};
    const APPEND_VALUE = (v: Value) => {
        // STORAGE[NAME] => v.name
        Object.defineProperty(STORAGE, deploy_helpers.normalizeString(v.name), {
            enumerable: true,
            configurable: true,

            get: () => {
                return v.value;
            }
        });
    };

    deploy_helpers.asArray(values).forEach(v => {
        APPEND_VALUE(v);
    });

    return STORAGE;
}
