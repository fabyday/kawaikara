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
    const reset_from_conf = save_flag(state=>state.reset_from_conf)
    const copyfrom = usePrevConfigureStore((state)=>state.copy_from)
    const [cur_state, cur_config] = useCurConfigureStore((state)=>[state, state.configure])
    let o = useCurConfigureStore((state)=>state)
    let [is_changed, conf_change_set_f] = React.useState(false);
    let [is_validate_shortcut, valid_shortcut_f] = React.useState(true);
    let [disable_apply, disable_apply_f] = React.useState(true);
    const [prev_state, prev_is_changed_state] = usePrevConfigureStore((state)=>[state.configure, state.is_changed])
    const unsub = useCurConfigureStore.subscribe((cur_state)=>{
        console.log("======sent!")
        console.log(cur_state.configure)
        console.log(prev_state)
        if(typeof cur_state.configure !=="undefined"){
            if (prev_is_changed_state(cur_state.configure)){
                console.log("true")
                conf_change_set_f(false)
            }else{
                console.log("false")
                conf_change_set_f(true)
            }
        }
    })
    let save_flag_unsub = save_flag.subscribe(state=>{
        if(state.check_whole_shortcut()){
            console.log("is valid")
            valid_shortcut_f(true)
        }else{
            valid_shortcut_f(false)
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

        console.log("is changed?", is_changed)
        if(is_changed){
            console.log("wwww", is_changed)
            console.log("test1", is_changed)
            disable_apply_f(false)
            console.log("tewwwst", is_changed)
        }else{
            disable_apply_f(true)

        }
        
        // console.log("validate key", is_validate_shortcut)
        // if(!is_validate_shortcut){
        //     disable_apply_f(true)
        // }else{
        //     disable_apply_f(false)
        // }
        console.log(disable_apply)

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
        copyfrom(cur_config!)
        reset_from_conf(cur_config!)
        conf_change_set_f(false)
        disable_apply_f(true)
        valid_shortcut_f(true)
        }} disabled={disable_apply}>apply</Button>
        </Box>
        </Grid>
        </Grid>
        </FooterComponent>
    )
}


export default Footer;