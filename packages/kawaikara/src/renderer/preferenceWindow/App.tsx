import React, { useEffect } from 'react'
import GeneralPreference from './GeneralPreferences';
import ShortcutPreference from "./ShortcutPreferences"
import Footer from './Footer';
import Header from './Header';
import styled from '@emotion/styled';

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { config_states } from "./definition"
const ContentComponent = styled('div')({
//    paddingTop : "7%",
   margin : "7%"
  });

const RootComponent =styled('div')({
    alignItems:"center",
   });

const Router = MemoryRouter as any;
const AppRoutes = Routes as any;
const AppRoute = Route as any;


function App(){
    

    const [new_fetch, get_property, set_property] = config_states((state)=>[state.fetch, state.get_property, state.set_property])
    useEffect(()=>{
        new_fetch().then(()=>{console.log("load")}).then(()=>{console.log("test",get_property())})
    }, [])


    


    return (
    
        <RootComponent>
         <Router initialEntries={["/general"]}>
         <Header />
         <ContentComponent>
         <AppRoutes>
             <AppRoute path="/general" element={<GeneralPreference/>} ></AppRoute>
             <AppRoute path="/shortcut" element={<ShortcutPreference/>}></AppRoute>
            </AppRoutes>
         </ContentComponent>
          </Router>
         <Footer/> 
         </RootComponent>
    )
}


export default App;
