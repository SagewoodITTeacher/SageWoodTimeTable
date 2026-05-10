import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Bootstrap from './components/Bootstrap';
import { FirebaseProvider } from './context/FirebaseContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FirebaseProvider>
      <Bootstrap />
    </FirebaseProvider>
  </StrictMode>,
);
