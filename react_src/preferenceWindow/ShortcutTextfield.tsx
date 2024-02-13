import React, { MouseEventHandler, useEffect } from 'react'
import TextField from '@mui/material/TextField';
import { save_flag } from './definition';
type props = {
    id: string;
    get_shortcut_f : Function;
    set_shortcut_f : Function;
    duplication_check_f : Function;
  };



  
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
function ShortcutTextField({id,get_shortcut_f, set_shortcut_f, duplication_check_f}:props){


    const shourtcut_map = save_flag(state=>state.shortcut_to_id_map)
   

    const [ isError, setError ] = React.useState(false);
    const [ helptext, setHelpText ] = React.useState("");
    const helper_text = "Duplication Error"

    const [ pressing, setPressing ] = React.useState(false);
	const [ accelerator , setAccelerator ] = React.useState<string[]>([]);
	const [ key, setKey ] = React.useState<string[]>([]);

    const [combined, setCombined] = React.useState<string>(get_shortcut_f());
    const modifierKeyCodes = new Set([ 16, 17, 18, 91, 92, 93 ]);
	const specialKeyCodes = new Set([ 0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 91, 92, 93, 94, 95 ]);
    useEffect(()=>{
        let t = shourtcut_map.get(combined)
        if(typeof t !== "undefined")
        if(t!.size >=2 && t?.has(id)){
                console.log("suer man helper!")
                setError(true)
                setHelpText(helper_text)
            }
    }, [shourtcut_map])
    const key_mapper = {Control : "Ctrl", Meta : "Win", Alt : "Alt", Shift : "Shift"}
    type mapper_key = keyof typeof key_mapper;
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
            setKey([])
            setAccelerator([])
        }


// Clear the value on backspace (8) or delete (46)
        if ((event.which === 8 || event.which === 46))
            return;

        let res_key="";

        if(modifierKeyCodes.has(event.keyCode)){
            if(!accelerator.includes(event.key))
            {
                const name = event.key as mapper_key
                accelerator.push(key_mapper[name])
                setAccelerator(accelerator)
            }
        }else{
            if(!key.includes(event.key) && accelerator.length !== 0){
                key.push(event.key.toUpperCase())
                setKey(key)
            }else{
                setKey([])
            }
        }

        const f = (v:string,i:number,a:string[])=>{
            if(res_key.length===0)
                res_key += v
            else 
                res_key += "+" + v
        }
        accelerator.forEach(f)
        key.forEach(f)
        setCombined(res_key)
};

	const handleKeyUp = (event : React.KeyboardEvent) => {
        event.preventDefault();
        if(modifierKeyCodes.has(event.keyCode)){
            if(accelerator.includes(event.key))
            {
                const idx = accelerator.indexOf(event.key)
                accelerator.splice(idx)
                setAccelerator(accelerator)
            }
        }else{
            if(key.includes(event.key)){
                
                const idx = key.indexOf(event.key)
                key.splice(idx)
                setKey(key)
            }
        }

        if (key.length === 0 && accelerator.length === 0)
            setPressing(false);


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
            if( duplication_check_f(e.target.value)){
                setError(false)
                set_shortcut_f(e.target.value)
                setHelpText("")

            }
            else{
                setError(true)
                setHelpText(helper_text)
            }

        }}
        helperText={helptext}
        value={combined}
        error={isError}
        inputProps={{ style: {textAlign: 'center', caretColor : "transparent"} }}

      />
    )
}


export default ShortcutTextField;