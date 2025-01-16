import React, { useEffect } from 'react'
import GeneralPreference from './GeneralPreferences';
import ShortcutPreference from "./ShortcutPreferences"
import Footer from './Footer';
import Header from './Header';
import styled from '@emotion/styled';
import { Configure } from '../../typescript_src/definitions/types';

import { MemoryRouter, Routes, Route, Link} from 'react-router-dom';
import { ipcRenderer } from 'electron';
import {usePrevConfigureStore, useCurConfigureStore, save_flag, config_states} from "./definition"
import { create } from 'zustand';
import { Button } from '@mui/material';
import { KawaiPreference } from '../../typescript_src/definitions/setting_types';
const ContentComponent = styled('div')({
//    paddingTop : "7%",
   margin : "7%"
  });

const RootComponent =styled('div')({
    alignItems:"center",
   });



function App(){
    

    const [new_fetch, get_property, set_property] = config_states((state)=>[state.fetch, state.get_property, state.set_property])
    useEffect(()=>{
        new_fetch().then(()=>{console.log("load")}).then(()=>{console.log("test",get_property())})
    }, [])


    


    return (
    
        <RootComponent>
         <MemoryRouter initialEntries={["/general"]}>
         <Header />
         <ContentComponent>
         <Routes>
             <Route path="/general" element={<GeneralPreference/>} ></Route>
             <Route path="/shortcut" element={<ShortcutPreference/>}></Route>
            </Routes>
         </ContentComponent>
          </MemoryRouter>
         {/* <Footer/>  */}
         </RootComponent>
    )
}


export default App;