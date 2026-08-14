import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@kawaikara/kawai-ui/styles.css';
import './ExternalLogin.css';
import { ExternalLoginView } from './View/ExternalLogin/App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('External login renderer root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <ExternalLoginView />
  </StrictMode>,
);
