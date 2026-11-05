# sumoDuell

Zwei Sumoringer kämpfen auf einer runden Plattform. Wer den Rand übertritt oder hinunterfällt, verliert die Runde. Gespielt wird zu zweit an einer Tastatur im Browser.

Bisher steht nur das Grundgerüst: Der Browser zeigt einen leeren Ring.

## Start

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```

Die Spiellogik in `src/game/` greift nicht auf den Browser zu, damit Vitest sie direkt prüfen kann.
