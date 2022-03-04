
import { de, enUS } from 'date-fns/locale'

export function getLocale(language: string): Locale {
    switch (language) {
        case 'de':
            return de
        case 'en':
            return enUS
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
        default:
            return "en_US"
    }
}
