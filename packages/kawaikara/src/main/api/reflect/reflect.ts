import 'reflect-metadata';

export function registerAction(A: any) {
    // Reflect.
}

export function registerMenu() {}

export function registerView() {}



/**
 *  @returns {void}
 */
export function injectObject(){
    // Reflect.defineMetadata()
}

@registerAction
class T {}

const a = new T();
