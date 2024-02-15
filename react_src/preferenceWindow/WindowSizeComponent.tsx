import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import Grid from '@mui/material/Grid'
import { MenuPaper, Paper } from '@mui/material';
import Box from "@mui/material/Box"
import { useCurConfigureStore, usePrevConfigureStore } from './definition';
import { ChangeEvent, useEffect, useState } from 'react';
type props = {
    id: string;
    preset_list : string[];
    get_default_value : string;
    onSelect_f : (str :  string )=>void;
    onselected_customize_f? : (index : number, value : number )=>void;
    customizable? : boolean
  };


function WindowSizeComponent({id, preset_list, get_default_value, onSelect_f, onselected_customize_f, customizable} : props){
    
    let inputs : number[] = [] ;
    let flag = customizable ? true : false

    const [args, set_args] = useState(inputs);
    const [default_value, set_default_value] = useState(get_default_value)
    let [disable, set_disable] = useState(true)
    let [selected_index, set_selected_index] = useState(0)
    
    
    useEffect(()=>{ 
        let idx = preset_list.findIndex((v)=>v === get_default_value)
        if(idx !== -1)
            set_selected_index(idx)

        let sel_preset = preset_list[idx]
        let [w, h] = [0,0];
        try{
            [w,h] = sel_preset.split("x").map(v=>Number(v))
            set_args([w,h])

        }catch{
            

        }finally{
            
            set_default_value(preset_list[idx])
        }
      
    }, [get_default_value])

    
    


    const handleChange = (e : ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, setup_f :(a : number)=>void) => {
        const regex = /^[0-9\b]*$/;
        if (e.target.value === "" || regex.test(e.target.value)) {

            let fx = Math.abs(Number(e.target.value))
            
            setup_f( fx);
        }
      };
    const builder =  ()=>{

        

        
        let custom_btn;
        if(customizable)
            custom_btn = <MenuItem id={id+"custom"} value={"custom"}>{"Custom"}</MenuItem>
        return ( <Grid container direction="column">
                <Grid item>
                    <FormControl >
                        <Select
                        labelId="sels"
                        id={id}
                        value={default_value}
                        style={{minWidth : "200px"}}

                        onChange={(e : SelectChangeEvent)=>{
                            if (e.target.value==="custom"){
                                set_disable(false)
                                set_default_value("custom")
                            }else{
                                // let [width, height] = e.target.value.split("x").map((v)=>Number(v))
                                set_disable(true)
                                onSelect_f(e.target.value)
                            }
                        }}>
                        {
                            preset_list.map((v, i, a)=>(
                                <MenuItem id={String(i)} value={v}>{v}</MenuItem>
                                ))
                                
                            }
                            {custom_btn}
                        </Select>
                    </FormControl>
                    </Grid>
                    { flag &&
                        <Grid  item >
                        <TextField
                        
                        disabled ={disable}
                        label="width"
                        defaultValue="0"
                        variant="filled" 
                        value = {args[0]}
                        onBlur={(e)=>{
                            let width = Number(e.target.value)
                            set_args([width, args[1]])
                            onselected_customize_f!(0, width)
                        }}

                        onChange={(e)=>{
                            handleChange(e, (w)=>{
                                let [mw,mh] = preset_list[preset_list.length-1].split("x").map(v=>Number(v))
                                if(w>mw){
                                    w = mw
                                }
                                set_args([w, args[1]])
                            })
                            
                        }}
                        InputProps={{
                            style: { margin : 1, maxWidth: "100px" }
                        }}
                        />
                        <TextField
                        disabled = {disable}
                        // id="filled-disabled"
                        label="height"
                        defaultValue="1080"
                        variant="filled"
                        onBlur={(e)=>{
                            let height = Number(e.target.value)
                            onselected_customize_f!(1, height)
                        }}
                        onChange={(e)=>{handleChange(e, (h)=>{
                            let [mw,mh] = preset_list[preset_list.length-1].split("x").map(v=>Number(v))
                                if(h>mw){
                                    h = mh
                                }
                            set_args([args[0], h]) 
                            
                        } )
                        }} 
                        value = {args[1]}
                        InputProps={{
                            style: {margin:1, maxWidth: "100px" }
                        }}
                        />
                    </Grid>
                    }
                </Grid>)

}


return (  
    <Box display="flex" justifyContent="center">
        {builder()}
    </Box>

    )
}


export default WindowSizeComponent;