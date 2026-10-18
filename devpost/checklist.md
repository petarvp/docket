---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Настройка и връзка с личния Apps Script**
  Becomes usable: Въвеждаш своя Apps Script URL и код за достъп в приложението и виждаш, че страницата наистина се свързва с твоя личен бекенд (ping отговаря успешно).
  Why now: Проверява най-големия технически риск от спецификацията — дали POST заявка от статична страница реално стига до Apps Script — преди върху него да стъпи цялата останала логика. Bootstrapping-ът (файлова структура, локален сървър, deploy на Apps Script) живее тук, не като отделна стъпка.
  PRD ref: `prd.md > The Core Journey` (стъпки 1-2), `prd.md > Настройка за всеки потребител`
  Spec ref: `spec.md > File Structure`, `spec.md > Components` (Страница: Welcome и Настройка, Apps Script: Рутер и сигурност), `spec.md > External Services and Dependencies` (Apps Script уеб приложение), `spec.md > Where It Runs and How Someone Tries It`
  Build: Файлова структура по спецификацията (`index.html`, `css/`, `js/app.js` минимален старт, `apps-script/Code.gs` с `doPost` рутер + проверка на `ACCESS_TOKEN` + `setup()` + действие `ping`). Welcome екран (3 карти) + екран Настройка с полета за Script URL, код за достъп, Groq ключ и бутон „провери връзка". Deploy на Apps Script като Web app, пускане на `setup()`. Стартиране с `python3 -m http.server`.
  Verify (mechanical): Стартирам локалния сървър и отварям страницата; пускам `setup()` в редактора на Apps Script и проверявам, че листовете се създават със заглавни редове; от екрана Настройка натискам „провери връзка" с реалния URL/код и очаквам успешен `ping`; пробвам грешен код и очаквам ясна грешка.
  Learner check: Отвори страницата локално, следвай инструкциите, въведи своя Script URL и код, натисни „провери връзка" и ми кажи какво виждаш.
  Commit: `Add setup screens and Apps Script connection check`

- [x] **2. AI предложение → потвърждение → табло с реални задачи (ядрото)**
  Becomes usable: Поставяш имейл или текст в чата, AI предлага задачи и колони по правилото за категориите, потвърждаваш, и задачите реално се запазват в твоята Google Таблица и се показват на таблото.
  Why now: Това е уникалното ядро на проекта (динамични категории + едно поставяне → няколко задачи) — трябва да дойде веднага след настройката, не накрая.
  PRD ref: `prd.md > The Core Journey` (стъпки 3-7), `prd.md > Въвеждане и AI предложение`, `prd.md > Правило за категориите (ядрото)`, `prd.md > Логове (заготовка за тезата)`
  Spec ref: `spec.md > Components` (Табло, Чат и предложение, Връзка с Apps Script, Apps Script: Данни, Apps Script: AI, Apps Script: Логове), `spec.md > Data Model`, `spec.md > External Services and Dependencies` (Groq Chat Completions)
  Build: `js/board.js` (празно табло + колони/картички), `js/chat.js` (плаващ бутон → чат, `propose`, предложение с етикет „нова", корекция, потвърждение), `js/api.js` (всички fetch заявки), `apps-script/Ai.gs` (заявка към Groq със строга JSON схема, правилото за категориите), `apps-script/Data.gs` (`getAll`, `applyChanges` за `create`), `apps-script/Logs.gs` (`logEvent`). Преди да се вкара реалният модел — бърза проверка на безплатните лимити на Groq за `gpt-oss-20b`.
  Verify (mechanical): Поставям примерния имейл за откриването и очаквам предложение с около 4 задачи и разумни категории/срокове; пращам корекция и очаквам обновено предложение; проверявам, че таблото не се променя преди потвърждение; след потвърждение задачите се виждат на таблото и редовете съществуват в листовете Tasks/Categories; проверявам, че се е появил ред в Logs.
  Learner check: Постави имейла за откриването в чата, прегледай предложението, направи поне една корекция, после потвърди и виж задачите на таблото.
  Commit: `Add AI proposal, confirmation, and persisted board`

- [ ] **3. Детайли на задача, редакция, отметка и ръчно добавяне**
  Becomes usable: Отваряш задача, виждаш детайли и оригиналния текст, редактираш направо в нея, отмяташ я (пада долу, бледа и задраскана) и можеш да добавиш задача ръчно в съществуваща колона.
  Why now: Следва директно след като задачите вече съществуват на таблото от Slice 2; завършва основните действия върху единична задача, преди архивирането (Slice 4), което зависи от състоянието „done".
  PRD ref: `prd.md > Задачите в таблото`, `prd.md > Ръчно добавяне на задача`
  Spec ref: `spec.md > Components` (Страница: Отворена задача и ръчен формуляр, Страница: Undo), `spec.md > Data Model` (Tasks), `spec.md > External Services and Dependencies` (`applyChanges` update/delete)
  Build: `js/task.js` (отворена задача, редакция на място, отметка/размаркиране, изтриване), `js/undo.js` (лента „Отмени" ~5 сек за изтриване и отметка), връзка „+ ръчно" → форма (категория само от активни колони), `apps-script/Data.gs` допълнен с `applyChanges` за `update`/`delete`.
  Verify (mechanical): Отварям задача, редактирам поле, презареждам страницата и проверявам, че промяната е останала; отмятам и проверявам, че пада долу, бледа и задраскана; размаркирам и се връща нормална; изтривам и в прозореца за undo я връщам; добавям ръчна задача и проверявам, че не може да се избере/създаде нова категория.
  Learner check: Отвори една задача, промени нещо, отметни я, после пробвай „+ ръчно" да добавиш нова задача в съществуваща колона.
  Commit: `Add task details, in-place edit, and manual add`

- [ ] **4. Автоматично архивиране и меню „Архивирани"**
  Becomes usable: Когато отметнеш последната задача в колона, виждаш undo, а след това колоната изчезва от таблото и се вижда в „Архивирани"; размаркиране там я връща активна.
  Why now: Втората половина на уникалното ядро (автоматично архивиране) — идва скоро след първата половина (Slice 2), докато колоните и задачите вече съществуват и могат да се отмятат (Slice 3).
  PRD ref: `prd.md > Автоматично архивиране`
  Spec ref: `spec.md > Components` (Страница: Undo), `spec.md > Data Model` (Categories: `status`, `archived_at`), `spec.md > External Services and Dependencies` (`archiveCategory`/`reactivateCategory`)
  Build: Откриване кога последната задача в колона е отметната (`board.js`/`task.js`), undo-прозорец преди `archiveCategory` (`undo.js`), изглед „Архивирани" (навигация в `app.js` + рендер на архивираните колони), `reactivateCategory` при размаркиране там.
  Verify (mechanical): Отмятам последната задача в колона, изчаквам прозореца за undo да изтече и проверявам, че колоната изчезва от таблото и се вижда в Архивирани; размаркирам задача там и колоната се връща активна; проверявам, че навременно натиснато undo запазва колоната на таблото.
  Learner check: Отметни последната задача в някоя колона, изчакай да изчезне в Архивирани, после размаркирай я оттам и виж дали колоната се връща.
  Commit: `Add auto-archive and Archived menu with reactivation`

- [ ] **5. Офлайн режим, синхронизация и конфликти**
  Becomes usable: Изключваш интернета, таблото пак се отваря с последните данни, ръчното добавяне и редакциите работят офлайн, а при връщане на връзката промените се изпращат и конфликт между две устройства се показва за избор.
  Why now: Най-рисковата част, но зависи от всички операции (create/update/delete/archive), които вече съществуват от Slice 2-4 — по-лесно се увива опашка около готови операции, вместо да се гадае формата им предварително.
  PRD ref: `prd.md > Работа без интернет`, `prd.md > Достъп от всяко устройство`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components` (Страница: Локално хранилище и опашка, Страница: Синхронизация и конфликти, Страница: Офлайн обвивка), `spec.md > Data Model` (На устройството, Как се засича конфликтът)
  Build: `js/store.js` (snapshot + опашка + настройки + тема в localStorage), `js/sync.js` (лента „Няма връзка", изпращане на опашката с `base_version`, диалог при конфликт), `sw.js` + `manifest.webmanifest` (кеширане на файловете на страницата за офлайн зареждане).
  Verify (mechanical): Изключвам мрежата, презареждам страницата и проверявам, че таблото показва последния snapshot и лентата „Няма връзка"; чатът е изключен, ръчното добавяне работи; включвам мрежата и проверявам, че опашката се изпраща и се вижда в листа; редактирам една и съща задача от две „устройства" (едно офлайн) за да предизвикам конфликт и проверявам, че диалогът показва двете версии.
  Learner check: Изключи мрежата, пробвай таблото и ръчното добавяне, после включи мрежата и виж дали промяната се синхронизира.
  Commit: `Add offline queue, service worker caching, and conflict resolution`

- [ ] **6. Тема и визуална доработка в стил Apple**
  Becomes usable: Приложението изглежда спокойно и подредено в стил Apple, с избор на светла/тъмна/системна тема, плавни преходи и удобно плъзгане на колоните на телефон.
  Why now: Визуалната доработка се възползва от това, че всички екрани вече съществуват от Slice 1-5; прави се последна, за да не се стилизира нещо, което може още да се промени.
  PRD ref: `prd.md > Look and Feel`
  Spec ref: `spec.md > Look and Feel`
  Build: Променливи за тема в `css/styles.css` (светла/тъмна/системна, пазена през `store.js`), повърхности/сенки/типография по спецификацията, кратки „spring" преходи с уважение към `prefers-reduced-motion`, хоризонтално плъзгане със „щракване" на колоните на телефон. Ползва се skill-ът за Apple дизайн.
  Verify (mechanical): Сменям темата в настройките и проверявам, че се пази след презареждане; стеснявам до ширина на телефон и проверявам плъзгането със „щракване"; включвам „намалено движение" в системата и проверявам, че преходите се скъсяват/изключват.
  Learner check: Пробвай темите (светла/тъмна/системна) и отвори приложението на телефона, за да видиш как се плъзгат колоните.
  Commit: `Add theme switching and Apple-inspired visual polish`

## Hands-on Checkpoints

- [x] Ранна обратна връзка — след Slice 2 (AI предложение + табло: моментът „оха"). Обучаемият тества с реален имейл; открити и оправени: Google Sheets разпознаваше имена/срокове като дати, AI предлагаше по една колона на задача вместо по повод, потвърждението беше бавно (3 последователни заявки). Повторен тест след поправките: коректно групиране в „15 септември", по-бързо потвърждение.
- [ ] Финален преглед „разклати таблото" — в края, след всички слайсове

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

- Записите в `Categories`/`Tasks` сега задават текстов формат (`@`) на клетката точно преди `setValues` — Google Sheets автоматично разпознаваше имена на колони и срокове, изглеждащи като дата (напр. „15 септември"), и ги превръщаше в истинска дата, което чупеше показването им.
