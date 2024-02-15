import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import Grid from '@mui/material/Grid'
import { MenuPaper, Paper } from '@mui/material';
import Box from "@mui/material/Box"
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import React, { useEffect } from 'react';
import WindowSizeComponent from './WindowSizeComponent';


type onclick_prop = (a : boolean)=>void 
type props = {
    id: string;
    title : string
    preset_list : string[],
    get_default_value : string,
    additional_textedit? : boolean
    select_f : (text : string)=>void;
    onselected_customize_f? : (index : number, width : number )=>void;
  };




function KawaiAutoCompleteSelector({id, title, preset_list, get_default_value , select_f, onselected_customize_f, additional_textedit} : props){


  
let [default_val , set_checked] = React.useState(get_default_value);


useEffect(()=>{
    set_checked(get_default_value)
}, [get_default_value])
return (  
    <Grid container  spacing={12} >
            <Grid item xs={6}> <Typography>{title}</Typography> </Grid>
            <Grid item xs={6}>
                    <Box display="flex" justifyContent="center">
                    <WindowSizeComponent id = {id} 
                            preset_list = {preset_list} 
                            get_default_value={default_val}
                            onSelect_f={select_f}
                            onselected_customize_f={onselected_customize_f}
                            customizable={additional_textedit}/>
                    </Box>
                </Grid>
            </Grid>

    )
}


export default KawaiAutoCompleteSelector;