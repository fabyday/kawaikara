
import React, { useEffect, useState } from "react";
import Box from '@mui/material/Box';
import { List, ListSubheader, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";

const PrimaryMenuBar: React.FC = () => {
    const [disableRipple, setDisableRipple] = useState(false); // Ripple 제어 상태
    const handleMouseUp = (e) => {
        e.preventDefault()
        setDisableRipple(false); // 우클릭 이후 Ripple 복원
      };

      const handleMouseDown = (event) => {
        const target = event.currentTarget;
    
        // Ripple 복원: 좌클릭 등 정상 동작에서는 Ripple 다시 활성화
        const rippleContainer = target.querySelector(".MuiTouchRipple-root");
        if (rippleContainer) {
          rippleContainer.style.display = "block"; // Ripple DOM 활성화
        }
      };
      const handleContextMenu = (event) => {
        event.preventDefault(); // 기본 우클릭 메뉴 방지
        const target = event.currentTarget;
    
        // Ripple 차단: ripple이 즉시 사라지도록 설정
        const rippleContainer = target.querySelector(".MuiTouchRipple-root");
        if (rippleContainer) {
          rippleContainer.style.display = "none"; // Ripple DOM 비활성화
        }
      };
      
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
    <ListItemButton disableRipple={disableRipple} onMouseUp={handleMouseUp}  onContextMenu={handleContextMenu} onMouseDown={handleMouseDown}>
      <ListItemIcon>
        <img src="https://www.netflix.com/favicon.ico"></img>
         
      </ListItemIcon>
      <ListItemText primary="OTT" />
    </ListItemButton>
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
      <ListItemText primary="option" />
      
      
    </ListItemButton>
  
    
  </List>;
  


    return reval;
}


export default PrimaryMenuBar;
