import React, { useEffect, useState } from "react";
import Box from '@mui/material/Box';
import { Collapse, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader } from "@mui/material";
import PrimaryMenuBar from "./PrimaryMenuBar";
import Favorites from "./Favorites";
import ChildMenuItemBar from "./ChildMenuItemBar";


const App: React.FC = () => {
    


  // useEffect( ()=>{
    
  //           let prev =  window.menu_api.initialize_data().then((e)=>{console.log(e)})
  //           console.log(prev)
  // }, [])


  let reval = <Box display="flex" flexDirection="column" alignItems="center" 
  justifyContent="center"
  sx = {{ height: '100vh', gap : 2}}
  >
  <Favorites/>
  <Box display="flex" flexDirection="row" alignItems="flex-start">
    <PrimaryMenuBar/>
    <ChildMenuItemBar/>
  </Box>
  </Box>

  return (
    reval
  );
};



export default App;