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
import { useCurConfigureStore } from './definition';
type props = {
    id: string;
  };
  
function GeneralPreference({id} : props){

    const [pip_mode, setPiPmode] = useCurConfigureStore((state)=>[state.general?.pip_mode, state.set_pip_mode])
    return (
        <Box >
        <Typography  fontSize={32}>General</Typography>
        <Grid container style={{maxHeight: '80%', overflow: 'auto'}} justifyContent="center" rowGap={1} spacing={1} >
            <KawaiSwitch onclick={(e)=>{
                const l = pip_mode
                setPiPmode(!l)}} id = {"enable-pip"} title={"Enable PiP(Picture in Picture)"}/>
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