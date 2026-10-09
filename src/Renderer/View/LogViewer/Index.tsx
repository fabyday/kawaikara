import { createRoot } from 'react-dom/client';
import '@kawaikara/kawai-ui/styles.css';
import '../../Styles/LogViewer.css';
import '../../Styles/LogViewerWindow.css';
import { LogViewerWindowApp } from './WindowApp';

/** Dedicated retained renderer, shared by embedded and detached native hosts. */
const root = document.getElementById('root');
if (!root) throw new Error('Log viewer root element was not found.');
createRoot(root).render(<LogViewerWindowApp />);
