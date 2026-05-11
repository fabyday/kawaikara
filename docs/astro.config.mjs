import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Kawaikara Docs',
      description: 'Architecture and product notes for Kawaikara.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/fabyday/kawaikara',
        },
      ],
      sidebar: [
        {
          label: 'Overview',
          slug: 'index',
        },
        {
          label: 'App',
          items: [
            {
              label: 'Package Structure',
              slug: 'app/package-structure',
            },
            {
              label: 'Update Overlay',
              slug: 'app/update-overlay',
            },
          ],
        },
      ],
    }),
  ],
});
