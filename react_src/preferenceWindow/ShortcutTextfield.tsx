import React, { MouseEventHandler, useEffect } from 'react'
import TextField from '@mui/material/TextField';
import lodash from "lodash"
import { KawaiPreference } from '../../typescript_src/definitions/setting_types';

type props = {
    id: string;
    get_shortcut_f : Function;
    set_shortcut_f : Function;
    // dup_check : Function;
    dup_check : boolean;
  };

  



/**
 * 
 * @param param0 
 * @returns 
 */
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
// function ShortcutTextField({id,get_shortcut_f, set_shortcut_f, duplication_check_f}:props){
function ShortcutTextField({id,get_shortcut_f, set_shortcut_f, dup_check}:props){


   
    
    const helper_text = "Duplication Error"
    
    const [ pressing, setPressing ] = React.useState(false);
	const [ accelerator , setAccelerator ] = React.useState<Set<string>>(new Set<string>());
	const [ key, setKey ] = React.useState<Set<string>>(new Set<string>());

    const [combined, setCombined] = React.useState<string>(get_shortcut_f());
    const modifierKeyCodes = new Set([ 16, 17, 18, 91, 92, 93 ]);
	const specialKeyCodes = new Set([ 0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 91, 92, 93, 94, 95 ]);
    




    const key_mapper = {Control : "Ctrl", Meta : "Win", Alt : "Alt", Shift : "Shift"}
    const key_mapper_inverse = {Ctrl : "Control", Win : "Meta", Alt : "Alt", Shift : "Shift"}
    type mapper_key = keyof typeof key_mapper;
    type key_mapper_invert = keyof typeof key_mapper_inverse;
    let altKeyName = 'Alt';
    let metaKeyName = 'Meta';
	if (navigator.userAgent.indexOf('Mac') !== -1) {

		altKeyName = 'Option';
		metaKeyName = 'Command';
        
	} else if (navigator.userAgent.indexOf('Win') !== -1) {
        
        metaKeyName = 'Windows';
        
	}
    
    
    const handleKeyDown = (event : React.KeyboardEvent)  => {
        
        event.preventDefault();

        if(!pressing){
            setPressing(true)
            setKey(new Set<string>())
            setAccelerator(new Set<string>())
        }


// Clear the value on backspace (8) or delete (46)
        if ((event.which === 8 || event.which === 46))
            return;

        let res_key="";

        if(modifierKeyCodes.has(event.keyCode)){
            if(!accelerator!.has(event.key))
            {
                const name = event.key as mapper_key
                accelerator!.add(key_mapper[name])
                setAccelerator(accelerator)
            }
        }else{
            if(!key.has(event.key.toUpperCase()) && accelerator!.size !== 0){
                key.add(event.key.toUpperCase())
                setKey(key)
            }
           
        }

        const f = (v:string)=>{
            if(res_key.length===0)
                res_key += v
            else 
                res_key += "+" + v
        }
        accelerator!.forEach(f)
        key.forEach(f)
        setCombined(res_key)
};

	const handleKeyUp = (event : React.KeyboardEvent) => {

        
        event.preventDefault();
        
        if(modifierKeyCodes.has(event.keyCode)){
            let key = key_mapper[event.key as mapper_key]
            if(accelerator!.has(key))
            {
                accelerator!.delete(key)
                setAccelerator(lodash.cloneDeep(accelerator) )
            }
        }else{
            if(key.has(event.key.toUpperCase())){
                
                key.delete(event.key.toUpperCase())
                setKey(  lodash.cloneDeep(key) )
            }
        }
        
        if (key.size === 0 && accelerator!.size === 0){
            setPressing(false);
            
        }


	};
    
    const handleOnclick = (e:React.MouseEvent )=>{
        
    }



    return (
        <TextField
        id="shortcut"
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={(e)=>{
            handleOnclick(e)
        }}
        onBlur={(e)=>{
            // if( !duplication_check_f(e.target.value)){
                set_shortcut_f(e.target.value)
                
            }

        }
        helperText={dup_check?helper_text:''}
        value={combined}
        error={dup_check}
        inputProps={{ style: {textAlign: 'center', caretColor : "transparent"} }}

      />
    )
}


export default ShortcutTextField;