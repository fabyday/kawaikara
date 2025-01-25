import { ReactEventHandler, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import * as React from 'react';

import { ListItemButton, ListItemButtonProps } from '@mui/material';

interface KListItemButtonProps extends ListItemButtonProps {}

const KListItemButton = React.forwardRef<HTMLDivElement, KListItemButtonProps>(
    function ItemButton(inProps, ref) {
        const { children, ...other } = inProps;

        return (
            <ListItemButton
            ref = {ref}
                {...other}
                // onContextMenu={handleContextMenu} // 우클릭 이벤트
                // onMouseDown={handleMouseDown} // 마우스 버튼 눌렀을 때 이벤트 처리
                // onMouseUp={handleMouseUp}
                // ref={(node) => {
                //     if (node) {
                //         rippleRef.current = node;
                //     }
                // }}
            >
                {children}
            </ListItemButton>
        );
    },
);
// const rippleRef = React.useRef<HTMLDivElement | null>(null); // Ripple container reference.

// const [left_mouse_clicked, set_left_mouse_clicked] = useState(false);
// console.log(props.key);
// console.log(props);
// const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
//     event.preventDefault();
//     // Ripple 비활성화
//     if (rippleRef.current) {
//         const rippleContainer = rippleRef.current.querySelector(
//             '.MuiTouchRipple-root',
//         ) as HTMLSpanElement | null;
//         if (rippleContainer) {
//             rippleContainer.style.display = 'none'; // hide ripple directly.
//         }
//     }
// };

// let is_mouse_left_click = false;

// const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
//     if (event.button === 0 && rippleRef.current) {
//         set_left_mouse_clicked(true);
//         const rippleContainer = rippleRef.current.querySelector(
//             '.MuiTouchRipple-root',
//         ) as HTMLSpanElement | null;
//         if (rippleContainer) {
//             rippleContainer.style.display = 'block';
//         }
//     } else {
//         // if mouse is context
//         if (rippleRef.current) {
//             set_left_mouse_clicked(false);
//             const rippleContainer = rippleRef.current.querySelector(
//                 '.MuiTouchRipple-root',
//             ) as HTMLSpanElement | null;
//             if (rippleContainer) {
//                 rippleContainer.style.display = 'none'; // hide ripple directly.
//             }
//         }
//     }
// };

// const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
//     if (event.button === 0 && rippleRef.current) {
//         const rippleContainer = rippleRef.current.querySelector(
//             '.MuiTouchRipple-root',
//         ) as HTMLSpanElement | null;
//         if (rippleContainer) {
//             if (left_mouse_clicked) {
//                 set_left_mouse_clicked(false);
//             } else {
//                 rippleContainer.style.display = 'none';
//             }
//         }
//     }
// };

//     const reval = (
//         <ListItemButton
//             // onContextMenu={handleContextMenu} // 우클릭 이벤트
//             // onMouseDown={handleMouseDown} // 마우스 버튼 눌렀을 때 이벤트 처리
//             // onMouseUp={handleMouseUp}
//             // ref={(node) => {
//             //     if (node) {
//             //         rippleRef.current = node;
//             //     }
//             // }}
//             {...props}>
//             {children}
//         </ListItemButton>
//     );

//     return reval;
// };

export default KListItemButton;
