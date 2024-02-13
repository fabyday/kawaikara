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
    let o = useCurConfigureStore((state)=>state)
    let [disabled_flag1, val_f] = React.useState(true);
    let [disabled_flag2, val_f2] = React.useState(true);
    let [disable_apply, val_f3] = React.useState(true);
    const prev_is_changed_state = usePrevConfigureStore((state)=>state.is_changed)
    const unsub = useCurConfigureStore.subscribe((cur_state)=>{
        if (typeof cur_state.configure !=="undefined" && prev_is_changed_state(cur_state.configure)){
            val_f(true)
        }else{
            val_f(false)
        }
    })
    let save_flag_unsub = save_flag.subscribe(state=>{
        console.log("is vaild", state.valid_save)
        if(state.check_whole_shortcut()){
            console.log("is invalid")
            val_f2(true)
        }else{
            val_f2(false)
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
    
    useEffect(()=>{
        console.log("testestse", disabled_flag1 || disabled_flag2)
        console.log("testestse", disabled_flag1 , disabled_flag2)
        if(disabled_flag1){
            if(disabled_flag2)
                val_f3(disabled_flag2)
            else 
                val_f3(disabled_flag1)
        }
    },[disabled_flag1, disabled_flag2])
    
    return (
        <FooterComponent>
        <Grid  container justifyContent={"flex-end"} columnGap={1} columns={12}>
        <Grid  xs={6} item>
        <Box columnGap={1} display="flex" justifyContent="center">
        <Button variant="contained" onClick={()=>{}}>ok</Button>
        <Button variant="contained" onClick={()=>{}} >{disabled_flag1?"true":"false"}</Button>
        <Button variant="contained" onClick={()=>{}} >{disabled_flag2?"true":"false"}</Button>
        <Button variant="contained" onClick={()=>{}} disabled={( disable_apply)}>apply</Button>
        </Box>
        </Grid>
        </Grid>
        </FooterComponent>
    )
}


export default Footer;