import { de, enUS, tr, fr, nb, fi, id, pl, pt, it, ru, vi, ar, es, ja } from 'date-fns/locale'

export type Language = 'de' | 'en' | 'fr' | 'nb_NO' | 'tr' | 'fi' | 'id' | 'pl' | 'pt_BR' | 'it' | 'ru' | 'si' | 'vi' | 'ar' | 'es' | 'ja';

export const languages: Language[] = [
  'de', 'en', 'fr', 'nb_NO', 'tr', 'fi', 'id', 'pl', 'pt_BR', 'it', 'ru', 'si', 'vi', 'ar', 'es', 'ja']

export function getLocale(language: string): Locale {
  switch (language) {
    case 'de':
      return de
    case 'en':
      return enUS
    case 'fr':
      return fr
    case 'nb_NO':
      return nb
    case 'tr':
      return tr
    case 'fi':
      return fi
    case 'id':
      return id
    case 'it':
      return it
    case 'pl':
      return pl
    case 'pt_BR':
      return pt
    case 'ru':
      return ru;
    case 'si':
      return enUS; // date-fns has no Sinhala locale
    case 'vi':
      return vi;
    case 'ar':
      return ar;
    case 'es':
      return es;
    case 'ja':
      return ja;

    default:
      return enUS
  }
}

export function getLocaleString(language: string): string {
  switch (language) {
    case 'de':
      return 'de_DE'
    case 'en':
      return 'en_US'
    case 'fr':
      return 'fr_FR'
    case 'nb_NO':
      return 'nb_NO'
    case 'tr':
      return 'tr_TR'
    case 'fi':
      return 'fi_FI'
    case 'id':
      return 'id_ID'
    case 'it':
      return 'it_IT'
    case 'pl':
      return 'pl_PL'
    case 'pt_BR':
      return 'pt_BR'
    case 'ru':
      return 'ru_RU'
    case 'si':
      return 'si_LK'
    case 'vi':
      return 'vi_VN'
    case 'ar':
      return 'ar_AE'
    case 'es':
      return 'es_ES'
    case 'ja':
      return 'ja_JP'

    default:
      return 'en_US'
  }
}

export function getLanguageName(language: Language): string {
  switch (language) {
    case 'de':
      return 'Deutsch'
    case 'en':
      return 'English'
    case 'fr':
      return 'Français'
    case 'nb_NO':
      return 'Norsk'
    case 'tr':
      return 'Türkçe'
    case 'fi':
      return 'Suomi'
    case 'id':
      return 'Bahasa Indonesia'
    case 'it':
      return 'Italiano'
    case 'pl':
      return 'Polski'
    case 'pt_BR':
      return 'Português'
    case 'ru':
      return 'Русский язык'
    case 'si':
      return 'සිංහල'
    case 'vi':
      return 'Tiếng Việt'
    case 'ar':
      return 'العربية'
    case 'es':
      return 'Español'
    case 'ja':
      return '日本語'

    default:
      return assertUnreachable(language)
  }
}

function assertUnreachable(_x: never): never {
  throw new Error("Didn't expect to get here");
}