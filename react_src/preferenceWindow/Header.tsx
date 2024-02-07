import React from 'react'
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import  Grid from '@mui/material/Grid';
import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import { useCurConfigureStore } from './definition';



const HeaderComponent = styled(Box)({
    color: 'darkslategray',
    backgroundColor: 'blue',
    width : "100%",
    top : 0,
    left : 0,
    position:"fixed",
    margin : 0,
    zIndex : 100,
    display : "flex"

  });



  type props = {
    button_names : string[]
    button_ids : string[]
    link_paths : string[]
  }

function Header(){

    
    let button_names = ["General", "Shortcut"];
    let button_ids = ["gen", "short"]
    let link_paths = ["general", "shortcut"]
    const var_type : string[]= ["contained", "outlined"]
    const [selected_btn, set_sel_btn] = React.useState(0);
    const get_property = useCurConfigureStore((state)=>state.get_property)
    
    const general = get_property("configure.general")
    const shortcut = get_property("configure.shortcut")
    console.log("test")
    console.log(general)

    const button_clicked = (id : number) : void =>{
        set_sel_btn(id)
        
    }


    const button_generater= ()=>{
      var buttons = [];
      for(let i = 0; i<button_names.length; i++){
        let button;
        let style = {background : "white"};
        let new_variant:string = "outlined"
          if(selected_btn === i){
            new_variant = "contained"
            console.log("selected_btn", selected_btn)
          }

            button = (
                    <Link to={link_paths[i]} >
           <Button style={style} onClick={()=>button_clicked(i)} color='primary' variant={new_variant}>
                                                    {button_names[i]}
                      </Button>
                    </Link>);

        buttons.push(button)
      }
      return buttons;
    }



    return (
        <HeaderComponent>        
        <Grid   container columnGap={1} columns={12}>

        <Grid  xs={6} item>
        <Box columnGap={1} display="flex" justifyContent="flex-start">
        {button_generater()}
        
        </Box>
        </Grid>
        </Grid>
        </HeaderComponent>
    )
}


export default Header;