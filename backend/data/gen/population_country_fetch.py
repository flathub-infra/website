import requests
import os
import sys
import csv
import tempfile
import zipfile



'''
    Translation data between iso2 and iso3 country code from :
    - https://www.iban.com/country-codes
'''
iso3_to_iso2 = {
    'AFG' : 'AF',
    'ALB' : 'AL',
    'DZA' : 'DZ',
    'ASM' : 'AS',
    'AND' : 'AD',
    'AGO' : 'AO',
    'AIA' : 'AI',
    'ATA' : 'AQ',
    'ATG' : 'AG',
    'ARG' : 'AR',
    'ARM' : 'AM',
    'ABW' : 'AW',
    'AUS' : 'AU',
    'AUT' : 'AT',
    'AZE' : 'AZ',
    'BHS' : 'BS',
    'BHR' : 'BH',
    'BGD' : 'BD',
    'BRB' : 'BB',
    'BLR' : 'BY',
    'BEL' : 'BE',
    'BLZ' : 'BZ',
    'BEN' : 'BJ',
    'BMU' : 'BM',
    'BTN' : 'BT',
    'BOL' : 'BO',
    'BES' : 'BQ',
    'BIH' : 'BA',
    'BWA' : 'BW',
    'BVT' : 'BV',
    'BRA' : 'BR',
    'IOT' : 'IO',
    'BRN' : 'BN',
    'BGR' : 'BG',
    'BFA' : 'BF',
    'BDI' : 'BI',
    'CPV' : 'CV',
    'KHM' : 'KH',
    'CMR' : 'CM',
    'CAN' : 'CA',
    'CYM' : 'KY',
    'CAF' : 'CF',
    'TCD' : 'TD',
    'CHL' : 'CL',
    'CHN' : 'CN',
    'CXR' : 'CX',
    'CCK' : 'CC',
    'COL' : 'CO',
    'COM' : 'KM',
    'COD' : 'CD',
    'COG' : 'CG',
    'COK' : 'CK',
    'CRI' : 'CR',
    'HRV' : 'HR',
    'CUB' : 'CU',
    'CUW' : 'CW',
    'CYP' : 'CY',
    'CZE' : 'CZ',
    'CIV' : 'CI',
    'DNK' : 'DK',
    'DJI' : 'DJ',
    'DMA' : 'DM',
    'DOM' : 'DO',
    'ECU' : 'EC',
    'EGY' : 'EG',
    'SLV' : 'SV',
    'GNQ' : 'GQ',
    'ERI' : 'ER',
    'EST' : 'EE',
    'SWZ' : 'SZ',
    'ETH' : 'ET',
    'FLK' : 'FK',
    'FRO' : 'FO',
    'FJI' : 'FJ',
    'FIN' : 'FI',
    'FRA' : 'FR',
    'GUF' : 'GF',
    'PYF' : 'PF',
    'ATF' : 'TF',
    'GAB' : 'GA',
    'GMB' : 'GM',
    'GEO' : 'GE',
    'DEU' : 'DE',
    'GHA' : 'GH',
    'GIB' : 'GI',
    'GRC' : 'GR',
    'GRL' : 'GL',
    'GRD' : 'GD',
    'GLP' : 'GP',
    'GUM' : 'GU',
    'GTM' : 'GT',
    'GGY' : 'GG',
    'GIN' : 'GN',
    'GNB' : 'GW',
    'GUY' : 'GY',
    'HTI' : 'HT',
    'HMD' : 'HM',
    'VAT' : 'VA',
    'HND' : 'HN',
    'HKG' : 'HK',
    'HUN' : 'HU',
    'ISL' : 'IS',
    'IND' : 'IN',
    'IDN' : 'ID',
    'IRN' : 'IR',
    'IRQ' : 'IQ',
    'IRL' : 'IE',
    'IMN' : 'IM',
    'ISR' : 'IL',
    'ITA' : 'IT',
    'JAM' : 'JM',
    'JPN' : 'JP',
    'JEY' : 'JE',
    'JOR' : 'JO',
    'KAZ' : 'KZ',
    'KEN' : 'KE',
    'KIR' : 'KI',
    'PRK' : 'KP',
    'KOR' : 'KR',
    'KWT' : 'KW',
    'KGZ' : 'KG',
    'LAO' : 'LA',
    'LVA' : 'LV',
    'LBN' : 'LB',
    'LSO' : 'LS',
    'LBR' : 'LR',
    'LBY' : 'LY',
    'LIE' : 'LI',
    'LTU' : 'LT',
    'LUX' : 'LU',
    'MAC' : 'MO',
    'MDG' : 'MG',
    'MWI' : 'MW',
    'MYS' : 'MY',
    'MDV' : 'MV',
    'MLI' : 'ML',
    'MLT' : 'MT',
    'MHL' : 'MH',
    'MTQ' : 'MQ',
    'MRT' : 'MR',
    'MUS' : 'MU',
    'MYT' : 'YT',
    'MEX' : 'MX',
    'FSM' : 'FM',
    'MDA' : 'MD',
    'MCO' : 'MC',
    'MNG' : 'MN',
    'MNE' : 'ME',
    'MSR' : 'MS',
    'MAR' : 'MA',
    'MOZ' : 'MZ',
    'MMR' : 'MM',
    'NAM' : 'NA',
    'NRU' : 'NR',
    'NPL' : 'NP',
    'NLD' : 'NL',
    'NCL' : 'NC',
    'NZL' : 'NZ',
    'NIC' : 'NI',
    'NER' : 'NE',
    'NGA' : 'NG',
    'NIU' : 'NU',
    'NFK' : 'NF',
    'MNP' : 'MP',
    'NOR' : 'NO',
    'OMN' : 'OM',
    'PAK' : 'PK',
    'PLW' : 'PW',
    'PSE' : 'PS',
    'PAN' : 'PA',
    'PNG' : 'PG',
    'PRY' : 'PY',
    'PER' : 'PE',
    'PHL' : 'PH',
    'PCN' : 'PN',
    'POL' : 'PL',
    'PRT' : 'PT',
    'PRI' : 'PR',
    'QAT' : 'QA',
    'MKD' : 'MK',
    'ROU' : 'RO',
    'RUS' : 'RU',
    'RWA' : 'RW',
    'REU' : 'RE',
    'BLM' : 'BL',
    'SHN' : 'SH',
    'KNA' : 'KN',
    'LCA' : 'LC',
    'MAF' : 'MF',
    'SPM' : 'PM',
    'VCT' : 'VC',
    'WSM' : 'WS',
    'SMR' : 'SM',
    'STP' : 'ST',
    'SAU' : 'SA',
    'SEN' : 'SN',
    'SRB' : 'RS',
    'SYC' : 'SC',
    'SLE' : 'SL',
    'SGP' : 'SG',
    'SXM' : 'SX',
    'SVK' : 'SK',
    'SVN' : 'SI',
    'SLB' : 'SB',
    'SOM' : 'SO',
    'ZAF' : 'ZA',
    'SGS' : 'GS',
    'SSD' : 'SS',
    'ESP' : 'ES',
    'LKA' : 'LK',
    'SDN' : 'SD',
    'SUR' : 'SR',
    'SJM' : 'SJ',
    'SWE' : 'SE',
    'CHE' : 'CH',
    'SYR' : 'SY',
    'TWN' : 'TW',
    'TJK' : 'TJ',
    'TZA' : 'TZ',
    'THA' : 'TH',
    'TLS' : 'TL',
    'TGO' : 'TG',
    'TKL' : 'TK',
    'TON' : 'TO',
    'TTO' : 'TT',
    'TUN' : 'TN',
    'TUR' : 'TR',
    'TKM' : 'TM',
    'TCA' : 'TC',
    'TUV' : 'TV',
    'UGA' : 'UG',
    'UKR' : 'UA',
    'ARE' : 'AE',
    'GBR' : 'GB',
    'UMI' : 'UM',
    'USA' : 'US',
    'URY' : 'UY',
    'UZB' : 'UZ',
    'VUT' : 'VU',
    'VEN' : 'VE',
    'VNM' : 'VN',
    'VGB' : 'VG',
    'VIR' : 'VI',
    'WLF' : 'WF',
    'ESH' : 'EH',
    'YEM' : 'YE',
    'ZMB' : 'ZM',
    'ZWE' : 'ZW',
    'ALA' : 'AX',
}

tmpfile = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
tmpdir = tempfile.TemporaryDirectory()


'''
    Downloading country Population from :
    - https://data.worldbank.org/indicator/SP.POP.TOTL

    Returns : filename of the temporary file that store the downloaded csv
'''
def download() -> str :
    filename = None

    source = 'http://api.worldbank.org/countries/all/indicators/SP.POP.TOTL?downloadformat=csv'

    response = requests.get(source)
    with open(tmpfile.name, 'wb') as d:
        d.write(response.content)

    with zipfile.ZipFile(tmpfile.name, 'r') as zip_ref:
        zip_ref.extractall(tmpdir.name)

    os.unlink(tmpfile.name)

    for path in os.scandir(tmpdir.name) :
        if path.is_file():
            if path.name.startswith('API_SP.POP.TOTL_DS2_EN'):
                filename = os.path.join(tmpdir.name, path.name)
    return filename

'''
    - process the `filename` csv
    - output in the `output` filename the json data

    JSON data : { iso2_country_code : population_of_the_given_country, ... }
'''
def process(filename, year, output):
    with open(filename) as fo:
        lines = [row for row in csv.reader(fo)]

    header = lines[4]
    index_year = header.index(year)
    index_iso3 = header.index('Country Code')

    data = lines[5:]

    with open(output, 'w', newline='') as f:
        f.write("{\n")
        # Filtering out non countries population
        data = list(filter(lambda line : line[index_iso3] in iso3_to_iso2, data))
        for i in range(len(data)):
            country_info = data[i]
            iso3 = country_info[index_iso3]
            iso2 = iso3_to_iso2[iso3]

            population = country_info[index_year]
            f.write(f"  \"{iso2}\" : {population}")
            if i != len(data) - 1 : f.write(",")
            f.write("\n")

        f.write("}")

# Checking command line arguments
if len(sys.argv) <= 2:
    print(f"Suppose to use it like that : python3 {sys.argv[0]} {{year}} {{output_file}}")
    exit(-1)
year = sys.argv[1]
output_filename = sys.argv[2]

'''
    This script should be called like this :
    > python3 population_country_fetch 2023 ../country_population.json

    requirements : the `requests` python package.
'''
if __name__ == '__main__':
    filename = None
    try:
        filename = download()
    except:
        print("Fail Downloading Population Data")
        exit(-1)

    process(filename, year, output_filename)
