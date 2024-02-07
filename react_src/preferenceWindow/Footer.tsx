import React, { useEffect } from 'react'
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import  Grid from '@mui/material/Grid';

import styled from '@emotion/styled';
import { usePrevConfigureStore, useCurConfigureStore } from './definition';
import isEqual from 'lodash.isequal';

const FooterComponent = styled('div')({
    color: 'darkslategray',
    backgroundColor: 'aliceblue',
    width : "100%",
    position:"fixed",
    bottom: 0,
    left:0,
    zIndex : 100,

  });



function Footer(){

    let is_changed = usePrevConfigureStore((state)=>state.is_changed)
    let o = useCurConfigureStore((state)=>state)
    let [disabled, val_f] = React.useState(true);
    const prev_state = usePrevConfigureStore((state)=>state)
    const unsub = useCurConfigureStore.subscribe((cur_state)=>{
        console.log("======!")
        console.log(cur_state.general)
        console.log(prev_state.general)
        console.log("======!")
        console.log(cur_state.shortcut)
        console.log(prev_state.shortcut)
        console.log(isEqual(prev_state, cur_state))
        if (isEqual(prev_state.general, cur_state.general) &&
            isEqual(prev_state.shortcut, cur_state.shortcut)
            ){
            val_f(true)
            console.log(" same!")

        }else{
            val_f(false)
            console.log("not same!")
            
        }
        console.log("changed!")
    })

    useEffect(
        ()=>{
            return unsub
        },[]
    )
    return (
        <FooterComponent>
        <Grid  container justifyContent={"flex-end"} columnGap={1} columns={12}>
        <Grid  xs={6} item>
        <Box columnGap={1} display="flex" justifyContent="center">
        <Button variant="contained" onClick={()=>{}}>ok</Button>
        <Button variant="contained" onClick={()=>{}} disabled={disabled}>apply</Button>
        </Box>
        </Grid>
        </Grid>
        </FooterComponent>
    )
}


export default Footer;