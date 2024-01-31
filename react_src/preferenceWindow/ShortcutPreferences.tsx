import React, { MouseEventHandler } from 'react'
import ShortcutTextField from './ShortcutTextfield';
import { Button, Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
type props = {
    id: string;
    preference_changed : Function;
  };




const rawstack_style = {
    textAlign :"center",
};
function GeneralPreference({id, preference_changed }: props){

   

    return (
        <div>
        <Typography  fontWeight={"medium"} fontSize={32}>ShortCut</Typography>
        <Button onClick={()=>{preference_changed(true)}}>test</Button>
        <Grid container  sx={rawstack_style} rowGap={1} spacing={1}>
            <Grid container sx={rawstack_style} spacing={12}>
            <Grid item xs={6}> <Typography >open Netflix</Typography> </Grid>
            <Grid item xs={6}><ShortcutTextField id="open_netflix"></ShortcutTextField></Grid>

            </Grid>

            <Grid container sx={rawstack_style} spacing={12} justifyContent="space-between">
            <Grid item xs={6}> <Typography >open Laftel</Typography> </Grid>
            <Grid item  xs={6}><ShortcutTextField id="open_laftel"></ShortcutTextField></Grid>
            </Grid>
            
            <Grid container sx={rawstack_style} spacing={12}>
            <Grid item xs={6}> <Typography>open Youtube</Typography> </Grid>
            <Grid item xs={6}><ShortcutTextField id="open_youtube"></ShortcutTextField></Grid>
            </Grid>
            
            <Grid container sx={rawstack_style} spacing={12}>
            <Grid item xs={6}> <Typography >open Disney</Typography> </Grid>
            <Grid item xs={6}><ShortcutTextField id="open_disney"></ShortcutTextField></Grid>
            </Grid>

            <Grid container sx={rawstack_style} spacing={12}>
            <Grid item xs={6}> <Typography >open AmazonPrime</Typography> </Grid>
            <Grid item xs={6}><ShortcutTextField id="open_amazonprime"></ShortcutTextField></Grid>
            </Grid>

        </Grid>
        </div>
    )
}


export default GeneralPreference;