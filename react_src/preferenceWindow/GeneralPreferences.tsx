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
import { config_states } from './definition';
import { KawaiConfig, KawaiPreference } from '../../typescript_src/definitions/setting_types';
  
function GeneralPreference(){

    const [set_property, get_property] = config_states((state)=>[state.set_property, state.get_property])

    // const f = (value : string)=>{
    //     const [width, height] = value.split("x").map((v)=>Number(v))
    //     set_property("configure.general.pip_location.preset_location_list.width", width)
    //     set_property("configure.general.pip_location.preset_location_list.height", height)

    // }

    return (
        <Box >
        <Typography  fontSize={32}> {get_property().general?.name ?? "General"} </Typography>        
        <Grid container style={{maxHeight: '80%', overflow: 'auto'}} justifyContent="center" rowGap={1} spacing={1} >
             <KawaiAutoCompleteSelector 
                id ={"general.pip_location.location"} 
                // title={get_property("configure.general.pip_location.location")?.name as string} 
                title={ get_property().general?.window_preference?.pip_location?.location?.name ?? "PiP Location"}
                preset_list={["bottom-left", "right"]}
                get_default_value={get_property().general?.window_preference?.pip_location?.location?.value ?? "bottom-left"}
                select_f={(text : string)=>{ set_property("general.window_preference.pip_location.location.value", text)}}
                />
                <KawaiAutoCompleteSelector 
                id ={"general.window_preference.pip_location.monitor"} 
                title={get_property().general?.window_preference?.pip_location?.monitor?.name ?? "PiP Monitor"} 
                preset_list={["0", "1"]}
                get_default_value={get_property().general?.window_preference?.pip_location?.monitor?.value ?? "0"}
                select_f={(text : string)=>{ set_property("general.window_preference.pip_location.monitor.value", text)}}
                />
                
                
                
                <KawaiAutoCompleteSelector 
                    id ={"s"} 
                    title={get_property().general?.window_preference?.pip_window_size?.name ?? "PiP Window Size"} 
                    preset_list={["test test", "test2 test2"]} 
                    get_default_value={(
                        
                        
                        (get_property().general?.window_preference?.pip_window_size?.width?.value?.toString() as string)+"x"
                        +(get_property().general?.window_preference?.pip_window_size?.height?.value?.toString() as string))
                        }
                        
                        select_f={(text : string)=>{
                            const [width, height] = text.split("x").map((v)=>Number(v))
                            set_property("configure.general.pip_window_size.width", width)
                            set_property("configure.general.pip_window_size.height", height)
                            }}
                            onselected_customize_f={(index:number, size:number)=>{
                                if(index === 0)
                                    set_property("configure.general.pip_window_size.width", size )
                                else 
                                set_property("configure.general.pip_window_size.height", size )
                        }}                    
                    additional_textedit={true}/>

     

            <KawaiAutoCompleteSelector 
                id ={"general.window_preference.window_size"} 
                title={get_property().general?.window_preference?.window_size?.name ?? "Window Size"} 
                preset_list={[""]}
                get_default_value={(
                    (get_property().general?.window_preference?.window_size?.width?.value?.toString() as string)+"x"
                    +(get_property().general?.window_preference?.window_size?.height?.value?.toString() as string))
                }

                select_f={(text : string)=>{
                    const [width, height] = text.split("x").map((v)=>Number(v))
                    set_property("configure.general.window_size.width", width)
                    set_property("configure.general.window_size.height", height)
                }}
                onselected_customize_f={(index:number, size:number)=>{
                    if(index === 0)
                        set_property("configure.general.window_size.width", size )
                    else 
                        set_property("configure.general.window_size.height", size )
                }}      
                additional_textedit={true}/>

      
            <KawaiSwitch 
                id = {"general.enable_autoupdate.name"} 
                title={get_property().general?.enable_autoupdate?.name ?? "Enable Autoupdate"}
                onclick={(e)=>{ set_property("general.enable_autoupdate.value", e) }} 
                defaultchecked = {get_property().general?.enable_autoupdate?.value as boolean ?? false}
                />

            <KawaiSwitch 
                id = {"general.dark_mode.name"} 
                title={get_property().general?.dark_mode?.name as string ?? "Enable Dark Mode"}
                onclick={(e)=>{ set_property("general.dark_mode.value", e ) }} 
                defaultchecked = {get_property().general?.dark_mode?.value ?? false}
                /> 
        </Grid>
        </Box>
    )
}


export default GeneralPreference;