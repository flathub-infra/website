import en from "../public/locales/en/common.json"
import en_distros from "../public/locales/en/distros.json"
import de from "../public/locales/de/common.json"
import fr from "../public/locales/fr/common.json"
import tr from "../public/locales/tr/common.json"
import fi from "../public/locales/fi/common.json"
import id from "../public/locales/id/common.json"
import pl from "../public/locales/pl/common.json"
import it from "../public/locales/it/common.json"
import ru from "../public/locales/ru/common.json"
import si from "../public/locales/si/common.json"
import vi from "../public/locales/vi/common.json"
import ar from "../public/locales/ar/common.json"
import es from "../public/locales/es/common.json"
import ja from "../public/locales/ja/common.json"
import cs from "../public/locales/cs/common.json"
import uk from "../public/locales/uk/common.json"
import et from "../public/locales/et/common.json"
import ca from "../public/locales/ca/common.json"
import el from "../public/locales/el/common.json"
import ta from "../public/locales/ta/common.json"
import fa from "../public/locales/fa/common.json"
import hi from "../public/locales/hi/common.json"
import bn from "../public/locales/bn/common.json"
import eo from "../public/locales/eo/common.json"
import lt from "../public/locales/lt/common.json"
import hr from "../public/locales/hr/common.json"
import be from "../public/locales/be/common.json"
import hu from "../public/locales/hu/common.json"
import nl from "../public/locales/nl/common.json"
import pt from "../public/locales/pt/common.json"
import oc from "../public/locales/oc/common.json"
import da from "../public/locales/da/common.json"
import az from "../public/locales/az/common.json"
import he from "../public/locales/he/common.json"
import ro from "../public/locales/ro/common.json"
import hy from "../public/locales/hy/common.json"
import ko from "../public/locales/ko/common.json"
import sv from "../public/locales/sv/common.json"
import pa from "../public/locales/pa/common.json"
import sq from "../public/locales/sq/common.json"
import ia from "../public/locales/ia/common.json"
import ckb from "../public/locales/ckb/common.json"
import ga from "../public/locales/ga/common.json"
import kab from "../public/locales/kab/common.json"
import fil from "../public/locales/fil/common.json"
import br from "../public/locales/br/common.json"
import en_GB from "../public/locales/en-GB/common.json"
import nb_NO from "../public/locales/nb-NO/common.json"
import pt_BR from "../public/locales/pt-BR/common.json"
import zh_Hans from "../public/locales/zh-Hans/common.json"
import zh_Hant from "../public/locales/zh-Hant/common.json"

const messagesByLocale: Record<string, any> = {
  en: { ...en, distros: en_distros },
  de,
  fr,
  tr,
  fi,
  id,
  pl,
  it,
  ru,
  si,
  vi,
  ar,
  es,
  ja,
  cs,
  uk,
  et,
  ca,
  el,
  ta,
  fa,
  hi,
  bn,
  eo,
  lt,
  hr,
  be,
  hu,
  nl,
  pt,
  oc,
  da,
  az,
  he,
  ro,
  hy,
  ko,
  sv,
  pa,
  sq,
  ia,
  ckb,
  ga,
  kab,
  fil,
  br,
  en_GB,
  nb_NO,
  pt_BR,
  zh_Hans,
  zh_Hant,
}

const nextIntl = {
  defaultLocale: "en",
  messagesByLocale,
}

export default nextIntl
