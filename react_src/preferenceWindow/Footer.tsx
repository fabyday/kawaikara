import React from 'react'
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import  Grid from '@mui/material/Grid';

import styled from '@emotion/styled';


const FooterComponent = styled('div')({
    color: 'darkslategray',
    backgroundColor: 'aliceblue',
    width : "100%",
    position:"fixed",
    bottom: 0,
    left:0

  });


type props ={
    pref_changed : boolean
    pref_changed_function : Function
}
function Footer({pref_changed, pref_changed_function} : props){


    return (
        <FooterComponent>
        <Grid  container justifyContent={"flex-end"} columnGap={1} columns={12}>
        <Grid  xs={6} item>
        <Box columnGap={1} display="flex" justifyContent="center">
        <Button variant="contained" onClick={()=>{}}>ok</Button>
        <Button variant="contained" onClick={()=>{pref_changed_function(false)}} disabled={!pref_changed}>apply</Button>
        </Box>
        </Grid>
        </Grid>
        </FooterComponent>
    )
}


export default Footer;