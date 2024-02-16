import { useEffect, useState } from "react";
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

const App: React.FC = () => {
    const [a, setup] = useState("test desu")
    useEffect(()=>{
        fetch("https://raw.githubusercontent.com/fabyday/kawaikara/main/README.MD").then((e)=>e.blob()).then((v)=>v.text()).then(v=>setup(v))

    }, [])
    let s = `
    ## MarkdownPreview
    
    ## Header 2
    
    ### Header 3
    `
    return (
        
            <Markdown rehypePlugins={[rehypeRaw]}>{a}</Markdown>
    )
};

export default App;