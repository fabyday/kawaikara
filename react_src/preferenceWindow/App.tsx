import React, { useEffect } from 'react'
import GeneralPreference from './GeneralPreferences';
import ShortcutPreference from "./ShortcutPreferences"
import Footer from './Footer';
import Header from './Header';
import styled from '@emotion/styled';
import { Configure } from '../../typescript_src/definitions/types';

import { MemoryRouter, Routes, Route, Link} from 'react-router-dom';
import { ipcRenderer } from 'electron';
import {usePrevConfigureStore, useCurConfigureStore} from "./definition"
const ContentComponent = styled('div')({
//    paddingTop : "7%",
   margin : "7%"
  });

const RootComponent =styled('div')({
    alignItems:"center",
   });



function App(){
    

    const [new_fetch, compare_with] = usePrevConfigureStore((state)=>[state.fetch, state.is_changed])
    const copy_from = useCurConfigureStore((state)=>state.copy_from)
    useEffect(()=>{

        new_fetch(
            async ()=>{
                let prev = await window.preference_api.get_data()
                copy_from(prev)
                console.log(prev)
                return prev
    
            }
        )
    }, [])




    


    return (
        <RootComponent>
        <MemoryRouter initialEntries={["/general"]}>
        <Header />
        
        <ContentComponent>
        <Routes>
            <Route path="/general" element={<GeneralPreference/>} ></Route>
            <Route path="/shortcut" element={<ShortcutPreference ></ShortcutPreference>}></Route>
            </Routes>
        </ContentComponent>
        </MemoryRouter>
        <Footer/>
        </RootComponent>
    )
}


export default App;