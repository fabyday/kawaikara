import React, { MouseEventHandler, useEffect } from 'react'
import ShortcutTextField from './ShortcutTextfield';
import { Box, Button, Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useCurConfigureStore } from './definition';
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
type props = {
    id: string;
  };




const rawstack_style = {
    textAlign :"center",
};
function ShortcutPreference(){

    const shortcut_state = useCurConfigureStore(state => state.shortcut)
    let setup_f = useCurConfigureStore(state=>state.set_item)

    let keys :string[] = Object.keys(shortcut_state);
    

    return (
        <Box>
        <Typography  fontWeight={"medium"} fontSize={32}>ShortCut</Typography>
       
        {
            keys.map((id)=>{
                return (<Grid container  sx={rawstack_style} rowGap={1} spacing={1}>
                    <Grid container sx={rawstack_style} spacing={12}> </Grid>
                    <Grid item xs={6}> <Typography >{id}</Typography> </Grid>
                    <Grid item xs={6}><ShortcutTextField id={id} set_shortcut_f={(e)=>{setup_f("shortcut."+id, e)}} get_shortcut_f={()=>shortcut_state![id]}></ShortcutTextField></Grid>
                </Grid>)
            
            })
        }
        
           
        </Box>
    )
}


export default ShortcutPreference;