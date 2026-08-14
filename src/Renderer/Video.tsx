import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@kawaikara/kawai-ui/styles.css';
import './Video.css';
import { VideoView } from './View/Video/App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Video renderer root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <VideoView />
  </StrictMode>,
);
