# sumoDuell

Zwei schwerfällige Sumoringer kämpfen auf einer schwebenden Plattform. Wer den Rand übertritt, verliert die Runde. Wer zuerst zwei Runden gewinnt, gewinnt das Match. Nach 60 Sekunden schrumpft die Plattform, damit jede Runde endet.

Direkt im Browser spielen: <https://emilytilarom.github.io/sumo-duell/>

## Start

```bash
npm install
npm run dev
```

## Spielmodi

- **Kampagne:** 10 Level gegen 10 verschiedene KI-Sumos. Ein Sieg schaltet das nächste Level frei, der Fortschritt bleibt im Browser gespeichert.
- **Zwei Spieler:** beide an einer Tastatur.
- **Mehr Ringer:** 3 oder 4 Ringer, wahlweise *Jeder gegen jeden* (wer zuletzt steht, gewinnt die Runde) oder *Einer gegen Team* (Spieler 1 allein gegen alle anderen, die zusammenhalten). Ein oder zwei Menschen spielen an der Tastatur, freie Plätze übernimmt die KI.

## Online

Unter **Online** erstellt einer einen Raum und schickt den fünfstelligen Code an Freunde. Bis zu drei weitere Spieler treten bei, der Host wählt Modus und Zahl der Ringer, freie Plätze übernimmt die KI. Der Host berechnet das Spiel, die anderen schicken nur ihre Eingaben. Verliert ein Gast die Verbindung, spielt die KI für ihn weiter.

Gut zu wissen:

- Die Verbindung vermittelt [PeerJS](https://peerjs.com/) über seinen öffentlichen Server. Das ist ein fremder Dienst, auf den dieses Projekt keinen Einfluss hat.
- Danach verbinden sich die Browser direkt per WebRTC. Dabei sehen die Mitspieler gegenseitig ihre IP-Adresse.
- Bei strengen Firewalls oder manchen Mobilfunknetzen kann die Verbindung scheitern, weil es keinen eigenen Weiterleitungsserver gibt.

## Skins

Siege bringen Münzen, schwerere Level mehr und der erste Sieg über ein Level doppelt so viele. Im Menü **Skins** kauft und wählt jeder Spieler sein Aussehen: Früchte, Countryballs und Krypto-Münzen. Zwei besondere Skins gibt es nur über die Kampagne. Das Standard-Aussehen bleibt erhalten. Die Skins verändern nur das Aussehen, nicht die Spielwerte. Die Münzen sind reine Spielwährung, ohne echtes Geld.

## Steuerung

| | Bewegen | Stoß | Stemmen | Ausweichen |
| --- | --- | --- | --- | --- |
| **Spieler 1** | `W A S D` | `F` | `G` | `H` |
| **Spieler 2** | Pfeiltasten | `,` | `.` | `-` |

In der Kampagne spielst du als Spieler 1. `Esc` pausiert das Match.

Auf Handy und Tablet steuerst du Spieler 1 mit einem Joystick links und drei Knöpfen rechts: Stoß (halten zum Aufladen), Stemmen und Ausweichen. Gespielt wird im Querformat.

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
  touch.js       Touch-Steuerung
  game/
    world.js     Spielzustand und Schritt
    physics.js   Bewegung, Reibung, Stöße
    actions.js   Stoß, Stemmen, Ausweichen, Ausdauer
    rules.js     Ring-out, Runden, Match, Schrumpfen
    ai.js        KI-Gegner
    campaign.js  Level und Fortschritt
    skins.js     Skins, Münzen und Kaufen
  net/           Online: Nachrichten, Host, Gast, PeerJS
tests/           Tests und Kampfsimulation
```
