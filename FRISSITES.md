# Frissítés kiadása a gépekre

Ha módosítottunk a programon, így juttatod ki mindenkihez:

## 1. Verziószám emelése

A `package.json` fájlban keresd meg a `"version"` sort, és emeld:

```
"version": "2.1.0"   ->   "version": "2.2.0"
```

Ez KÖTELEZŐ. A többi gép ebből tudja, hogy van újabb - ha nem emeled,
nem fog frissülni semmi.

## 2. Token megadása (csak legelső alkalommal)

A feltöltéshez a GitHub egy jelszószerű kulcsot kér. Létrehozás:

1. https://github.com/settings/tokens -> "Generate new token (classic)"
2. Note: `tmp-muhely-hub`, Expiration: `No expiration`
3. Pipáld be a **repo** négyzetet (a fő pipa, az alatta lévők maguktól bejönnek)
4. Generate token -> MÁSOLD KI és tedd el, mert csak egyszer mutatja meg

Ezt beírod egyszer a parancssorba (rendszergazdai ablakban):

```
setx GH_TOKEN "ide_masold_a_tokent"
```

Utána zárd be a parancssort, és nyiss egy újat, hogy érvényes legyen.

## 3. Kiadás

Rendszergazdai parancssorban:

```
cd C:\tmp-muhely-hub\tmp-muhely-hub
npm run publish
```

Ez legyártja a telepítőt ÉS fel is tölti a GitHubra, vázlat (draft)
kiadásként.

## 4. Kiadás közzététele

1. Nyisd meg: https://github.com/galcsoni/tmp-muhely-hub/releases
2. A legfelső bejegyzés mellett "Edit" (ceruza)
3. Görgess le, és nyomd meg a zöld **Publish release** gombot

Amíg vázlat, addig a gépek NEM látják. Ez jó: nyugodtan kiadhatsz
valamit, kipróbálhatod, és csak akkor teszed közzé, ha jó.

## 5. Mi történik a műhelyben

A gépeken a program induláskor megnézi a GitHubot. Ha van újabb:

- felugrik: "Elérhető a 2.2.0 verzió - Letöltés / Most nem"
- letöltés a háttérben, tálcán folyamatjelzővel
- a végén: "Újraindítás most / Később"
- ha a Későbbit választja, a következő bezáráskor magától települ

Kézzel is kereshető: **Súgó -> Frissítés keresése...**

## Az adatokról

Az adatok NEM a programban vannak, hanem a Firebase felhőben. A frissítés
csak a programot cseréli le, az adatokhoz nem nyúl. Ezért nem veszhet el
semmi frissítéskor.
