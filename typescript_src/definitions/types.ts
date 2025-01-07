import { app, BrowserWindow, BrowserView } from 'electron';
import lodash from 'lodash';
import {
    KawaiConfigure,
    KawaiNameProperty,
    KawaiPreference,
    KawaiShortcutCollection,
    KawaiVersion,
} from './setting_types';

type LOCALE_LITERAL = 'LOCALE';
type CONFIG_LITERAL = 'CONFIG';
type KawaiConfigType = 'LOCALE' | 'CONFIG';

type LeafType = string | number | boolean | null | undefined;
type ArrayType = any[];
type ObjectType = object;
// check Compounded Type
type IsArray<T> = T extends any[] ? true : false;
type IsCompound<T> =
    IsArray<T> extends true ? false : T extends ObjectType ? true : false;
type IsLeaf<T> = T extends LeafType ? true : false;

// type extract
type ExtractCompound<T> = T extends ObjectType ? T : never;
type ExtractLeaf<T> = T extends LeafType ? T : never;

// Remove Type Optional(It means 'undefined' in object. )
export type RemoveOptionalArgs<T> = T extends undefined ? never : T;

/**
 * T : Source Type
 * D : Type You want to delete.
 */

export type KawaiRecursiveTypeRemover<Type, D> = {
    [Property in keyof Type as Exclude<Property, keyof D>]: IsCompound<
        RemoveOptionalArgs<Type[Property]>
    > extends true
        ? KawaiRecursiveTypeRemover<RemoveOptionalArgs<Type[Property]>, D>
        : Type[Property];
};

export type KawaiRecursiveTypeExtractor<Type, RemainderType> = {
    [Property in keyof Type as IsCompound<
        ExtractCompound<Type[Property]>
    > extends true
        ? Property
        : Property extends keyof RemainderType
          ? Property
          : never]: IsCompound<ExtractCompound<Type[Property]>> extends true // as IsCompound<RemoveOptionalArgs<Type[Property]>> extends true // what if object( nested item like component or compounded item.)
        ?
              | KawaiRecursiveTypeExtractor<
                    ExtractCompound<Type[Property]>,
                    RemainderType
                >
              | ExtractLeaf<Type[Property]>
        : Type[Property];
};

export type KawaiActionType = 'category' | 'shortcut' | 'descriptor';
export type KawaiAction = {
    action_type: KawaiActionType;
    target_id: string;
};
