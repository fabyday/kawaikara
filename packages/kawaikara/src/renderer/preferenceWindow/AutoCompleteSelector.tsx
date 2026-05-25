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
    value : string,
    select_f : (text : string)=>void;
    onselected_customize_f? : (index : number, width : number )=>void;
  };




function KawaiAutoCompleteSelector({id, title, preset_list, value , select_f, onselected_customize_f} : props){


  


return (  
    <Grid  container  spacing={12}  alignItems="center" justifyContent="center">
            <Grid item xs={6} justifyContent="center" width="100%"> <Typography  align="left" >{title}</Typography> </Grid>
            <Grid item xs={6}  justifyContent="center" alignItems="center">
                    <Box  display="flex" flexDirection="column" justifyContent="flex-start" alignItems="flex-start">
                    <WindowSizeComponent id = {id}
                            preset_list = {preset_list} 
                            value={value}
                            onSelect_f={select_f}
                            onselected_customize_f={onselected_customize_f}
                            />
                    </Box>
                </Grid>
            </Grid>

    )
}


export default KawaiAutoCompleteSelector;