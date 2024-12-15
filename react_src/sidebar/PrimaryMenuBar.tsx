
import React, { useEffect, useState } from "react";
import Box from '@mui/material/Box';
import { List, ListSubheader, ListItemButton, ListItemIcon, ListItemText, IconButton } from "@mui/material";
import KListItemButton from "./KListItemButton";
import StarSharpIcon from '@mui/icons-material/StarSharp';
const PrimaryMenuBar: React.FC = () => {
  
    const def = (e)=>{e.preventDefault();e.stopPropagation()};
    const reval = <List
    sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}
    component="nav"
    aria-labelledby="nested-list-subheader"
    subheader={
      <ListSubheader component="div" id="nested-list-subheader">
        <Box sx={{textAlign : "center", color:"white", bgcolor:"primary.dark"}}>
          Menu
        </Box>
          
      </ListSubheader>
    }
  >
    <KListItemButton  >
      <ListItemIcon>
        <img src="https://www.netflix.com/favicon.ico"></img>
      </ListItemIcon>
      <ListItemText primary="OTT" />
      <IconButton onMouseUp={def} onClick={def} onMouseDown={def}>
      <StarSharpIcon></StarSharpIcon>
      </IconButton>
    </KListItemButton>
    <ListItemButton>
      <ListItemIcon>
      <img src="https://www.netflix.com/favicon.ico"></img>
      </ListItemIcon>
      <ListItemText primary="streaming" />
      
      
    </ListItemButton>
    
    <ListItemButton>
      <ListItemIcon>
      <img src="https://www.netflix.com/favicon.ico"></img>
      </ListItemIcon>
      <ListItemText primary="music" />
      
      
    </ListItemButton>
    <ListItemButton>
      <ListItemIcon>
      <img src="https://www.netflix.com/favicon.ico"></img>
      </ListItemIcon>
      <ListItemText  primary="option" />
      
      
    </ListItemButton>
  
    
  </List>;
  


    return reval;
}


export default PrimaryMenuBar;
