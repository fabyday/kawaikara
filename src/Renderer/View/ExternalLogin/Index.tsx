import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@kawaikara/kawai-ui/styles.css';
import '../../Styles/ExternalLogin.css';
import { ExternalLoginView } from './App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('External login renderer root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <ExternalLoginView />
  </StrictMode>,
);
