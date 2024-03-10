import React, { useEffect } from 'react'
import GeneralPreference from './GeneralPreferences';
import ShortcutPreference from "./ShortcutPreferences"
import Footer from './Footer';
import Header from './Header';
import styled from '@emotion/styled';
import { Configure } from '../../typescript_src/definitions/types';

import { MemoryRouter, Routes, Route, Link} from 'react-router-dom';
import { ipcRenderer } from 'electron';
import {usePrevConfigureStore, useCurConfigureStore, save_flag} from "./definition"
import { create } from 'zustand';
import { Button } from '@mui/material';
const ContentComponent = styled('div')({
//    paddingTop : "7%",
   margin : "7%"
  });

const RootComponent =styled('div')({
    alignItems:"center",
   });



function App(){
    

    const [new_fetch, copy_from_p, compare_with] = usePrevConfigureStore((state)=>[state.fetch, state.copy_from, state.is_changed])
    const [cur_state, copy_from] = useCurConfigureStore((state)=>[state, state.copy_from])
    const reset_from_conf = save_flag(state=>state.reset_from_conf)
    useEffect(()=>{
        new_fetch(
            async ()=>{
                let prev = await window.preference_api.get_data()
                copy_from_p(prev)
                copy_from(prev)
                reset_from_conf(prev)
                console.log("prev", prev)
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