import React, { MouseEventHandler } from 'react'
import ShortcutTextField from './ShortcutTextfield';
import { Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import WindowSizeComponent from './WindowSizeComponent';
import Box from '@mui/material/Box';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { CGeneral } from '../../typescript_src/definitions/types';
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx



type props = {
    id: string;
    preference_changed : Function;
    Prev_GeneralPreference : CGeneral;
  };
  
function GeneralPreference({id, preference_changed , Prev_GeneralPreference} : props){
    
    const [pip_enable, set_pip_enable] = React.useState(false);
    
    return (
        <Box >
        <Typography  fontSize={32}>General</Typography>
        <Grid container style={{maxHeight: '80%', overflow: 'auto'}} justifyContent="center" rowGap={1} spacing={1} >
            <Grid container  spacing={12} >
            <Grid item xs={6}> <Typography>Enable PiP(Picture in Picture)</Typography> </Grid>
            <Grid item xs={6}>
                    <Box display="flex" justifyContent="center">
                        <Switch checked={pip_enable} onClick={()=>{set_pip_enable(!pip_enable); 
                        if(pip_enable === Prev_GeneralPreference.pip_mode){
                            preference_changed(true);
                        }
                        }}/>
                    </Box>
                </Grid>
            </Grid>
            {/* pip location */}
            <Grid container  spacing={12} >
            <Grid item xs={6}> <Typography>PiP default location</Typography> </Grid>
            <Grid item xs={6}>
                    <Box display="flex" justifyContent="center">
                    <WindowSizeComponent id = {"pip_window_size"} values = {["1920x1080"]} />
                    </Box>
                    <Box display="flex" justifyContent="center">
                    <WindowSizeComponent id = {"pip_window_size"} values = {["1920x1080"]} />

                    </Box>
                </Grid>
            </Grid>

            <Grid container  spacing={12} >
            <Grid item xs={6}> <Typography>Default Start Service</Typography> </Grid>
            <Grid item xs={6}>
                    <Box display="flex" justifyContent="center">
                    <WindowSizeComponent id = {"pip_window_size"} values = {["1920x1080"]} />
                    </Box>
                </Grid>
            </Grid>

            <Grid container  spacing={12}>
            <Grid item xs={6}>  <Typography>PiP window Size</Typography> </Grid>
                <Grid item xs={6}> 
                    <Box display="flex" justifyContent="center">

                    <WindowSizeComponent id = {"pip_window_size"} values = {["1920x1080"]} make_appditional={true} />
                    </Box>
                </Grid>
            </Grid>
            
            <Grid container  spacing={12}>
            <Grid item xs={6}>  <Typography>Window Size</Typography> </Grid>
            <Grid item xs={6}>
            <Box display="flex" justifyContent="center">

            <WindowSizeComponent id = {"window_size"} values = {["1920x1080"]} make_appditional={true}/>
            </Box>

            </Grid>
            </Grid>
            <Grid container   justifyContent={"space-between"} spacing={12}>
            <Grid item justifyContent={"space-between"} xs={6}> <Typography>Render Full size when pip is running</Typography> </Grid>
            <Grid item justifyContent={"space-between"} xs={6}>
            <Box display="flex" justifyContent="center">
                <Switch></Switch>
            </Box>
                </Grid>
            </Grid>

            <Grid container  spacing={12}>
            <Grid item xs={6}> <Typography>Enable AutoUpdate</Typography> </Grid>
                <Grid item xs={6}>
                    <Box display="flex" justifyContent="center">
                        <Switch></Switch>
                    </Box>
                </Grid>
            </Grid>


            
            <Grid container  spacing={12}>
            <Grid item xs={6}> 
            <Typography>Dark Mode</Typography> 
            </Grid>
            <Grid item alignContent={"flex-end"} xs={6}>
            <Box display="flex" justifyContent="center">
                <Switch></Switch>
                </Box>

                </Grid>
            </Grid>

        </Grid>
        </Box>
    )
}


export default GeneralPreference;