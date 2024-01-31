import React, { useEffect } from 'react'
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import  Grid from '@mui/material/Grid';

import styled from '@emotion/styled';
import { usePrevConfigureStore, useCurConfigureStore } from './definition';

const FooterComponent = styled('div')({
    color: 'darkslategray',
    backgroundColor: 'aliceblue',
    width : "100%",
    position:"fixed",
    bottom: 0,
    left:0,
    zIndex : 100,

  });


type props ={
    pref_changed : boolean
    pref_changed_function : Function
}
function Footer(){

    let is_changed = usePrevConfigureStore((state)=>state.is_changed)
    let o = useCurConfigureStore((state)=>state)
    let [val, val_f] = React.useState(true);
    useEffect(
        ()=>{
            const unsub = useCurConfigureStore.subscribe((state, cur)=>{
                val_f(false);
                console.log("changed!")
            })
            return unsub
        },[]
    )
    return (
        <FooterComponent>
        <Grid  container justifyContent={"flex-end"} columnGap={1} columns={12}>
        <Grid  xs={6} item>
        <Box columnGap={1} display="flex" justifyContent="center">
        <Button variant="contained" onClick={()=>{}}>ok</Button>
        <Button variant="contained" onClick={()=>{}} disabled={val}>apply</Button>
        </Box>
        </Grid>
        </Grid>
        </FooterComponent>
    )
}


export default Footer;