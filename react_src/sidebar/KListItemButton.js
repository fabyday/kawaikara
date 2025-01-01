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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importStar(require("react"));
var material_1 = require("@mui/material");
var KListItemButton = function (_a) {
    var children = _a.children, props = __rest(_a, ["children"]);
    var rippleRef = react_1.default.useRef(null);
    ; // Ripple container reference.
    var _b = (0, react_1.useState)(false), left_mouse_clicked = _b[0], set_left_mouse_clicked = _b[1];
    var handleContextMenu = function (event) {
        event.preventDefault();
        // Ripple 비활성화
        if (rippleRef.current) {
            var rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root");
            if (rippleContainer) {
                rippleContainer.style.display = "none"; // hide ripple directly.
            }
        }
    };
    var is_mouse_left_click = false;
    var handleMouseDown = function (event) {
        if (event.button === 0 && rippleRef.current) {
            set_left_mouse_clicked(true);
            var rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root");
            if (rippleContainer) {
                rippleContainer.style.display = "block";
            }
        }
        else { // if mouse is context
            if (rippleRef.current) {
                set_left_mouse_clicked(false);
                var rippleContainer = rippleRef.current.querySelector(".MuiTouchRipple-root");
                if (rippleContainer) {
                    rippleContainer.style.display = "none"; // hide ripple directly.
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
                }
            }
        }
    };
    var reval = <material_1.ListItemButton onContextMenu={handleContextMenu} // 우클릭 이벤트
     onMouseDown={handleMouseDown} // 마우스 버튼 눌렀을 때 이벤트 처리
     onMouseUp={handleMouseUp} ref={function (node) {
            if (node) {
                rippleRef.current = node;
            }
        }} {...props}>
                {children}
            </material_1.ListItemButton>;
    return reval;
};
exports.default = KListItemButton;
//# sourceMappingURL=KListItemButton.js.map