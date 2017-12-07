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
import * as OS from 'os';


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
export interface ValueItem extends deploy_contracts.ConditionalItem {
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
     * Gets or sets the function that returns the "other" values.
     */
    public othersProvider: ValuesProvider;

    /** @inheritdoc */
    public abstract get value();
}

/**
 * A code based value.
 */
export class CodeValue extends ValueBase<CodeValueItem> {
    /** @inheritdoc */
    constructor(item: CodeValueItem, name?: string) {
        super(item, name);
    }

    /** @inheritdoc */
    public get value() {
        const CTX: deploy_code.CodeExecutionContext = {
            code: deploy_helpers.toStringSafe(this.item.code),
            values: this.othersProvider(),
        };

        return deploy_code.exec(CTX);
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
    const APPEND_VAR = (name: string) => {
        ENV_VARS.push(new FunctionValue(() => {
            return process.env[name];
        }, name));
    };
    
    const ENV = process.env;
    if (ENV) {
        for (const N in ENV) {
            APPEND_VAR(N);
        }
    }

    return ENV_VARS;
}

/**
 * Loads values from value item settings.
 * 
 * @param {WithValueItems} items The item settings.
 * 
 * @return {Value[]} The loaded values.
 */
export function loadFromItems(items: WithValueItems) {
    const VALUES: Value[] = [];

    const CREATE_OTHERS_PROVIDER = (thisValue: Value) => {
        return () => VALUES.filter(v => v !== thisValue);
    };

    const APPEND_VALUE = (newValue: ValueBase) => {
        if (!newValue) {
            return;
        }

        newValue.othersProvider = CREATE_OTHERS_PROVIDER(newValue);

        VALUES.push(newValue);
    };

    if (items && items.values) {
        for (const NAME in items.values) {
            const VI = items.values[NAME];

            let newValue: ValueBase;

            if (deploy_helpers.isObject<ValueItem>(VI)) {
                if (deploy_helpers.filterConditionalItems(VI).length < 1) {
                    continue;
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
        Object.defineProperty(STORAGE, deploy_helpers.toStringSafe(v.name), {
            enumerable: true,
            configurable: false,

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
