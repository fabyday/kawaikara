import React, { MouseEventHandler } from 'react'
import ShortcutTextField from './ShortcutTextfield';
import { Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import WindowSizeComponent from './WindowSizeComponent';
import Box from '@mui/material/Box';
import Select, { SelectChangeEvent } from '@mui/material/Select';

// see also

// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
import KawaiSwitch from './Switch';
import KawaiAutoCompleteSelector from "./AutoCompleteSelector"
import { useCurConfigureStore } from './definition';

  
function GeneralPreference(){

    const [set_property, get_property] = useCurConfigureStore((state)=>[state.set_property, state.get_property])

    const f = (value : string)=>{
        const [width, height] = value.split("x").map((v)=>Number(v))
        set_property("configure.general.pip_location.preset_location_list.width", width)
        set_property("configure.general.pip_location.preset_location_list.width", height)

    }

    return (
        <Box >
        <Typography  fontSize={32}>{get_property("configure.general")?.name}</Typography>
        <Grid container style={{maxHeight: '80%', overflow: 'auto'}} justifyContent="center" rowGap={1} spacing={1} >
            <KawaiSwitch onclick={(e)=>{ set_property("configure.general.pip_mode", !(get_property("configure.general.pip_mode")?.item as boolean)) }} 
                id = {get_property("configure.general.pip_mode")?.id as string} 
                title={get_property("configure.general.pip_mode")?.name as string}/>

            <KawaiAutoCompleteSelector 
                id ={get_property("configure.general.pip_location.location")?.id as string} 
                title={get_property("configure.general.pip_location.location")?.name as string} 
                preset_list={get_property("configure.general.pip_location.preset_location_list")?.item as string[] ?? ["test2","test"] }
                additional_textedit = {true}
                select_f={}
                onselected_customize_f={}

                />

{/* 
            <KawaiAutoCompleteSelector 
                id ={get_property("configure.general.default_main")?.id as string} 
                title={get_property("configure.general.default_main")?.name as string} 
                values={["1"]}/>

            <KawaiAutoCompleteSelector 
                id ={get_property("configure.general.pip_window_size")?.id as string} 
                title={get_property("configure.general.pip_window_size")?.name as string} 
                values={["1920"]} 
                custom_size={true}/>

            <KawaiAutoCompleteSelector 
                id ={get_property("configure.general.window_size")?.id as string} 
                title={get_property("configure.general.window_size")?.name as string} 
                values={get_property("configure.general.window_size.preset_list")?.item as string[] ?? [""]}
                custom_size={true}/>

            <KawaiSwitch onclick={(e)=>{}} 
                id = { get_property("configure.general.render_full_size_when_pip_running")?.id as string} 
                title={get_property("configure.general.render_full_size_when_pip_running")?.name as string}/>

            <KawaiSwitch onclick={(e)=>{}} 
                id = {get_property("configure.general.enable_autoupdate")?.id as string} 
                title={get_property("configure.general.enable_autoupdate")?.name as string}/>

            <KawaiSwitch onclick={(e)=>{}} 
                id = {get_property("configure.general.dark_mode")?.id as string} 
                title={get_property("configure.general.dark_mode")?.name as string}/> */}
        </Grid>
        </Box>
    )
}


export default GeneralPreference;