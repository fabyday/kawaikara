import React from "react";
import App from "./App";
import ReactDOM from 'react-dom/client';
import { CssBaseline, GlobalStyles } from "@mui/material";



const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(


  <React.StrictMode>
     <CssBaseline />
      <GlobalStyles
        styles={{
          "html, body": {
            height: "100vh",
            overflow: "hidden",
          },
        }}
      />
    <App ></App>
  </React.StrictMode>
);