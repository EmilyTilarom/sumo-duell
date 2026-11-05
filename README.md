# sumoDuell

Zwei schwerfällige Sumoringer kämpfen auf einer schwebenden Plattform. Wer den Rand übertritt, verliert die Runde. Wer zuerst zwei Runden gewinnt, gewinnt das Match. Nach 60 Sekunden schrumpft die Plattform, damit jede Runde endet.

## Start

```bash
npm install
npm run dev
```

## Spielmodi

- **Kampagne:** 10 Level gegen 10 verschiedene KI-Sumos. Ein Sieg schaltet das nächste Level frei, der Fortschritt bleibt im Browser gespeichert.
- **Zwei Spieler:** beide an einer Tastatur.

## Steuerung

| | Bewegen | Stoß | Stemmen | Ausweichen |
| --- | --- | --- | --- | --- |
| **Spieler 1** | `W A S D` | `F` | `G` | `H` |
| **Spieler 2** | Pfeiltasten | `,` | `.` | `-` |

In der Kampagne spielst du als Spieler 1. `Esc` pausiert das Match.

## Aktionen

| Aktion | Wirkung | Schlägt | Verliert gegen |
| --- | --- | --- | --- |
| **Stoß** | Taste halten zum Aufladen, loslassen zum Stürmen | Stemmen, wenn voll aufgeladen | Ausweichen |
| **Stemmen** | stehen bleiben, kaum wegzuschieben, kostet Ausdauer | ungeladenen Stoß | voll geladenen Stoß |
| **Ausweichen** | kurzer Seitenschritt, danach kurze Sperre | Stoß, der Gegner rutscht vorbei | Stoß nach dem Ausweichen |

Stoß, Stemmen und Ausweichen verbrauchen Ausdauer. Ohne Ausdauer bist du leichter zu schieben.

## Tests

```bash
npm test
```

Die Tests prüfen Physik, Regeln, die Aktionstabelle, den Fortschritt und die KI in simulierten Kämpfen mit festem Zufalls-Seed.

## Aufbau

Die Spiellogik in `src/game/` greift nicht auf den Browser zu. Die KI liegt ebenfalls dort und erzeugt dieselben Eingaben wie eine Tastatur.

```
src/
  main.js        Einstieg, feste Spielschleife, Spielablauf
  input.js       Tastatur zu Eingaben
  render.js      Zeichnen auf dem Canvas
  audio.js       Klänge
  ui.js          Menüs
  game/
    world.js     Spielzustand und Schritt
    physics.js   Bewegung, Reibung, Stöße
    actions.js   Stoß, Stemmen, Ausweichen, Ausdauer
    rules.js     Ring-out, Runden, Match, Schrumpfen
    ai.js        KI-Gegner
    campaign.js  Level und Fortschritt
tests/           Tests und Kampfsimulation
```
