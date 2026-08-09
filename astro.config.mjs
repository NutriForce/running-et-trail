// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://running-et-trail.fr',
  integrations: [sitemap()],
});
