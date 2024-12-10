import React, { useEffect, useState } from "react";
import Box from '@mui/material/Box';
import { Collapse, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader } from "@mui/material";
const App: React.FC = () => {
    
  const [open, setOpen] = React.useState(true);

  const handleClick = () => {
    setOpen(!open);
  };
  

  const reval = <List
  sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}
  component="nav"
  aria-labelledby="nested-list-subheader"
  subheader={
    <ListSubheader component="div" id="nested-list-subheader">
      Nested List Items
    </ListSubheader>
  }
>
  <ListItemButton>
    <ListItemIcon>
      <img src="https://www.netflix.com/favicon.ico"></img>
    </ListItemIcon>
    <ListItemText primary="Sent mail" />
  </ListItemButton>
  <ListItemButton>
    <ListItemIcon>
    <img src="https://www.netflix.com/favicon.ico"></img>
    </ListItemIcon>
    <ListItemText primary="Drafts" />
  </ListItemButton>
  <ListItemButton onClick={handleClick}>
    <ListItemIcon>
    <img src="https://www.netflix.com/favicon.ico"></img>
    </ListItemIcon>
    <ListItemText primary="Inbox" />
    {open ? "expand less" : "exp more"}
  </ListItemButton>
  <Collapse in={open} timeout="auto" unmountOnExit>
    <List component="div" disablePadding>
      <ListItemButton sx={{ pl: 4 }}>
        <ListItemIcon>
        <img src="https://www.netflix.com/favicon.ico"></img>
        </ListItemIcon>
        <ListItemText primary="Starred" />
      </ListItemButton>
    </List>
  </Collapse>
</List>;

  return (
    reval
  );
};



export default App;