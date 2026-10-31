import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../app/App.tsx';
import { applyCachedTheme } from '../../app/use-settings.ts';
import '../../styles/app.css';

applyCachedTheme();

const container = document.getElementById('app');
if (container) {
	createRoot(container).render(
		<StrictMode>
			<App />
		</StrictMode>
	);
}
