import React, { MouseEventHandler } from 'react'
import ShortcutTextField from './ShortcutTextfield';
import { Button, Grid } from '@mui/material';
import Typography from '@mui/material/Typography';

// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
function GeneralPreference(id? : string){

   

    return (
        <div>
        <Typography  fontSize={32}>ShortCut</Typography>
        <Button ></Button>
        <Grid container  rowGap={1} spacing={1}>
            <Grid container  spacing={12}>
            <Grid item xs={6}> <Typography>open Netflix</Typography> </Grid>
            <Grid item xs={6}><ShortcutTextField id="open_netflix"></ShortcutTextField></Grid>

            </Grid>
            
            <Grid container  spacing={12}>
            <Grid item xs={6}> <Typography>open Laftel</Typography> </Grid>
            <Grid item xs={6}><ShortcutTextField id="open_laftel"></ShortcutTextField></Grid>
            </Grid>
            
            <Grid container  spacing={12}>
            <Grid item xs={6}> <Typography>open Youtube</Typography> </Grid>
            <Grid item xs={6}><ShortcutTextField id="open_youtube"></ShortcutTextField></Grid>
            </Grid>
            
            <Grid container  spacing={12}>
            <Grid item xs={6}> <Typography>open Disney</Typography> </Grid>
            <Grid item xs={6}><ShortcutTextField id="open_disney"></ShortcutTextField></Grid>
            </Grid>

            <Grid container  spacing={12}>
            <Grid item xs={6}> <Typography>open AmazonPrime</Typography> </Grid>
            <Grid item xs={6}><ShortcutTextField id="open_disney"></ShortcutTextField></Grid>
            </Grid>

        </Grid>
        </div>
    )
}


export default GeneralPreference;