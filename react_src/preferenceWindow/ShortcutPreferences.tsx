import React, { MouseEventHandler, useEffect } from 'react'
import ShortcutTextField from './ShortcutTextfield';
import { Box, Button, Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { config_states } from './definition';
import { KawaiShortcut } from '../../typescript_src/definitions/setting_types';
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
type props = {
    id: string;
  };




const rawstack_style = {
    textAlign :"center",
};
function ShortcutPreference(){
    // const save_checker = save_flag((state)=>state.check_duplication_shortcut)
    const [set_property, get_property] = config_states((state)=>[state.set_property, state.get_property])
    let root_id  : string = "shortcut"
    let shortcut_list = get_property().shortcut!;
    let render_list : JSX.Element[] = []

        Object.entries(shortcut_list).forEach(([key, value])=>{
            if(key === "name") // we don't need name prop.
                return;

                const id : string = root_id + "." + key;
                
                
                render_list.push(
                <Grid container  sx={rawstack_style} rowGap={1} spacing={1}>
                    <Grid container sx={rawstack_style} spacing={12}> </Grid>
                    <Grid item xs={6}> <Typography >{(value as KawaiShortcut).name ?? key}</Typography> </Grid>
                    <Grid item xs={6}>
                <ShortcutTextField
                id = {id}
                get_shortcut_f={()=>{}}
                set_shortcut_f={()=>{}}
                duplication_check_f={(text:string)=>{}}
                />
            </Grid>
    </Grid>
                )
        })


        //             <ShortcutTextField 
        //                     id={v.id} 
        //                     set_shortcut_f={(e)=>{ set_property(root_id+"."+v.id, e)}} 
        //                     get_shortcut_f={()=>v.item}
        //                     duplication_check_f={(text:string)=>{
        //                         return !save_checker(v.id, text)
        //                     }}

        //                     />
        // ))
        

        
    

    return (
        <Box>
        <Typography  fontWeight={"medium"} fontSize={32}>{shortcut_list?.name}</Typography>
        {
            render_list
        }
        </Box>
    )
}


export default ShortcutPreference;