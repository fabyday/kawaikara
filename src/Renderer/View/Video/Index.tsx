import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@kawaikara/kawai-ui/styles.css';
import '../../Styles/Video.css';
import { VideoView } from './App';

/** Stores the root value. */
const root = document.getElementById('root');
if (!root) {
  throw new Error('Video renderer root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <VideoView />
  </StrictMode>,
);
