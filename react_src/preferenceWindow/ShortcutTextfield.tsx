import React, { MouseEventHandler } from 'react'
import TextField from '@mui/material/TextField';
type props = {
    id: string;
  };



  
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
function ShortcutTextField({id}:props){


    const [ pressing, setPressing ] = React.useState(false);
	const [ accelerator , setAccelerator ] = React.useState<string[]>([]);
	const [ key, setKey ] = React.useState<string[]>([]);

    const [combined, setCombined] = React.useState<string>();
    const modifierKeyCodes = new Set([ 16, 17, 18, 91, 92, 93 ]);
	const specialKeyCodes = new Set([ 0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 91, 92, 93, 94, 95 ]);


    
    let altKeyName = 'Alt';
    let metaKeyName = 'Meta';
	if (navigator.userAgent.indexOf('Mac') !== -1) {

		altKeyName = 'Option';
		metaKeyName = 'Command';
        
	} else if (navigator.userAgent.indexOf('Win') !== -1) {
        
        metaKeyName = 'Windows';
        
	}
    
    
    const handleKeyDown = (event : React.KeyboardEvent)  => {
        
        console.log("start")
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
                accelerator.push(event.key)
                setAccelerator(accelerator)
            }
        }else{
            if(!key.includes(event.key) && accelerator.length !== 0){
                key.push(event.key)
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
        // setCombined("")
        // setAccelerator([])
        // setKey([])
        console.log("test")
    }

    return (
        <TextField
        id="shortcut"
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={handleOnclick}
        value={combined}
        inputProps={{ style: {textAlign: 'center', caretColor : "transparent"} }}

      />
    )
}


export default ShortcutTextField;