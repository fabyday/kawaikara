import React from 'react'
import TextField from '@mui/material/TextField';
import GeneralPreference from './GeneralPreferences';
import ShortcutPreferences from "./ShortcutPreferences"
import {BrowserRouter, Routes, Route} from 'react-router-dom'
function App(){


    return (
        <BrowserRouter>
        <Routes>
            <Route path="/worker.html" element={<GeneralPreference id={"general"}/>} ></Route>
            <Route path="/worker2.html" element={<ShortcutPreferences id={"shortcut"}></ShortcutPreferences>}></Route>
            </Routes>
        </BrowserRouter>
    )
}


export default App;