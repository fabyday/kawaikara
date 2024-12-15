
import React, { ReactEventHandler, useEffect, useState } from "react";
import Box from '@mui/material/Box';
import { List, ListSubheader, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import KListItemButton from "./KListItemButton";

const ChildMenuItemBar: React.FC = () => {
    const [disableRipple, setDisableRipple] = useState(false); // Ripple 제어 상태
    const rippleRef = React.useRef<HTMLDivElement | null>(null);; // Ripple 컨테이너 참조

    const [left_mouse_clicked, set_left_mouse_clicked] = useState(false)

      const handleContextMenu = (event : React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault(); // 기본 우클릭 메뉴 방지
        // Ripple 비활성화
    if (rippleRef.current) {
      const rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root") as HTMLSpanElement | null;
      if(rippleContainer){
        rippleContainer.style.display = "none"; // Ripple 효과 즉시 숨김
      }
    }
      };
      

      let is_mouse_left_click = false;

      const handleMouseDown = (event : React.MouseEvent<HTMLDivElement>) => {
        if (event.button === 0  && rippleRef.current) {
          set_left_mouse_clicked(true);
          const rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root") as HTMLSpanElement | null;
          if (rippleContainer) {
            console.log( rippleContainer.style.display )
            rippleContainer.style.display = "block";
          }
        }
        else{ // if mouse is context
          if (rippleRef.current) {
            set_left_mouse_clicked(false);
            const rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root") as HTMLSpanElement | null;
            if(rippleContainer){
              rippleContainer.style.display = "none"; // Ripple 효과 즉시 숨김
            }
          }
        }
      };

      const handleMouseUp = (event : React.MouseEvent<HTMLDivElement>) => {
        if (event.button === 0  && rippleRef.current) {
          const rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root") as HTMLSpanElement | null;
          if (rippleContainer) {
            if(left_mouse_clicked){
              set_left_mouse_clicked(false);
            }else{
              rippleContainer.style.display = "none";
              console.log( rippleContainer.style.display )

            }
          }
        }
      };
      
    const reval = 
    <List
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
    
    <ListItemButton onContextMenu={handleContextMenu} // 우클릭 이벤트
            onMouseDown={handleMouseDown} // 마우스 버튼 눌렀을 때 이벤트 처리
            onMouseUp={handleMouseUp}
            ref={(node) => {
              if (node) {
                rippleRef.current = node;
              }
            }}
            >
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
  


    // return reval;
    return (<List
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
      <KListItemButton> 
      <ListItemIcon>
                 <img src="https://www.netflix.com/favicon.ico"></img>
                  
      </ListItemIcon>
      <ListItemText primary="OTT" />
      </KListItemButton> 
      </List>);
}


export default ChildMenuItemBar;
