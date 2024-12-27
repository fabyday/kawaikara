import { app, BrowserWindow, BrowserView } from "electron"
import lodash from 'lodash';
import { KawaiName, KawaiPiPLocation, KawaiWindowPreference } from "./configure_locale_type";
import { KawaiConfigure, KawaiNameProperty, KawaiPreference, KawaiShortcutCollection, KawaiVersion } from "./setting_types";






export type kawaiProperty = {
    id : string,
    parent_id : string
}



type KawaiEmptyType = {}



type LOCALE_LITERAL = "LOCALE"
type CONFIG_LITERAL = "CONFIG"
type KawaiConfigType = "LOCALE" | "CONFIG";





// check Compounded Type 
type IsArray<T> = T extends any[] ? true :false
type IsCompound<T> = IsArray<T> extends true 
                    ? false 
                    : T extends object 
                      ? true 
                      : false;
type IsLeaf<T> = T extends string | number | boolean | null | undefined ? true : false




// Remove Type Optional(It means 'undefined' in object. )
export type RemoveOptionalArgs<T> = T extends undefined ? never : T

/**
 * T : Source Type 
 * D : Type You want to delete.
 */

export type KawaiRecursiveTypeRemover<Type, D> = {
        [Property in keyof Type as Exclude<Property, keyof D>] : 
                    IsCompound< RemoveOptionalArgs<Type[Property]> > extends true ? KawaiRecursiveTypeRemover<RemoveOptionalArgs<Type[Property]>, D>: Type[Property] 
  };

export type KawaiRecursiveTypeExtractor<Type, RemainderType> = {
    [ 
      Property in keyof Type  
        as IsCompound<RemoveOptionalArgs<Type[Property]>> extends true 
          ? Property 
          : Property extends keyof RemainderType 
            ? Property 
            : never  
    ] 
    : IsCompound< RemoveOptionalArgs<Type[Property]> > extends true ? KawaiRecursiveTypeExtractor<RemoveOptionalArgs<Type[Property]>, RemainderType> : Type[Property] 
    
  }




// type nested_type = KawaiNameProperty&{ dist : string}
// type test_comp_type = KawaiNameProperty & {test ?: nested_type}
// type qq = KawaiRecursiveTypeRemover<test_comp_type, KawaiNameProperty>
// type q = KawaiRecursiveTypeRemover<KawaiShortcutCollection, KawaiNameProperty>
// type t = KawaiRecursiveTypeExtractor<KawaiShortcutCollection, KawaiNameProperty>
// type a = KawaiRecursiveTypeExtractor<{Q:string, a:string}, {Q?:string}>

// type Config = KawaiRecursiveTypeExtractor<KawaiConfigure, KawaiName>

// type s = KawaiRecursiveTypeExtractor<KawaiPreference, KawaiName> 

// const test_conf : Config = { 
//                         preference : { general : { window_preference : {pip_location : {},  pip_window_size : {name : ""} }, default_main : {}}}
//         }

// type tb = KawaiRecursiveTypeExtractor<KawaiConfigure, KawaiNameProperty>
// type tt = KawaiRecursiveTypeRemover<KawaiConfigure, KawaiNameProperty>

// type Mapish = { [k: string]: boolean };
// type map = test_comp_type["test"]
// type comp = IsCompound<Mapish | nested_type | undefined> extends true ? true : false;

// type M = keyof Mapish;

// type und = Mapish | nested_type | undefined extends undefined ? true : false



// const test : q = {"name" : "", test : {"shortcut_key" : "short"}}
// const aaaaa : KawaiShortcutCollection = {"name" : "Test", "as" : {name:"test", shortcut_key : "test2"}}
 



// type cond = nested_type | undefined


// type ExtractStrings<T> = T extends string? T : never 
// type ExtractUndefined<T> = T extends undefined ? T : never
// type OnlyString = ExtractStrings<"test" | undefined>
// type OnlyStrisng = ExtractUndefined<"test" | undefined>