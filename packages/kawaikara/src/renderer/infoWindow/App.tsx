import { useEffect, useState } from "react";
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

const App: React.FC = () => {
    const [post, setup] = useState("")
    
    useEffect(()=>{
        window.main_api.get_version().then((version_string : string)=>{

            const version = "v"+version_string
            const readme_url = `https://raw.githubusercontent.com/fabyday/kawaikara/${version}/README.MD`
            const raws_root = `https://github.com/fabyday/kawaikara/raw/${version}`
            fetch(readme_url).then((e)=>e.blob()).then((v)=>v.text()).then(v=>{
                const re =  /(\<img[^\/][\s]*[\w]*src=)["'](\.)(.*)["']/g
                v = v.replaceAll(re, `$1"${raws_root}/$3"`)
                setup(v)
            })
        })

    }, [])
    
    return (
        
            <Markdown 
            remarkPlugins={[remarkGfm]} 
            rehypePlugins={[rehypeRaw]}
            components={{img:({node,...props})=><img style={{maxWidth:'100%'}}{...props}/>}}
            >
                {post}
            </Markdown>
    )
};

export default App;