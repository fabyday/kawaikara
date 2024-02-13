import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import Grid from '@mui/material/Grid'
import { MenuPaper, Paper } from '@mui/material';
import Box from "@mui/material/Box"
import { useCurConfigureStore, usePrevConfigureStore } from './definition';
import { ChangeEvent, useState } from 'react';
type props = {
    id: string;
    preset_list : string[];
    default_value : number | string;
    onSelect_f : (str :  string )=>void;
    onselected_customize_f? : (index : number, value : number )=>void;
    customizable? : boolean
  };


function WindowSizeComponent({id, preset_list, default_value, onSelect_f, onselected_customize_f, customizable} : props){
    
    let inputs : number[] = [] ;
    let flag = customizable ? true : false

    const [args, set_args] = useState(inputs);

    let [disable, set_disable] = useState(true)
    let [selected_index, set_selected_index] = useState(0)


    if(typeof default_value  === "string"){ //this type is key
        if( customizable ){
            let v = preset_list.filter((value, index)=>(value === default_value))
            let sp :string[] = default_value.split("x")
            inputs = sp.map((v)=>Number(v));
            if(v.length !== 0 ){
                set_disable(false)
                set_args(inputs)    
                set_selected_index(preset_list.length)
            }
        }else{
            inputs = [Number(default_value)]
        }
    }
    else if (typeof default_value === "number"){
        inputs = [default_value]
    }



    const handleChange = (e : ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, setup_f :(a : number)=>void) => {
        const regex = /^[0-9\b]+$/;
        if (e.target.value === "" || regex.test(e.target.value)) {
            setup_f( Math.abs(Number(e.target.value)));
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
                        labelId="demo-simple-select-label"
                        id={id}
                        value={preset_list[selected_index]}
                        style={{minWidth : "200px"}}
                        defaultValue={preset_list[selected_index]}

                        onChange={(e : SelectChangeEvent)=>{
                            if (e.target.value==="custom"){
                                set_disable(false)
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
                        defaultValue="1920"
                        variant="filled" 
                        value = {args[0]}
                        onBlur={(e)=>{
                            let width = Number(e.target.value)
                            set_args([width, args[1]])
                            onselected_customize_f!(0, width)
                        }}

                        onChange={(e)=>{
                            handleChange(e, (w)=>{set_args([w, args[1]])})
                            
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
                        onChange={(e)=>{handleChange(e, (h)=>{set_args([args[0], h]) } )}} 
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