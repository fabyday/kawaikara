import React, { MouseEventHandler } from 'react'
import ShortcutTextField from './ShortcutTextfield';
import { Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import WindowSizeComponent from './WindowSizeComponent';
import Box from '@mui/material/Box';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { CGeneral, Configure } from '../../typescript_src/definitions/types';
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
import KawaiSwitch from './Switch';
import KawaiAutoCompleteSelector from "./AutoCompleteSelector"

type props = {
    id: string;
    preference_changed : Function;
    loaded_config : Configure;
  };
  
function GeneralPreference({id, preference_changed , loaded_config} : props){
    let default_name :string = "general"

    const e_helper_f = ()=>{

    }


    return (
        <Box >
        <Typography  fontSize={32}>General</Typography>
        <Grid container style={{maxHeight: '80%', overflow: 'auto'}} justifyContent="center" rowGap={1} spacing={1} >
            <KawaiSwitch onclick={(e)=>{}} id = {"enable-pip"} title={"Enable PiP(Picture in Picture)"}/>
            <KawaiAutoCompleteSelector id ={"pip-default-location"} title={"PiP default location"} values={["1920"]}/>
            <KawaiAutoCompleteSelector id ={""} title={"Default Start Service"} values={["1920"]}/>
            <KawaiAutoCompleteSelector id ={"pip-win-size"} title={"PiP window Size"} values={["1920"]} custom_size={true}/>
            <KawaiAutoCompleteSelector id ={"win-size"} title={"Window Size"} values={["1920"]} custom_size={true}/>
            <KawaiSwitch onclick={(e)=>{}} id = {"render-fullsize-mode"} title={"Render Full size when pip is running"}/>
            <KawaiSwitch onclick={(e)=>{}} id = {"enable-autoupdate"} title={"Enable AutoUpdate"}/>
            <KawaiSwitch onclick={(e)=>{}} id = {"enable-darkmode"} title={"Dark Mode"}/>
        </Grid>
        </Box>
    )
}


export default GeneralPreference;