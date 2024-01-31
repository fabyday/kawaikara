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
import React from 'react';
import WindowSizeComponent from './WindowSizeComponent';


type onclick_prop = (boolean)=>void 
type props = {
    id: string;
    title : string
    values : string[]
    custom_size? : boolean
  };




function KawaiAutoCompleteSelector({id, title, values, custom_size} : props){


  
let [checked , set_checked] = React.useState(false);

return (  
    <Grid container  spacing={12} >
            <Grid item xs={6}> <Typography>{title}</Typography> </Grid>
            <Grid item xs={6}>
                    <Box display="flex" justifyContent="center">
                    <WindowSizeComponent id = {"pip_window_size"} values = {values} make_appditional={custom_size}/>
                    </Box>
                </Grid>
            </Grid>

    )
}


export default KawaiAutoCompleteSelector;