import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Bootstrap from './components/Bootstrap';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
