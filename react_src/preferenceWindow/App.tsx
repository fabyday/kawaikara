import React, { useEffect } from 'react'
import GeneralPreference from './GeneralPreferences';
import ShortcutPreference from "./ShortcutPreferences"
import Footer from './Footer';
import Header from './Header';
import styled from '@emotion/styled';
import { Configure } from '../../typescript_src/definitions/types';

import { MemoryRouter, Routes, Route, Link} from 'react-router-dom';
import { ipcRenderer } from 'electron';

const ContentComponent = styled('div')({
//    paddingTop : "7%",
   margin : "7%"
  });

const RootComponent =styled('div')({
    alignItems:"center",
   });

function App(){
    
    let [config, set_config] = React.useState<Configure>()
    let [changed_config, set_changed_config] = React.useState<Configure>({})

    useEffect(()=>{
       
        window.preference_api.get_data().then((res :Configure)=>{
            set_config(res)
        })
    })


    let [pref_changed, set_pref_changed] = React.useState(false)

    return (
        <RootComponent>
        <MemoryRouter initialEntries={["/general"]}>
        <Header />
        
        <ContentComponent>
        <Routes>
            <Route path="/general" element={<GeneralPreference preference_changed = {set_pref_changed} id={"general"}/>} ></Route>
            <Route path="/shortcut" element={<ShortcutPreference preference_changed = {set_pref_changed} id={"shortcut"}></ShortcutPreference>}></Route>
            </Routes>
        </ContentComponent>
        </MemoryRouter>
        <Footer pref_changed = {pref_changed} pref_changed_function={set_pref_changed}></Footer>
        </RootComponent>
    )
}


export default App;