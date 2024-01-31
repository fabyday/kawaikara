import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from "./App";
import { Configure } from '../../typescript_src/definitions/types';

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(


  <React.StrictMode>
    <App ></App>
  </React.StrictMode>
);