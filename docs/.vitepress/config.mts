import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'ACoord',
  description: 'Atomic Coordinate Toolkit for VS Code',
  base: '/acoord/',

  head: [
    ['link', { rel: 'icon', href: '/acoord/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/logo.png',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Tutorials', link: '/tutorials/' },
      { text: 'Features', link: '/features/' },
      { text: 'GitHub', link: 'https://github.com/wxia529/acoord' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'File Formats', link: '/guide/file-formats' },
          ],
        },
      ],
      '/tutorials/': [
        {
          text: 'Tutorials',
          items: [
            { text: 'Overview', link: '/tutorials/' },
            { text: 'Viewing Structures', link: '/tutorials/viewing-structures' },
            { text: 'Editing Atoms', link: '/tutorials/editing-atoms' },
            { text: 'Working with Trajectories', link: '/tutorials/working-with-trajectories' },
          ],
        },
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'Overview', link: '/features/' },
            { text: '3D Visualization', link: '/features/3d-visualization' },
            { text: 'Atom Selection', link: '/features/atom-selection' },
            { text: 'Bond Measurement', link: '/features/bond-measurement' },
            { text: 'Unit Cell Editor', link: '/features/unit-cell' },
            { text: 'Color Schemes', link: '/features/color-schemes' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/wxia529/acoord' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 ACoord',
    },

    search: {
      provider: 'local',
    },
  },
});
