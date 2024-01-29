import React, { MouseEventHandler } from 'react'
import ShortcutTextField from './ShortcutTextfield';
import { Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import WindowSizeComponent from './WindowSizeComponent';

import Select, { SelectChangeEvent } from '@mui/material/Select';

// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
type props = {
    id: string;
  };
  
function GeneralPreference({id} : props){

   

    return (
        <div>
        <Typography  fontSize={32}>General</Typography>
        <Grid container  rowGap={1} spacing={1} >
            <Grid container  spacing={12} >
            <Grid item xs={6}> <Typography>Enable PiP(Picture in Picture)</Typography> </Grid>
            <Grid item xs={6}><Switch inputProps={{}} ></Switch></Grid>
            </Grid>
            
            <Grid container  spacing={12}>
            <Grid item xs={6}>  <Typography>PiP window Size</Typography> </Grid>
                <Grid item xs={6}> 
                    <WindowSizeComponent id = {"pip_window_size"} values = {["1920x1080"]} />
                </Grid>
            </Grid>
            
            <Grid container  spacing={12}>
            <Grid item xs={6}>  <Typography>Window Size</Typography> </Grid>
            <Grid item xs={6}>
            <WindowSizeComponent id = {"window_size"} values = {["1920x1080"]} />

            </Grid>
            </Grid>
            <Grid container   spacing={12}>
            <Grid item justifyContent={"space-between"} xs={6}> <Typography>Render Full size when pip is running</Typography> </Grid>
            <Grid item justifyContent={"space-between"} xs={6}><Switch></Switch></Grid>
            </Grid>

            <Grid container  spacing={12}>
            <Grid item xs={6}> <Typography>Enable AutoUpdate</Typography> </Grid>
            <Grid item alignContent={"flex-end"} xs={6}><Switch></Switch></Grid>
            </Grid>


            
            <Grid container  spacing={12}>
            <Grid item xs={6}> <Typography>Color</Typography> </Grid>
            <Grid item alignContent={"flex-end"} xs={6}><Switch></Switch></Grid>
            </Grid>

        </Grid>
        </div>
    )
}


export default GeneralPreference;