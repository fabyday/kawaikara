import React from 'react'
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import  Grid from '@mui/material/Grid';
import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import { config_states } from './definition';



const HeaderComponent = styled(Box)({
    color: 'darkslategray',
    backgroundColor: '#002b45',
    width : "100%",
    top : 0,
    left : 0,
    position:"fixed",
    margin : 0,
    padding :3,
    zIndex : 100,
    display : "flex"

  });



  type props = {
    button_names : string[]
    button_ids : string[]
    link_paths : string[]
  }

function Header(){

    
    // let button_names = ["General", "Shortcut"];
    // let button_ids = ["gen", "short"]
    // let link_paths = ["general", "shortcut"]
    const var_type : string[]= ["contained", "outlined"]
    const [selected_btn, set_sel_btn] = React.useState(0);
    const [set_property, get_property] = config_states((state)=>[state.set_property, state.get_property])

    let button_names:string[] = []
    let link_paths:string[] = []
      button_names = [get_property().general?.name ?? "General", get_property().shortcut?.name ?? "Shortcut"]
      link_paths = ["general", "shortcut"]
    // }

    const button_clicked = (id : number) : void =>{
        set_sel_btn(id)
    }


    const button_generater= ()=>{
      var buttons = [];
      for(let i = 0; i<button_names.length; i++){
        let button;
        let style = {background : "#f1f1f1"};
        let new_variant:string = "outlined"
          if(selected_btn === i){
            style = {background : "#0063cc", border : '1px solid black'} as any
            new_variant = "contained"
          }
            button = (
                    <Link key={`link.${i}`} to={link_paths[i]} >
           <Button key={"button"+String(i)} style={{...style}} id={"button"+String(i)} onClick={()=>button_clicked(i)} color='primary' variant={new_variant}>
                                                    {button_names[i]}
                      </Button>
                    </Link>);

        buttons.push(button)
      }
      return buttons;
    }



    return (
        <HeaderComponent id="header">        
        <Grid container columnGap={1} columns={12}>

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