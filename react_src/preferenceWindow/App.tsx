import React from 'react'
import TextField from '@mui/material/TextField';
import GeneralPreference from './GeneralPreferences';
import ShortcutPreferences from "./ShortcutPreferences"
import Footer from './Footer';
import Header from './Header';
import styled from '@emotion/styled';

import { MemoryRouter, Routes, Route, Link} from 'react-router-dom';

const ContentComponent = styled('div')({
//    paddingTop : "7%",
   margin : "7%"
  });

const RootComponent =styled('div')({
    alignItems:"center",
   });

function App(){


    return (
        <RootComponent>
        <MemoryRouter initialEntries={["/general"]}>
        <Header />
        
        <ContentComponent>
        <Routes>
            <Route path="/general" element={<GeneralPreference id={"general"}/>} ></Route>
            <Route path="/shortcut" element={<ShortcutPreferences id={"shortcut"}></ShortcutPreferences>}></Route>
            </Routes>
        </ContentComponent>
        </MemoryRouter>
        <Footer></Footer>
        </RootComponent>
    )
}


export default App;