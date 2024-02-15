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
    let [is_changed, val_f] = React.useState(false);
    let [is_validate_shortcut, val_f2] = React.useState(true);
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
        if(state.check_whole_shortcut()){
            console.log("is valid")
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
        if(is_changed){
            console.log("test", is_changed)
            val_f3(true)
            // if(is_validate_shortcut)
            // if(disabled_flag2)
            //     val_f3(false)
        }else{
            if(is_validate_shortcut){
                val_f3(false)

            }
            else{
                val_f3(true)
            }
        }
    },[is_validate_shortcut, is_changed])
    
    return (
        <FooterComponent>
        <Grid  container justifyContent={"flex-end"} columnGap={1} columns={12}>
        <Grid  xs={6} item>
        <Box columnGap={1} display="flex" justifyContent="center">
        <Button variant="contained" onClick={()=>{
            if(disable_apply){
                window.preference_api.just_close_preference_window()
            }else{
                window.preference_api.apply_changed_preference(o.configure)
                window.preference_api.just_close_preference_window()
            }
        }}>OK</Button>
        <Button variant="contained" 
        onClick={()=>{
            window.preference_api.just_close_preference_window()
            }}>Cancel</Button>
        <Button variant="contained" onClick={()=>{
            window.preference_api.apply_changed_preference(o.configure)
            val_f(true)
        }} disabled={( disable_apply)}>apply</Button>
        </Box>
        </Grid>
        </Grid>
        </FooterComponent>
    )
}


export default Footer;