"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importStar(require("react"));
var Box_1 = __importDefault(require("@mui/material/Box"));
var material_1 = require("@mui/material");
var KListItemButton_1 = __importDefault(require("./KListItemButton"));
var ChildMenuItemBar = function () {
    var _a = (0, react_1.useState)(false), disableRipple = _a[0], setDisableRipple = _a[1]; // Ripple 제어 상태
    var rippleRef = react_1.default.useRef(null);
    ; // Ripple 컨테이너 참조
    var _b = (0, react_1.useState)(false), left_mouse_clicked = _b[0], set_left_mouse_clicked = _b[1];
    var handleContextMenu = function (event) {
        event.preventDefault(); // 기본 우클릭 메뉴 방지
        // Ripple 비활성화
        if (rippleRef.current) {
            var rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root");
            if (rippleContainer) {
                rippleContainer.style.display = "none"; // Ripple 효과 즉시 숨김
            }
        }
    };
    var is_mouse_left_click = false;
    var handleMouseDown = function (event) {
        if (event.button === 0 && rippleRef.current) {
            set_left_mouse_clicked(true);
            var rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root");
            if (rippleContainer) {
                console.log(rippleContainer.style.display);
                rippleContainer.style.display = "block";
            }
        }
        else { // if mouse is context
            if (rippleRef.current) {
                set_left_mouse_clicked(false);
                var rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root");
                if (rippleContainer) {
                    rippleContainer.style.display = "none"; // Ripple 효과 즉시 숨김
                }
            }
        }
    };
    var handleMouseUp = function (event) {
        if (event.button === 0 && rippleRef.current) {
            var rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root");
            if (rippleContainer) {
                if (left_mouse_clicked) {
                    set_left_mouse_clicked(false);
                }
                else {
                    rippleContainer.style.display = "none";
                    console.log(rippleContainer.style.display);
                }
            }
        }
    };
    var reval = <material_1.List sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }} component="nav" aria-labelledby="nested-list-subheader" subheader={<material_1.ListSubheader component="div" id="nested-list-subheader">
        <Box_1.default sx={{ textAlign: "center", color: "white", bgcolor: "primary.dark" }}>
          Menu
        </Box_1.default>
          
      </material_1.ListSubheader>}>
    
    <material_1.ListItemButton onContextMenu={handleContextMenu} // 우클릭 이벤트
     onMouseDown={handleMouseDown} // 마우스 버튼 눌렀을 때 이벤트 처리
     onMouseUp={handleMouseUp} ref={function (node) {
            if (node) {
                rippleRef.current = node;
            }
        }}>
      <material_1.ListItemIcon>
        <img src="https://www.netflix.com/favicon.ico"></img>
         
      </material_1.ListItemIcon>
      <material_1.ListItemText primary="OTT"/>
    </material_1.ListItemButton>
    <material_1.ListItemButton>
      <material_1.ListItemIcon>
      <img src="https://www.netflix.com/favicon.ico"></img>
      </material_1.ListItemIcon>
      <material_1.ListItemText primary="streaming"/>
      
      
    </material_1.ListItemButton>
    
    <material_1.ListItemButton>
      <material_1.ListItemIcon>
      <img src="https://www.netflix.com/favicon.ico"></img>
      </material_1.ListItemIcon>
      <material_1.ListItemText primary="music"/>
      
      
    </material_1.ListItemButton>
    <material_1.ListItemButton>
      <material_1.ListItemIcon>
      <img src="https://www.netflix.com/favicon.ico"></img>
      </material_1.ListItemIcon>
      <material_1.ListItemText primary="option"/>
      
      
    </material_1.ListItemButton>
  
    
  </material_1.List>;
    // return reval;
    return (<material_1.List sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }} component="nav" aria-labelledby="nested-list-subheader" subheader={<material_1.ListSubheader component="div" id="nested-list-subheader">
          <Box_1.default sx={{ textAlign: "center", color: "white", bgcolor: "primary.dark" }}>
            Menu
          </Box_1.default>
            
        </material_1.ListSubheader>}>
      <KListItemButton_1.default> 
      <material_1.ListItemIcon>
                 <img src="https://www.netflix.com/favicon.ico"></img>
                  
      </material_1.ListItemIcon>
      <material_1.ListItemText primary="OTT"/>
      </KListItemButton_1.default> 
      </material_1.List>);
};
exports.default = ChildMenuItemBar;
//# sourceMappingURL=ChildMenuItemBar.js.map