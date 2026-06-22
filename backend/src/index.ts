import { createApp } from './api';
import logger from './utils/logger';

const PORT = process.env.PORT ?? 3000;
createApp().listen(PORT, () => logger.info({ port: PORT }, 'ai-net backend listening'));
