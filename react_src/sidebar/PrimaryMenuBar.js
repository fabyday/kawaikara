"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importDefault(require("react"));
var Box_1 = __importDefault(require("@mui/material/Box"));
var material_1 = require("@mui/material");
var KListItemButton_1 = __importDefault(require("./KListItemButton"));
var StarSharp_1 = __importDefault(require("@mui/icons-material/StarSharp"));
var PrimaryMenuBar = function () {
    var def = function (e) { e.preventDefault(); e.stopPropagation(); };
    var reval = <material_1.List sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }} component="nav" aria-labelledby="nested-list-subheader" subheader={<material_1.ListSubheader component="div" id="nested-list-subheader">
        <Box_1.default sx={{ textAlign: "center", color: "white", bgcolor: "primary.dark" }}>
          Menu
        </Box_1.default>
          
      </material_1.ListSubheader>}>
    <KListItemButton_1.default>
      <material_1.ListItemIcon>
        <img src="https://www.netflix.com/favicon.ico"></img>
      </material_1.ListItemIcon>
      <material_1.ListItemText primary="OTT"/>
      <material_1.IconButton onMouseUp={def} onClick={def} onMouseDown={def}>
      <StarSharp_1.default></StarSharp_1.default>
      </material_1.IconButton>
    </KListItemButton_1.default>
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
    return reval;
};
exports.default = PrimaryMenuBar;
//# sourceMappingURL=PrimaryMenuBar.js.map