import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: {
        en: 'Kawaikara Docs',
        ko: '카와이카라 문서',
        ja: 'カワイイカラ Docs',
      },
      description: 'Architecture and product notes for Kawaikara.',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        ko: {
          label: '한국어',
          lang: 'ko',
        },
        ja: {
          label: '日本語',
          lang: 'ja',
        },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/fabyday/kawaikara',
        },
      ],
      sidebar: [
        {
          label: 'Get Started',
          translations: {
            ko: '시작하기',
            ja: 'はじめに',
          },
          slug: 'getstart',
        },
        {
          label: 'Overview',
          translations: {
            ko: '개요',
            ja: '概要',
          },
          slug: 'overview',
        },
        {
          label: 'App',
          translations: {
            ko: '앱',
            ja: 'アプリ',
          },
          items: [
            {
              label: 'Package Structure',
              translations: {
                ko: '패키지 구조',
                ja: 'パッケージ構成',
              },
              slug: 'app/package-structure',
            },
            {
              label: 'Update Overlay',
              translations: {
                ko: '업데이트 오버레이',
                ja: 'アップデートオーバーレイ',
              },
              slug: 'app/update-overlay',
            },
          ],
        },
      ],
    }),
  ],
});
