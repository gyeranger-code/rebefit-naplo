# ReBeFit Napló

Rebeka személyi edzés-naplója: kliensek, naptár, bérletek és havi elszámolás. Telepíthető PWA, ami offline is működik. Az adatok a telefonon maradnak, a biztonsági mentés JSON fájlba megy.

Build, framework és backend nélkül készült: sima HTML + CSS + JS, ugyanúgy, mint az Edzésnapló korai verziója.

## Funkciók

- **Kliensek**: név, telefon, megjegyzés, saját szín a naptárban.
- **Naptár**: havi nézet, nyilakkal vagy oldalra húzással lapozható. Bármelyik napra rá lehet bökni, és arra a napra utólag is fel lehet vinni alkalmat. A kijelölt napra még egyszer bökve gyors felvitel nyílik.
- **Gyors felvitel (+)**: dátum, időpont, típus (Személyi / VIP / Póz), és **több kliens egyszerre** (pl. csoportos póz).
- **Napok jelölése** (a kliens adatlapján): egy havi naptárban a napokra bökve ki-be kapcsolható, hogy a kliens ott volt-e. Ez a leggyorsabb módja a régi adatok visszamenőleges feltöltésének.
- **Fix időpontok**: a kliens adatlapján beállítható, mely napokon és hánykor jön (pl. H–Sze–P 16:00), és egy gombnyomással előre beírja a megadott számú alkalmat (alapból annyit, amennyi a bérletből hátravan, különben 12-t). A jövőbeli alkalmak „tervezett” jelzést kapnak, és csak az adott napon számítanak bele a statisztikába és az elszámolásba. Lemondásnál: rábökni → Lemondta.
- **Bérletek** (a 2026.01.01-es árlista szerint): 8/12 alkalom 30 napra, csomagok, 10 alkalmas pózbérlet. Az alkalmak **automatikusan** levonódnak a dátum szerint megfelelő bérletből, a már korábban rögzítettek is. Ha valami nem fér bele, az alkalmi árra kerül.
- **Figyelmeztetések**: a bérlet hamarosan lejár, elfogyott, vagy kihasználatlan alkalmakkal járt le.
- **Elszámolás**: havi összesítő kliensenként. Kiírja, mennyi az alkalmi és mennyi a bérletes alkalom, a dátumokat, a számlázandó összeget, és van egy „Számla kiállítva” jelölő. A **Másolás** gomb kész szöveget ad a számlázóba. Ha valaki alkalmi áron drágábban jönne ki, mint bérlettel, tippet is ad.
- **Mentés / visszaállítás**: JSON fájl. iPhone-on a megosztás lapról „Mentés a Fájlokba” lehetőséggel menthető. Ha 7 napja nem volt mentés, figyelmeztet.
- Sötét / világos / automatikus téma, offline működés (service worker).

## Fájlok

```
index.html            app shell
style.css             minden stílus (design tokenek a :root-ban)
app.js                minden logika
sw.js                 service worker (offline cache)
manifest.webmanifest  PWA manifest
icons/                app ikonok (icon.svg a forrás)
fonts/                Cormorant Garamond + Inter (offline, a repóban)
MENTES-UTMUTATO.md    útmutató Rebekának
```

## Helyi futtatás

```bash
# a projekt mappájában
npx serve .
# vagy
python -m http.server 8080
```

Ezután nyisd meg: http://localhost:8080. A service worker csak http(s)-en működik, `file://`-ról nem.

## Publikálás: GitHub Pages (ingyenes)

1. Cursorban: **Source Control → Publish to GitHub**, legyen **public** repo (ingyenes GitHub fióknál a Pages csak public repóval megy). Az adatok nem a repóban vannak, csak a kód, így ez nem gond.
2. GitHubon: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
3. 1–2 perc múlva elérhető: `https://gyeranger-code.github.io/rebefit-naplo/`

Netlify is működik (drag & drop vagy a repo bekötése), build lépés nincs.

## Új verzió kiadása

1. Módosítsd a kódot.
2. **Emeld a verziót** a `sw.js` fájlban (`const VERSION = 'v1.0.1'`) és az `app.js` fájlban (`APP_VERSION`).
3. Commit és push. Rebeka telefonján az app következő megnyitásakor megjelenik az „Új verzió érhető el · Frissítés” értesítés.

Ha elmarad a verzióemelés, a telefon továbbra is a régi, cache-elt verziót mutatja.

## Adatmodell (localStorage: `rbf-naplo-v1`)

```js
{
  schema: 1,
  settings: { name, theme, lastBackup, changes },
  services: [{ id, cat, name, price, sessions, days, single? }],      // árlista
  clients:  [{ id, name, phone, note, color, lastKind, createdAt }],
  sessions: [{ id, clientId, date:'YYYY-MM-DD', time, kind:'szemelyi'|'vip'|'pozo', note, unitPrice?, createdAt }],
  passes:   [{ id, clientId, serviceId, name, cat, sessions, price, start, end, paid, createdAt }],
  billing:  { 'clientId|YYYY-MM': isoDate }                          // „számla kiállítva” jelölés
}
```

Az, hogy melyik alkalom melyik bérletbe esik, nincs eltárolva, mindig újraszámolódik (`derived()` az app.js-ben). Az alkalmak dátum szerint sorban töltik fel a hozzájuk illő, érvényes bérletet, ezért egy utólag felvitt bérlet vagy alkalom után is minden stimmel.

## Fontos tudnivalók (iPhone)

- **Csak a főképernyőről indítva** szabad használni. Az iOS a Safari-fül és a telepített app adatait külön tárolja.
- A főképernyőre tett appnál az iOS nem törli automatikusan az adatokat, de ha az appot törlik, vagy a Beállításokban törlik a webhelyadatokat, az adatok elvesznek. Ezért fontos a rendszeres mentés.
- Ha később több eszközről is el kell érni (pl. telefon + laptop), a következő lépés a Supabase-backend. A JSON-formátum úgy készült, hogy importálható legyen.
