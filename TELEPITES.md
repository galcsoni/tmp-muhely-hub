# TMP Műhely Hub - telepítő készítése és kirakása a gépekre

## Amire szükség van (csak a te gépeden, egyszer)

- **Node.js LTS** (20 vagy 22): https://nodejs.org - a "LTS" gombot töltsd le, telepítés Tovább-Tovább-Kész
- Telepítés után nyiss egy **új** parancssort (különben nem látja a node-ot)

## 1. Telepítő elkészítése

Csomagold ki ezt a mappát valahová, pl. `C:\tmp-muhely-hub`, majd:

```
cd C:\tmp-muhely-hub
npm install
npm run dist:win
```

Az `npm install` első alkalommal pár percig tart (letölti az Electront, kb. 300 MB).
A `npm run dist:win` után a kész telepítő itt lesz:

```
kiadas\TMP Muhely Hub Setup 2.0.0.exe
```

Ez az egy fájl kell a többi géphez. Pendrive-ra másolod, és kész.

## 2. Telepítés a műhelyi gépekre

Futtasd a `TMP Muhely Hub Setup 2.0.0.exe`-t. Felhasználói szintre telepít,
tehát **nem kér rendszergazda jelszót**. Készít asztali ikont és
Start menü bejegyzést.

A Windows SmartScreen valószínűleg figyelmeztetni fog, hogy ismeretlen kiadó
(mert nincs megvásárolt kódaláíró tanúsítványunk). Ilyenkor:
**További információ → Futtatás mindenképp**. Ez egyszeri dolog gépenként.

## 3. Fontos tudnivalók

- Az app **internetkapcsolatot igényel**, mert az adatok a Firebase felhőben
  vannak. Amit az egyik gépen beírsz, a másikon azonnal látszik.
- A jobb felső sarokban lévő pötty mutatja a kapcsolatot: zöld = él a kapcsolat.
- Az első indítás előtt érdemes a **Mentések** modulban letölteni egy mentést.

## 4. Későbbi frissítés

Ha változik a program:

1. A frissített fájlokat bemásolod az `app\` mappába
2. A `package.json`-ban emeled a `"version"` értékét (pl. `2.0.1`)
3. `npm run dist:win`
4. Az új Setup .exe-t futtatod a gépeken - felülírja a régit, adat nem vész el

## Mac / Linux

Ha valamelyik gép nem Windows:

```
npm run dist:mac      # .dmg
npm run dist:linux    # .AppImage
```

Figyelem: mac telepítőt csak macen, Windows telepítőt legegyszerűbben
Windowson lehet készíteni.
