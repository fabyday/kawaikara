import React, { MouseEventHandler, useEffect } from 'react'
import ShortcutTextField from './ShortcutTextfield';
import { Box, Button, Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useCurConfigureStore, save_flag } from './definition';
import { isCItemArray, isCItem } from '../../typescript_src/definitions/types';
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
type props = {
    id: string;
  };




const rawstack_style = {
    textAlign :"center",
};
function ShortcutPreference(){
    const save_checker = save_flag((state)=>state.check_duplication_shortcut)
    
    const [get_property, set_property] = useCurConfigureStore(state => [state.get_property, state.set_property])
    let root_id  : string = "configure.shortcut"
    let shortcut_list = get_property(root_id)
    let render_list : JSX.Element[] = []
    if(isCItemArray(shortcut_list?.item)){
        render_list = shortcut_list.item.map((v)=>(
            <Grid container  sx={rawstack_style} rowGap={1} spacing={1}>
                <Grid container sx={rawstack_style} spacing={12}> </Grid>
                <Grid item xs={6}> <Typography >{v.name}</Typography> </Grid>
                <Grid item xs={6}>
                    <ShortcutTextField 
                            id={v.id} 
                            set_shortcut_f={(e)=>{ console.log(get_property("configure.shortcut"));set_property(root_id+"."+v.id, e)}} 
                            get_shortcut_f={()=>v.item}
                            duplication_check_f={(text:string)=>{
                                return !save_checker(v.id, text)
                            }}

                            // duplication_check_f={(text:string)=>{
                            //     const shortcut_list = get_property("configure.shortcut")?.item
                            //     if(typeof shortcut_list !== "undefined"){
                            //         if( isCItemArray(shortcut_list)){
                            //             const item_list = shortcut_list.map(vv=>{ if (v.id !== vv.id)  return vv.item})
                            //             return !item_list.includes(text)
                            //         }
                            //     }

                            // }}
                            />
                    </Grid>
            </Grid>
        ))
        
    }

        
    

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