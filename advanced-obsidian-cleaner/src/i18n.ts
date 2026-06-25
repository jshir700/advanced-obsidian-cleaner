import * as moment from 'moment';
import enUS from './locales/en';
import zhCN from './locales/zh-cn';
import type { Locale } from './locales/locale';

interface LOCALE {
  [locale: string]: Locale;
}
const LOCALES: LOCALE = {
  en: enUS,
  'zh-cn': zhCN,
  'zh_cn': zhCN,
  zh: zhCN,
};

export default function translate(): Locale {
  let systemLocale = 'en';
  try {
    // @ts-ignore - obsidian app global
    const app = window.app;
    if (app?.vault) {
      const obsidianLocale = app.vault.getConfig('language') || app.vault.getConfig('locale') || '';
      if (obsidianLocale && LOCALES[obsidianLocale]) {
        systemLocale = obsidianLocale;
      } else {
        const mLocale = moment.locale();
        if (LOCALES[mLocale]) {
          systemLocale = mLocale;
        }
      }
    }
  } catch {
    const mLocale = moment.locale();
    if (LOCALES[mLocale]) {
      systemLocale = mLocale;
    }
  }
  return LOCALES[systemLocale] || enUS;
}
