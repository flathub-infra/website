
import { de, enUS, tr, fr, nb } from 'date-fns/locale'

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
        default:
            return enUS
    }
}

export function getLocaleString(language: string): string {
    switch (language) {
        case 'de':
            return "de_DE"
        case 'en':
            return "en_US"
        case 'fr':
            return "fr_FR"
        case 'nb_NO':
            return "nb_NO"
        case 'tr':
            return "tr_TR"
        default:
            return "en_US"
    }
}
