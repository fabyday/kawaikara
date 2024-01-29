import React, { MouseEventHandler } from 'react'
import TextField from '@mui/material/TextField';

// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
function GeneralPreference(){


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
        if((event.which === 8 || event.which === 46)) // backspace or delete.
        {
            console.log("what?")
            setPressing(false);
            setKey([]);
            return;
        }
        let check_uncahged = true;
        console.log(event)
        if(modifierKeyCodes.has(event.keyCode)){
            console.log("md?")
            setPressing(true)
            if(!(accelerator.includes(event.key))){
                console.log("md check only")
                check_uncahged = false;
                setAccelerator((prev)=>[...prev, event.key])
            }
            
            
        }else{
            
            console.log("key?")
            if(pressing){
                if(!(key.includes(event.key))){
                    setKey(p=>[...p, event.key])
                    check_uncahged = false;
                }
            else{
                setKey([])
                setCombined("")
            }
        }
    }
    console.log(key)
    console.log(accelerator)
    let reval = ""
    if(!check_uncahged)
    {
        
        let ff = (v : string, i : number, a : string[])=>{
                if (reval.length === 0){
                    reval += v    
                }else{
                    reval += "+" + v
                }
            }
            accelerator.forEach(ff)
            key.forEach(ff)
            console.log("udpate")
            console.log(reval)
            setCombined(reval);
    }
    console.log("uncahged skip it.")
};

	const handleKeyUp = (e : React.KeyboardEvent) => {
        console.log("keyup test")
        if(modifierKeyCodes.has(e.keyCode)){
            let ind = accelerator.indexOf(e.key)
            setAccelerator((prev)=>prev.splice(ind))
            setKey([])
        }else{
            let ind = key.indexOf(e.key)
            if (ind === -1) return;
            setKey((prev)=>prev.splice(ind))
        }

        if (accelerator.length ===0){
		    setPressing(false);
            console.log("del")
        }
	};
    
    const handleOnclick = (e:React.MouseEvent )=>{
        setCombined("")
        setAccelerator([])
        setKey([])
        console.log("test")
    }

    return (
        <TextField
        id="shortcut"
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={handleOnclick}
        value={combined}

      />
    )
}


export default GeneralPreference;