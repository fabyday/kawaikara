import React, { useEffect } from 'react'
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import  Grid from '@mui/material/Grid';

import styled from '@emotion/styled';
import { usePrevConfigureStore, useCurConfigureStore, save_flag } from './definition';
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
    const prev_is_changed_state = usePrevConfigureStore((state)=>state.is_changed)
    const unsub = useCurConfigureStore.subscribe((cur_state)=>{
        if (typeof cur_state.configure !=="undefined" && prev_is_changed_state(cur_state.configure)){
                val_f(true)
        }else{
            val_f(false)
        }
    })
    let save_flag_unsub = save_flag.subscribe(state=>{
        if(state.valid_save){
            val_f(true)
        }else{
            val_f(false)
        }
    })
    useEffect(
        ()=>{
            return unsub
        },[])
    useEffect(
        ()=>{
            return save_flag_unsub
        },[])
    
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