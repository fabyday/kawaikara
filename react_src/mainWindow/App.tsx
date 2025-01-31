import { Box, Button } from "@mui/material";
import { useEffect, useState } from "react";
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { create } from 'zustand';

const App: React.FC = () => {

    useEffect(()=>{
        // window.main_api.get_version().then((version_string : string)=>{
            
        //     const version = "v"+version_string
        //     const readme_url = `https://raw.githubusercontent.com/fabyday/kawaikara/${version}/README.MD`
        //     const raws_root = `https://github.com/fabyday/kawaikara/raw/${version}`
        //     fetch(readme_url).then((e)=>e.blob()).then((v)=>v.text()).then(v=>{
        //         const re =  /(\<img[^\/][\s]*[\w]*src=)["'](\.)(.*)["']/g
        //         v = v.replaceAll(re, `$1"${raws_root}/$3"`)
        //         setup(v)
        //     })


    }, [])

    return (
          <iframe src="https://chatgpt.com/c/679bb1c0-0508-8002-8410-d979dc044ac4"/>
            // <Box
            //   sx={{
            //     display: 'flex',
            //     justifyContent: 'center',   
            //     alignItems: 'center',       
            //     height: '100vh',            
            //     flexDirection: 'row',       
            //     flexWrap: 'wrap',           
            //     gap: 2                      
            //   }}
            // >
            //   {/* <Button variant="contained">Button 1</Button> */}
            //   {/* <Button variant="contained">Button 2</Button> */}
            //   {/* <Button variant="contained">Button 3</Button> */}
            //   <Button variant="contained">Button 4</Button>
            // </Box>
    )
};

export default App;