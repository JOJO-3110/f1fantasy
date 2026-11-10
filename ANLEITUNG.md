# F1 Liga: Update einspielen

Das Paket enthält:

- `index.html` – die neue App (ersetzt die alte)
- `manifest.webmanifest`, `sw.js` und der Ordner `icons` – damit sich die App auf dem Handy installieren lässt
- `scripts/fetch-data.js` – holt die F1-Daten
- `.github/workflows/update-f1-data.yml` – startet das Skript jede Stunde von allein
- diese Anleitung

## 1. Dateien ins Repo

Öffne dein Repo auf github.com.

1. Kopiere vorher die alte `index.html` als Sicherung, zum Beispiel nach `index-alt.html`.
2. Klicke auf **Add file → Upload files** und ziehe `index.html`, `manifest.webmanifest`, `sw.js` und die Ordner `icons` und `scripts` hinein. Alles muss im selben Ordner liegen wie die `index.html`. Speichern mit **Commit changes**.
3. Der Ordner `.github` ist im Finder unsichtbar (am Mac: Cmd + Umschalt + Punkt zeigt ihn). Einfacher: **Add file → Create new file**, als Namen `.github/workflows/update-f1-data.yml` eintippen (die Schrägstriche legen die Ordner an), den Inhalt der Datei einfügen und speichern.

## 2. App auf dem Handy installieren

Warte nach dem Hochladen eine Minute, bis die Seite neu veröffentlicht ist, und öffne sie dann am Handy.

- **Android (Chrome):** Menü oben rechts (drei Punkte), dann **App installieren**. Oder in der App unter **Menü → App installieren**.
- **iPhone (Safari):** Unten auf das Teilen-Symbol tippen, dann **Zum Home-Bildschirm**.

Danach liegt die App mit Symbol auf dem Startbildschirm, öffnet ohne Browserleiste und startet schneller. Ohne Internet zeigt sie das Gerüst, Daten kommen erst wieder mit Verbindung. Updates kommen automatisch, sobald du online bist.

## 3. Abruf einmal starten

1. Im Repo auf den Tab **Actions**. Falls ein Hinweis erscheint, auf „I understand my workflows, go ahead and enable them“ klicken.
2. Links **F1-Daten aktualisieren** wählen, dann **Run workflow**.
3. Nach etwa einer Minute sollte ein grüner Haken da sein. Im Lauf steht dann „Gespeichert.“
4. In der App: **Verwalten → F1-Daten neu laden**. Unter **Karten** erscheinen jetzt Punkte und Platzierungen.

Wird der Lauf rot: Lauf öffnen, den Schritt „Daten holen und speichern“ aufklappen, den Text kopieren und mir schicken. Das Skript speichert nichts Kaputtes und zeigt, was am Aufbau der Feeds nicht passt.

## 4. Beim ersten Mal: Gesamtpunkte und Zähler

**Gesamtpunkte.** Die Tabelle richtet sich jetzt nach dem Gesamtstand der Saison, nicht nach dem letzten Rennen. Die App weiß nicht, wie eure Kader früher aussahen, deshalb trägst du den Stand einmal ein:

1. Auf der Ranking-Seite auf **Gesamtpunkte bearbeiten** klicken.
2. Die aktuellen Gesamtpunkte der 8 Spieler eintragen.
3. Bei **inklusive Rennen** die Nummer des letzten Rennens eintragen, das in diesem Stand schon steckt. Wenn du das Rennen, das du gerade auswertest, schon eingerechnet hast, ist es dessen Nummer. Dann wird es nicht noch einmal dazugezählt.
4. Speichern. Ab dann rechnet die App selbst weiter.

**Team-Zähler.** Der Zähler geht jetzt nach jeder bestätigten Rennauswertung um 1 hoch. Auf der Abgabe-Seite steht also schon das neue Rennen drin, und bei 4/4 steht „muss abgegeben werden“. Gibst du ein Team ab oder tauschst es, wird sein Zähler gelöscht. Ein neu geholtes Team steht nach seinem ersten Rennen auf 1/4. Die bisherigen Werte können noch aus der alten Zählweise stammen: einmal unter **Rennen-Zähler bearbeiten** durchsehen und korrigieren.

## 5. Danach, nach jedem Rennen

Auf der Ranking-Seite auf **Ranking aus Fantasy-Punkten übernehmen** klicken, prüfen und **Weiter**. Rennpunkte, Gesamtstand und DNFs kommen aus den Daten, der Rest läuft wie bisher. Bei Gleichstand zeigt die App eine Warnung, die Reihenfolge kannst du von Hand ändern.

## Neu in dieser Version

- **Rating nach Form:** Das Rating richtet sich jetzt nach der aktuellen Form (Ø Punkte der letzten 5 Rennen, die neuesten zählen mehr, dazu der Saison-Ø). Wer nachlässt, fällt zurück. Auf der Karte zeigt ein Pfeil die Änderung seit dem Rennen davor.
- **Nächstes Rennen:** Im Draft und auf der Ergebnis-Seite steht, welche Strecke als Nächstes dran ist, mit Ort und Tagen. Das kommt aus dem Abruf, es erscheint also nach dem nächsten Lauf auf GitHub.
- **Handy-Version:** Auf dem Handy schaltet sich eine eigene Ansicht automatisch ein: Tab-Leiste unten, schlanke Kopfzeile, zugeklappte Kader, und beim Draft bleibt unten eine Leiste mit Ø Rating und „Pick bestätigen“ stehen. Am PC kannst du sie unter **Menü → Ansicht** ausprobieren (Auto, Handy, PC).
- **Animationen:** Zahlen zählen hoch, das Podium wächst, die Linien im Tabellenverlauf zeichnen sich, Gold-Karten glänzen und kippen mit der Maus. Beim Draft pulsiert der Platz am Zug, und neue Fahrer leuchten kurz im Kader auf. Nach dem Draft deckst du deine Neuzugänge als Karten auf (mit „Nochmal aufdecken“), dazu gibt es Konfetti. Wer am Gerät „Bewegung reduzieren“ eingestellt hat, sieht keine Animationen.
- **Rückgängig (nur Admin):** Während des Drafts und auch noch auf der Ergebnis-Seite gibt es **Letzten Pick rückgängig**. Die App fragt vorher, was zurückgenommen wird. Kader, Team-Zähler und Tauschsperren gehen auf den Stand davor zurück, und der Spieler ist wieder am Zug. Nach „Nächsten Draft starten“ geht das nicht mehr.
- **Hell und Dunkel:** Oben rechts wechselt ein Knopf zwischen den Modi. Die Wahl wird pro Gerät gemerkt.
- **Tabelle:** Der Verlauf der Gesamtpunkte, umschaltbar auf Plätze. Er beginnt, wenn du die Gesamtpunkte einträgst, und wächst mit jedem Ranking, das du bestätigst. Mit nur einem Stand gibt es noch keine Linie.
- **Rückblick:** Team des Rennens, Fahrer des Rennens, Pech des Rennens und Spieler des Rennens. Der Spieler des Rennens erscheint nur für Rennen, deren Ranking du bestätigt hast.
- **Kartenrückseite:** Auf der Rückseite stehen die Fantasy-Punkte der letzten 8 Rennen und der Trend. Umdrehen mit „Rückseite: Form“ oder durch Antippen der Karte.
- **Draft:** Oben die Startaufstellung mit der Reihenfolge und dem Hinweis, wie viele Züge es noch bis zu dir sind. Darunter wählst du Fahrer und Teams als Karten statt aus Listen. Gesperrte Karten sind ausgegraut und nennen den Grund. Rechts siehst du deinen Kader danach mit dem Ø Rating vorher und nachher.
- Ein Team, das ein Spieler gerade abgegeben hat, kann er im selben Draft nicht zurückholen. Das gilt jetzt auf allen Geräten.

## Gut zu wissen

- Die F1-Fantasy-Feeds sind inoffiziell. Ändert F1 etwas, kann der Abruf ausfallen. Dann bleibt der letzte Stand in der App und du kannst wie früher von Hand eintragen.
- **Haas:** Rafael Camara fährt jetzt für Esteban Ocon. Wer Ocon im Kader hatte, hat automatisch Camara. Der Admin speichert das beim nächsten Öffnen der App. Die bisherigen Punkte von Ocon und vom Ersatzfahrer Hirakawa bleiben im Verlauf, sie stehen aber nicht mehr zur Auswahl.
- GitHub schaltet geplante Abläufe nach 60 Tagen ohne Aktivität im Repo ab. Dann im Tab Actions einmal wieder einschalten.
- Die Fahrerfotos gehören Formula 1 und werden direkt von dort geladen. Fehlt ein Foto, zeigt die Karte eine Silhouette.
- Die Daten liegen in Supabase unter dem Schlüssel `f1data`. Dafür ist kein zusätzliches Geheimnis nötig, das Skript nutzt denselben öffentlichen Schlüssel wie die App.
