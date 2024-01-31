import React from 'react'
import TextField from '@mui/material/TextField';
import GeneralPreference from './GeneralPreferences';
import ShortcutPreferences from "./ShortcutPreferences"
import Footer from './Footer';
import Header from './Header';
import styled from '@emotion/styled';
import { Configure } from '../../typescript_src/definitions/types';

import { MemoryRouter, Routes, Route, Link} from 'react-router-dom';

const ContentComponent = styled('div')({
//    paddingTop : "7%",
   margin : "7%"
  });

const RootComponent =styled('div')({
    alignItems:"center",
   });

function App(conf : Configure){
    // React.useEffect(()=>{
    //     window.preference_api.save_and_close();
    //     window.preference_api.apply_changed_preference();
    // });

    let [pref_changed, set_pref_changed] = React.useState(false)

    return (
        <RootComponent>
        <MemoryRouter initialEntries={["/general"]}>
        <Header />
        
        <ContentComponent>
        <Routes>
            <Route path="/general" element={<GeneralPreference preference_changed = {set_pref_changed} id={"general"}/>} ></Route>
            <Route path="/shortcut" element={<ShortcutPreferences preference_changed = {set_pref_changed} id={"shortcut"}></ShortcutPreferences>}></Route>
            </Routes>
        </ContentComponent>
        </MemoryRouter>
        <Footer pref_changed = {pref_changed} pref_changed_function={set_pref_changed}></Footer>
        </RootComponent>
    )
}


export default App;