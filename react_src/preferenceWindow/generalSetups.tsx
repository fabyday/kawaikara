import React, { MouseEventHandler } from 'react'
import ShortcutTextField from './ShortcutTextfield';
import { Grid } from '@mui/material';
import Typography from '@mui/material/Typography';
// see also
// https://github.com/snapcrunch/electron-preferences/blob/development/src/app/components/main/components/group/components/fields/accelerator/index.jsx
function GeneralPreference(id? : string){

   

    return (
        <Grid container >
            <Grid item> <Typography>ShortCut</Typography> </Grid>
            <Grid item><ShortcutTextField id="test"></ShortcutTextField></Grid>

        </Grid>
    )
}


export default GeneralPreference;