import { useEffect, useState } from "react";
import Box from '@mui/material/Box';

const App: React.FC = () => {
    
    
    return (
        <Box component="section"  alignItems="center" sx={{ p: 2, border: '1px dashed grey' }}>
        <browser-action-list id="actions"></browser-action-list>
      </Box>
            
    )
};

export default App;